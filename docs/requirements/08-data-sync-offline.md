# 08 — Data Sync, Caching & Offline Resilience Requirements

**Component:** Always-on Google Calendar kiosk (Android tablet, Fully Kiosk Browser, 24/7)
**Scope:** How calendar data is fetched, kept fresh, persisted, and survives network loss; time/DST correctness; long-running-tab concerns; weather caching.
**Status:** Requirements / design baseline.

---

## 1. Goals & Non-Goals

### 1.1 Goals
- Always display an **accurate** calendar, even during transient network loss.
- Keep at minimum a **rolling window of -1 month to +3 months** of calendar data available locally at all times.
- Minimize Google Calendar API quota usage via **incremental sync**.
- Recover automatically from API errors, token expiry, full-resync conditions, network blips, and device restarts.
- Correct rendering across time zones, DST transitions, midnight rollover, and multi-day long-running sessions.

### 1.2 Non-Goals
- Two-way sync (the kiosk is **read-only**; it never writes to Google Calendar).
- User-facing event editing or RSVP.
- Real-time sub-second update latency (a 1–5 minute freshness target is acceptable).

---

## 2. Sync Strategy with Google Calendar

### 2.1 Overview
Sync runs as a background loop. Each configured calendar is synced **independently** (its own sync token and cache partition). The loop combines:

1. **Incremental sync** using `events.list` with a persisted `syncToken`.
2. A **polling cadence** as the primary trigger (push/watch webhooks are out of scope for a browser kiosk — see §2.4).
3. A **rolling time-window** re-anchor that periodically shifts the fetched range forward.

### 2.2 Incremental sync via `syncToken`
- **Initial sync (per calendar):** call `events.list` with the time window params (`timeMin`/`timeMax`, see §2.5), `singleEvents=true`, `orderBy=startTime`, paginate via `nextPageToken`. The final page returns a `nextSyncToken` — **persist it** (see data model §4).
- **Incremental sync:** call `events.list` with **only** the stored `syncToken` (do **not** send `timeMin`/`timeMax` alongside `syncToken` — the API rejects that combination). Each response page returns changed/created/deleted events since the last token; the last page returns a new `nextSyncToken`. Persist the new token only after the full page set is consumed successfully.
- **Atomicity:** apply all pages of an incremental run to the cache as one logical transaction, then commit the new `syncToken`. If any page fails, discard partial token advancement and retry from the last committed token.

### 2.3 Polling cadence
- **Foreground / normal operation:** poll each calendar every **5 minutes** (configurable: `SYNC_INTERVAL_MS`, default 300000).
- **Backoff on errors:** exponential backoff starting at 30s, doubling to a **max of 15 minutes**, with ±20% jitter to avoid thundering-herd alignment across calendars. Reset to base interval on first success.
- **Online-event nudge:** on `window.online` event (network restored), trigger an immediate sync (bypassing the timer), subject to a 10s debounce.
- **Quota awareness:** 5-minute polling across a handful of calendars is well within default Google Calendar API quotas (incremental responses are tiny when nothing changed). Document the per-day call estimate in ops notes.

### 2.4 Push/watch webhooks — decision: NOT used
- Google Calendar push notifications (`events.watch`) require a **publicly reachable HTTPS callback URL** to receive channel POSTs. A kiosk browser tab cannot host one.
- Therefore the system uses **polling only**. If a backend proxy is later introduced, `events.watch` MAY be added there to reduce latency, but the client must still treat polling as the source of truth and degrade to polling if webhooks lapse (channels expire and must be renewed).

### 2.5 Rolling time window (-1 month → +3 months)
- Fetch range is **`timeMin = now - 1 month`**, **`timeMax = now + 3 months`** (configurable: `WINDOW_PAST_DAYS=31`, `WINDOW_FUTURE_DAYS=93`).
- The window must **advance over time**. Two mechanisms keep the window from drifting stale:
  1. **Daily re-anchor:** once per day (at the midnight rollover, §7) the effective window shifts forward by a day's worth. Because incremental sync uses only `syncToken` (no `timeMin`/`timeMax`), a shifting window cannot be expressed incrementally.
  2. **Periodic window re-base full sync:** every **24 hours** (configurable `WINDOW_REBASE_INTERVAL_MS`), perform a fresh windowed `events.list` (new initial sync) so newly-in-range future events (now within +3 months) and freshly-aged past events are correctly populated, and obtain a new `syncToken`. This is the safe way to keep the window correct given the syncToken/window constraint.
- **Pruning:** events older than `timeMin` may be pruned from cache on each re-base to bound storage, but pruning is optional — keeping a little extra past data is harmless.

### 2.6 Handling `410 GONE` (full re-sync required)
- A `410 GONE` (or `403`/`410` with reason `fullSyncRequired`) on an incremental call means the stored `syncToken` is invalid (expired/too old).
- **Recovery:** discard the stored `syncToken`, perform a **fresh windowed initial sync** (§2.2) for that calendar, repopulate the cache, and store the new `nextSyncToken`. This must be automatic, logged, and counted in metrics. The previously cached data remains displayed throughout the re-sync (no blank screen).

### 2.7 Recurring event expansion
- Use **`singleEvents=true`** so the API expands recurrences into individual instances within the window. This avoids client-side RRULE expansion and guarantees correct handling of exceptions/overrides.
- Each expanded instance carries `recurringEventId` (link to master) and its own `id`. **Modified instances** (overrides) and **cancelled single instances** arrive as distinct items in incremental updates.
- Trade-off accepted: instances outside the window are not expanded; the daily window re-base (§2.5) brings future instances into range as time advances.

### 2.8 Deleted / cancelled events
- In incremental responses, deletions/cancellations appear as items with **`status: "cancelled"`**.
- On receiving a cancelled item: **remove** the corresponding event id from the cache (or tombstone it) so it disappears from the display. A cancelled instance of a recurring series removes only that instance.

### 2.9 Multiple calendars
- Each calendar in config has: `calendarId`, display color, enabled flag, **its own `syncToken`**, and its own cache partition.
- Sync runs per-calendar; one calendar's `410`/error must not block others.
- The rendering layer **merges** all enabled calendars into one timeline, tagging each event with its source `calendarId` for color/legend.

---

## 3. Client-Side Caching & Persistence

### 3.1 Storage technology selection

| Concern | Technology | Rationale |
|---|---|---|
| Event records, sync tokens, weather snapshots | **IndexedDB** | Structured, queryable, large capacity, survives reloads; correct store for potentially thousands of expanded instances over a 4-month window. |
| Small flags / last-sync timestamps mirror | **localStorage** (optional mirror only) | Synchronous quick reads for the "last updated" indicator; IndexedDB remains source of truth. |
| App shell (HTML/CSS/JS, fonts, icons) | **Service Worker Cache (Cache Storage)** | Makes the kiosk boot and render offline after a power cycle even with no network; enables stale-while-revalidate for static assets. |

- **Service Worker** is required for offline app-shell boot. Cache strategy: **cache-first for the shell**, **network-first-with-cache-fallback** is NOT used for the calendar API (the SW does not cache API responses — IndexedDB is the API cache; the app reads from IDB, not from `fetch`).
- Do **not** rely on localStorage for event data (size limits ~5MB, synchronous, easily evicted).

### 3.2 What to store
- All expanded event instances within the window (see model §4.1).
- Per-calendar sync state: `syncToken`, `lastSuccessfulSyncAt`, `windowMin`, `windowMax`, `lastRebaseAt` (model §4.2).
- Last successful **weather** snapshot (model §4.3).
- A global `lastUpdatedAt` = max across calendars of `lastSuccessfulSyncAt`.

### 3.3 Cache invalidation & stale-while-revalidate
- **Read path:** the UI always renders from IndexedDB immediately (never blocks on network). This is the "serve stale" half.
- **Revalidate:** the background sync loop updates IndexedDB; the UI subscribes to a change signal (e.g. BroadcastChannel or a simple in-memory event after each commit) and re-renders the affected day(s).
- **Invalidation triggers:** incremental sync deletions (§2.8), window re-base (§2.5), and `410` full re-sync (§2.6). There is no time-based blanket cache flush — data is kept until explicitly superseded or pruned out of window.
- **App-shell invalidation:** Service Worker versioning — bump `CACHE_VERSION` on deploy; old caches deleted in the SW `activate` handler.

---

## 4. Data Models (cached)

### 4.1 `CachedEvent` (IndexedDB object store `events`, keyPath `id`)
```ts
interface CachedEvent {
  id: string;                 // event instance id (unique per expanded instance)
  calendarId: string;         // source calendar (for color / merge / per-cal purge)
  status: 'confirmed' | 'tentative' | 'cancelled';
  summary: string;
  description?: string;
  location?: string;
  // Times: store BOTH the original wall-time + tz AND a UTC instant for sorting.
  start: {
    dateTime?: string;        // RFC3339 with offset, for timed events
    date?: string;            // YYYY-MM-DD, for all-day events
    timeZone?: string;        // IANA tz id as supplied by API
  };
  end: { dateTime?: string; date?: string; timeZone?: string };
  startUtcMs: number;         // derived UTC epoch ms for range queries/sorting
  endUtcMs: number;
  isAllDay: boolean;
  recurringEventId?: string;  // present on instances of a recurring series
  colorId?: string;
  updated: string;            // API 'updated' timestamp (for conflict ordering)
  etag?: string;
}
```
- **Indexes:** `by_start` on `startUtcMs` (range scan for a day/week), `by_calendar` on `calendarId`, `by_recurring` on `recurringEventId`.

### 4.2 `CalendarSyncState` (object store `syncState`, keyPath `calendarId`)
```ts
interface CalendarSyncState {
  calendarId: string;
  syncToken: string | null;     // null forces initial/full sync
  lastSuccessfulSyncAt: number; // epoch ms
  lastAttemptAt: number;
  windowMin: string;            // RFC3339 timeMin used
  windowMax: string;            // RFC3339 timeMax used
  lastRebaseAt: number;         // epoch ms of last window re-base
  consecutiveFailures: number;  // drives backoff
  lastError?: { code: number; reason: string; at: number };
}
```

### 4.3 `WeatherSnapshot` (object store `weather`, keyPath `locationKey`)
```ts
interface WeatherSnapshot {
  locationKey: string;          // e.g. "lat,lon" or city id
  fetchedAt: number;            // epoch ms
  expiresAt: number;            // fetchedAt + TTL (see §8)
  current: { tempC: number; condition: string; icon: string; /* ... */ };
  daily: Array<{ date: string; hiC: number; loC: number; condition: string; icon: string }>;
  source: string;               // provider id
}
```

---

## 5. Offline Behavior & Graceful Degradation

### 5.1 Last-known-good display
- On network loss, the kiosk **keeps showing the last cached data** with no error overlay or blank screen.
- A **subtle staleness indicator** is shown when data is older than the freshness threshold:
  - Always render a small "Updated HH:MM" (or "Updated 12m ago") label in a low-emphasis corner.
  - When `now - lastUpdatedAt > STALE_THRESHOLD` (default **15 minutes**), switch the label to a muted "stale" state (e.g. greyed + small dot/icon). Do **not** use alarming colors or modal popups — this is an ambient display.
  - When `now - lastUpdatedAt > VERY_STALE_THRESHOLD` (default **2 hours**), escalate the indicator slightly (e.g. amber dot) but still keep showing the calendar.

### 5.2 Retry / backoff
- Network/5xx/429 errors: exponential backoff with jitter (§2.3), capped at 15 min. Honor `Retry-After` on `429` if present.
- `401`/auth errors: trigger token refresh (OAuth refresh token) before retrying; if refresh fails, surface a discreet auth-needed indicator and keep displaying cached data.
- The retry loop must be **self-healing** — no manual intervention required after a network outage of arbitrary length.

### 5.3 Cold-start offline
- If the device reboots while offline, the **Service Worker** serves the app shell and the app renders from **IndexedDB**. The kiosk must come up showing the last cached calendar with the stale indicator, never a connection-error page.

---

## 6. Time, Time Zone & DST Correctness

- **Single source of truth for "now":** all date math uses the device clock interpreted in the **kiosk's configured display time zone** (explicit IANA tz in config, not just relying on device locale, to avoid surprises).
- **Storage:** keep both the original `dateTime`+`timeZone` from the API and a derived `startUtcMs`/`endUtcMs` (§4.1). Sorting and range queries use UTC ms; **display** formatting uses the configured display tz via `Intl.DateTimeFormat` with an explicit `timeZone`.
- **All-day events** use floating `date` (no tz) and must render on the calendar date as written, independent of display tz (do not convert all-day to UTC instants for placement).
- **DST transitions:** because display formatting goes through `Intl` with an IANA zone, spring-forward/fall-back are handled correctly (a 9:00 event stays 9:00 local). Never compute local times by adding fixed offsets.
- **Window math** (`now ± months`) uses calendar-aware date arithmetic, not fixed `30*24h`.

---

## 7. Midnight Rollover (auto-advance to new day)

- The display must **advance to the new day automatically at local midnight** without a manual refresh.
- Implementation: schedule a timer for the next local-midnight boundary (computed in the display tz). On fire: re-render "today", advance the rolling window re-anchor (§2.5), trigger a sync, and **reschedule** the next midnight timer.
- **Do not** use a single `setTimeout(24h)` — drift and DST make day-length variable. Recompute the ms-until-next-midnight each time.
- **Safety net:** also re-evaluate the current date on every render tick (see clock drift §7.1) so that even if the midnight timer is throttled/missed, the day still flips within the tick interval.

### 7.1 Clock drift on a long-running tab
- Background tabs and long-lived `setTimeout`s can be throttled/coalesced by the browser, so timers are **not** a reliable clock.
- Run a lightweight **heartbeat tick** (e.g. every 30–60s) that:
  - reads the real wall clock (`Date.now()`),
  - detects if the **calendar day changed** since last tick (handles missed midnight timer),
  - detects large **jumps** (e.g. device clock corrected, NTP sync, or tab resumed after sleep) and forces a re-render + a sync,
  - updates the "last updated / stale" indicator.
- **Visibility:** on `visibilitychange` → visible, immediately re-evaluate date/time and trigger a sync (Fully Kiosk keeps the tab foregrounded, but treat it defensively).
- **Periodic hard reload (optional safety):** schedule a full page reload during a low-traffic hour (e.g. 04:00 local) to clear any accumulated memory/state leaks on a 24/7 tab. Reload must repopulate from cache instantly so there is no visible blank period.

---

## 8. Weather Data Caching

- Weather is **secondary**; its failure must never affect calendar rendering.
- **Polling cadence:** refresh every **15–30 minutes** (configurable `WEATHER_INTERVAL_MS`, default 1800000). Forecast data rarely changes faster.
- **TTL & stale-while-revalidate:** store `WeatherSnapshot` with `expiresAt`. Always render the last snapshot immediately; revalidate in the background. If a fetch fails, keep showing the last snapshot.
- **Stale indicator:** if `now > expiresAt + grace` (grace default 2h), show a subtle stale marker on the weather widget only.
- **Offline:** show last-known weather with stale marker; no error state.

---

## 9. Configuration Summary

| Key | Default | Meaning |
|---|---|---|
| `SYNC_INTERVAL_MS` | 300000 (5 min) | Normal per-calendar poll cadence |
| `SYNC_BACKOFF_BASE_MS` | 30000 | Backoff start on error |
| `SYNC_BACKOFF_MAX_MS` | 900000 (15 min) | Backoff cap |
| `WINDOW_PAST_DAYS` | 31 | timeMin offset |
| `WINDOW_FUTURE_DAYS` | 93 | timeMax offset |
| `WINDOW_REBASE_INTERVAL_MS` | 86400000 (24 h) | Window re-base full sync cadence |
| `STALE_THRESHOLD_MS` | 900000 (15 min) | When "updated" label goes stale |
| `VERY_STALE_THRESHOLD_MS` | 7200000 (2 h) | Escalated stale state |
| `HEARTBEAT_MS` | 45000 | Clock-drift / day-flip tick |
| `WEATHER_INTERVAL_MS` | 1800000 (30 min) | Weather refresh cadence |
| `DISPLAY_TZ` | (required) | IANA tz for display & day math |
| `CALENDARS[]` | (required) | List of `{calendarId, color, enabled}` |

---

## 10. Acceptance Criteria

### Freshness
- **AC-F1:** Under normal connectivity, an event added/changed/deleted in Google Calendar appears/updates/disappears on the kiosk within **≤ 6 minutes** (one poll cycle + render).
- **AC-F2:** The "Updated …" indicator reflects the true `lastUpdatedAt` and flips to the stale state within one heartbeat after exceeding `STALE_THRESHOLD_MS`.
- **AC-F3:** Each successful incremental sync that returns no changes produces **no** UI flicker/re-render.

### Offline tolerance
- **AC-O1:** Pulling the network for **up to 24 hours** keeps the last-known calendar fully visible with the stale indicator; no blank screen, error page, or modal appears.
- **AC-O2:** Rebooting the device **while offline** boots from Service Worker + IndexedDB and shows the last cached calendar within normal load time.
- **AC-O3:** On network restoration, the kiosk syncs and clears the stale indicator within **≤ 60 seconds** without manual action.
- **AC-O4:** An expired `syncToken` (`410 GONE`) is recovered via automatic full windowed re-sync with **no** visible interruption to the displayed calendar.

### 3-month window
- **AC-W1:** At any time, the cache contains all instances from **now-1mo to now+3mo** for every enabled calendar (verified by querying IndexedDB range against the API for the same window).
- **AC-W2:** Recurring series are expanded to individual instances across the full window, with overrides and per-instance cancellations reflected correctly.
- **AC-W3:** After 24h of running, the window has re-based so that events newly within +3 months are present without a manual reload.

### Time / DST / rollover
- **AC-T1:** At local midnight, the display advances to the new day automatically (verified across a normal night **and** across a DST transition night).
- **AC-T2:** A timed event renders at the correct local wall-clock time before and after a DST change; an all-day event renders on its written date regardless of display tz.
- **AC-T3:** Simulating a long-throttled timer (skip the midnight `setTimeout`) still flips the day within one heartbeat interval (`HEARTBEAT_MS`).
- **AC-T4:** A forward/backward device clock jump triggers a re-render and resync within one heartbeat.

### Weather
- **AC-WX1:** Weather fetch failure or offline never blanks or errors the calendar; last weather snapshot remains with a stale marker after TTL+grace.

---

## 11. Observability (recommended)
- Counters: syncs attempted/succeeded/failed per calendar, `410` full-resyncs, window re-bases, backoff entries, weather fetch failures.
- Last-values: `lastUpdatedAt`, current backoff interval, consecutive failures per calendar.
- These can drive an ops/debug overlay (toggled, not shown in normal kiosk mode).
