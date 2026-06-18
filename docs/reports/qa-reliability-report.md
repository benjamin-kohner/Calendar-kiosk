# QA & Reliability Assessment — Calendar Kiosk (Beta gate)

**Target:** Google Calendar kiosk SPA, live at https://calendar-kiosk.vercel.app
**Profile:** Always-on, unattended, 24/7 on a ~9" Android tablet in Fully Kiosk Browser
**Stack reviewed:** Vite + Svelte 5 SPA (`src/`) + Vercel serverless (`api/`)
**Reviewer:** Senior QA / Reliability Engineer
**Date:** 2026-06-18
**Verdict:** **NOT READY for the reliability bar in `11-qa-reliability.md`.** Several P0s will make this kiosk go dark or wrong without anyone noticing. A "beta" cut is defensible only if the P0 list below is fixed first; otherwise the most likely real-world outcome is a silently-dark display within days to weeks.

Severity key: **P0** = kiosk-fatal / silent-death (blocks beta) · **P1** = correctness/UX-fatal · **P2** = should-fix / polish.

---

## Executive summary

The app is clean, readable, and handles the *happy path* well (cached-first render, last-good data on fetch failure, reactive midnight rollover via a single shared clock). But it was built and demoed on the happy path, and the requirements doc is explicit that the happy path is invisible to the failure modes that actually kill an unattended kiosk. The dominant gaps:

1. **No remote alerting / heartbeat from the device** — when (not if) this kiosk goes dark, *nobody is told*. R6 is unmet. The `api/health.ts` endpoint exists but nothing on the device POSTs liveness, and no monitor is wired. This alone fails the doc's "an unmonitored kiosk fails R6 even if the app is perfect."
2. **`invalid_grant` (revoked/expired refresh token) is the #1 silent-death path and is only half-handled** — the banner shows *on the device*, but no alert fires, and the refresh-token-expiry reality for the app's publishing status is not addressed.
3. **No client-side watchdog / auto-reload** (R5) and **no DST-safe timing** — the 15s clock tick is actually robust to DST (it re-reads `Date.now()`), but there is no recovery from a hung WebView, no nightly reload, and no backoff anywhere.
4. **Correctness bugs in all-day/timezone handling and the month bar layout** that will mis-place events.

Detailed findings follow.

---

## A. Correctness bugs & edge cases

### A1. All-day & multi-day events parsed in *device* timezone, not display timezone (P1)
**Where:** `src/lib/date.ts:55-61` (`eventStartDate`/`eventEndDate`), used everywhere.

```ts
return ev.allDay ? new Date(ev.start + 'T00:00:00') : new Date(ev.start);
```

All-day dates (`2026-06-21`) are parsed as local-midnight on *whatever timezone the tablet is set to*. The backend (`api/calendar.ts:28`) reports its own `timeZone` (the serverless region, e.g. UTC) but the frontend never uses it — it trusts the device clock. On a correctly-configured tablet (device TZ = home TZ) this is *correct* and actually avoids the classic "all-day shifts a day" UTC bug (good). **But** the doc (§2.5, §1.2) requires the display timezone to be *configuration*, not "whatever the device says." If the tablet's TZ is ever wrong (NTP glitch, manual clock test per §4, OS update resetting locale), every all-day event silently shifts a day with no indication. There is also no handling for events authored in a *different* TZ than display for timed events — `new Date(ev.start)` honors the RFC3339 offset, which is fine, but it is untested against the 6-zone matrix the doc mandates.
**Why it matters 24/7:** A wall display that puts a birthday or trash-day on the wrong date is worse than blank — it's confidently wrong, and the doc explicitly calls clock-manipulation testing (§4) a required method, which *will* expose this.
**Fix:** Introduce a single display-timezone config (env + setting) and a TZ-aware date module (Luxon/Temporal/`date-fns-tz` — the doc says do not roll your own). Parse all-day dates as a *floating local day in the configured zone*. Add the 6-timezone fixture matrix (§8) as unit tests. At minimum, document that device TZ is load-bearing and add it to the device checklist (§C below).

### A2. `eventEndDate` is wrong for timed events that end at a date-only boundary, and `eventOnDay`'s allDay branch is a no-op (P2)
**Where:** `src/lib/date.ts:69`

```ts
const e = ev.allDay ? eventEndDate(ev).getTime() : eventEndDate(ev).getTime();
```

Both branches are identical — the ternary is dead code, signalling the author *intended* different inclusive/exclusive handling for all-day vs timed ends but never implemented it. For all-day events Google's `end.date` is **exclusive** (an event on the 21st has `end = 2026-06-22`), and the code happens to be correct because `e > ds` with `e = 06-22T00:00` excludes the 22nd. For timed events `end.dateTime` is an instant and `e > ds` is also right. So it works *today*, but the dead ternary is a latent trap: anyone "fixing" it to add `- 1` or `+ DAY_MS` to one branch will break the other.
**Fix:** Remove the dead ternary; add a comment + a unit test pinning single-day-all-day, multi-day-all-day, and zero-duration timed events.

### A3. Month-grid bar layout: lane packing ignores already-occupied lanes from earlier columns; first-fit can overlap (P1)
**Where:** `src/lib/monthLayout.ts:68-73`

```ts
let lane = laneEnds.findIndex((end) => end <= colStart);
...
laneEnds[lane] = colStart + colSpan;
```

`laneEnds[lane]` stores only the *last* occupied column-end for each lane. Because candidates are sorted by start then by descending length, this greedy first-fit is *usually* fine, but it assumes every lane is contiguously filled left-to-right. A lane freed early (a short bar ending Tue) then reused by a later bar starting Thu leaves Wed visually empty — acceptable — but the bug is that `findIndex(end <= colStart)` reuses a lane as soon as its *last* bar ended, which is correct for non-overlap, **yet** the `MAX_LANES = 3` cap in `MonthView.svelte:96` (`.filter((b) => b.lane < MAX_LANES)`) silently *drops* any 4th+ overlapping all-day/multi-day bar with **no "+N more" affordance** for bars (only the per-day singles have overflow handling, line 132). On a busy week (e.g. a multi-day trip + two all-day events + a holiday), bars just vanish.
**Why it matters 24/7:** Silent data loss on the primary view. The doc's §2.11 ("many events overflow… no events silently dropped") is violated for spanning bars.
**Fix:** When `laneCount > MAX_LANES`, render a "+N more" chip in the affected week row (mirroring the singles overflow), or compute per-day hidden-bar counts. Add the 0/1/typical/50-event golden tests (§2.11).

### A4. `showTitle` logic mislabels bars that start off-screen-left in the *first* column (P2)
**Where:** `src/lib/monthLayout.ts:82`

```ts
showTitle: c.startMs >= weekStart || colStart === 0
```

A bar continuing from the previous week (`continuesLeft = true`, `colStart === 0`) will show its title again at the start of the new week row — intended (so a week-long bar is labeled each row). Fine. But a bar that starts *exactly* on the week's first day shows a title, and one clipped from the left also shows one at col 0 — there's no case where a title is wrongly hidden, so this is cosmetic only. Flagging for the golden-layout test to pin behavior.

### A5. Recurring events: expansion is delegated to Google (`singleEvents=true`) — correct, but the forward window truncates long/indefinite recurrences silently (P2)
**Where:** `api/calendar.ts:5-13`, `api/_google.ts:109-149`

Using `singleEvents=true` is the right call — Google expands RRULE/EXDATE/overrides/COUNT/UNTIL server-side, so the app dodges the entire DST-recurrence-drift class (§2.10). Good. **But** the window is fixed at `BACK_DAYS=31 / FWD_DAYS=104`. An event recurring forever simply stops appearing past ~3.5 months with no indication, and because there is **no incremental `syncToken`** (full re-fetch every 5 min), the window slides correctly on each poll — so this is acceptable for a rolling display, just undocumented. Note the absence of sync tokens means **§2.9's 410 path is N/A** (no token to invalidate) — but it also means every poll re-downloads all events from all calendars, which is the quota/rate-limit risk in A8.

### A6. `maxResults: 2500` with no further paging guard, and per-calendar errors are swallowed (P2)
**Where:** `api/_google.ts:127-148`

`if (!res.ok) break;` — a single calendar 401/403/429/5xx silently drops *that calendar's events for that cycle* and returns 200 with partial data. The frontend marks it `ok` and shows a confidently-incomplete calendar with no staleness hint. Paging is handled (`nextPageToken` loop) — good — but a mid-page failure returns whatever was collected so far.
**Fix:** Distinguish "calendar errored" from "calendar empty"; surface partial-failure as a degraded state, or at least log/heartbeat it.

---

## B. Always-on / slow-burn reliability risks

### B1. No remote heartbeat or alerting from the device — silent failure guaranteed (P0, R6)
**Where:** absent. `api/health.ts` exists but is a *pull* endpoint; nothing pushes.

The doc is unambiguous (§3.2): "the system must tell a human when it has gone dark… an unmonitored kiosk fails R6 even if the app is perfect." There is:
- no `POST` of `{ timestamp, version, lastCalSync, lastWxFetch, tokenState, heapSample, uptime, view }` on an interval;
- no monitor that alerts on >15 min no-heartbeat, >30 min stale sync, or `re-auth-required`;
- no dedup or recovery-clear.

If the Wi-Fi dies, the WebView hangs, or the refresh token is revoked, the display shows stale/blank content **for as long as it takes someone to physically walk past it.** This is the single highest-impact gap for a "3 months unattended" claim.
**Fix (beta-minimum):** Add a 5-min `fetch('/api/heartbeat', {method:'POST', ...})` from the client with the required fields; add a tiny serverless monitor (or point an uptime service / Fully remote-admin) at it with the three alert thresholds, dedup, and a clear. Verify a real test alert reaches the owner (doc §5.D).

### B2. `invalid_grant` shows a banner but fires no alert, and refresh-token longevity is unverified (P0, R4 / §2.7)
**Where:** `api/_google.ts:57-60`, `api/calendar.ts:31-34`, `src/lib/data.svelte.ts:92-96`, `src/components/AuthBanner.svelte`

The plumbing is *half* right: a 400/401 from Google's token endpoint becomes `AuthError` → `401 {error:'auth'}` → `authNeeded=true` → on-screen banner. **But:**
- **No alert fires** when the token dies, so the owner learns only by looking at the wall — exactly the silent-death the doc calls "the #1 silent-death risk" (§2.6/§2.7).
- The callback page (`api/auth/callback.ts:42`) claims the token is "long-lived because your OAuth consent screen is published to Production." If the OAuth app is actually in **Testing** status, Google expires refresh tokens in ~7 days (§2.7/§4) — the kiosk would die weekly. This must be *verified*, not asserted in a comment.
- Re-auth requires someone to physically tap the banner and complete a Google flow on the tablet, then paste a token into Vercel env and redeploy (`callback.ts:36-40`). That is a heavy on-site procedure with no runbook (doc §5.E).
- `api/calendar.ts` also returns `412` handling client-side (`data.svelte.ts:92`) but the backend never emits 412 — dead branch.

**Why it matters:** This is the most probable cause of the kiosk going dark, and the doc names testing it (mock auth returns `invalid_grant` after N refreshes) "the single most important non-time-waiting test."
**Fix:** (1) Confirm the OAuth consent screen is **Published/Production**, document it. (2) On `AuthError`, have the heartbeat report `tokenState: 're-auth-required'` so the monitor fires an immediate alert. (3) Write the on-site re-auth runbook. (4) Remove the dead 412 branch or make the backend use it.

### B3. No client-side watchdog or auto-reload (P0, R5)
**Where:** absent (`clock.svelte.ts` ticks but never self-heals).

The doc (§3.1) requires layered defense: an in-app heartbeat counter + `lastHealthyTick` in localStorage with a self-check that triggers `location.reload()` on a stalled pipeline, **plus** Fully Kiosk's scheduled nightly reload and relaunch-on-crash. None of the in-app layer exists, and the Fully-side config is undocumented. A hung WebView (the classic weeks-in failure) requires a physical visit.
**Fix:** Add a `lastHealthyTick` write on each successful render/sync cycle and a watchdog interval that reloads if the tick is stale beyond a threshold. Document and enable Fully's scheduled 03:30 reload + relaunch-on-crash + web-auto-reload (doc §5.C). Confirm app returns to live state ≤60s post-reload with token persisted (it should — tokens live server-side, cache in localStorage).

### B4. No backoff anywhere — fixed-interval polling hammers through outages and rate limits (P1, R3 / §2.8-2.9)
**Where:** `src/lib/data.svelte.ts:50-56`, and `api/_google.ts` (no `Retry-After`/429 handling).

`setInterval(refreshCalendar, 5min)` fires unconditionally regardless of failure, and the `online` event triggers an *immediate extra* refresh. There is no exponential backoff, no jitter, no `Retry-After` respect. During a multi-hour Wi-Fi outage the device keeps firing failed fetches every 5 min (bounded, so not catastrophic), but on Google 429/403-quota there is *no* backoff — the app can get its quota throttled and stay throttled. The doc (§2.9, §6) requires honored `Retry-After` and bounded exponential backoff with jitter.
**Why it matters:** Because there's no sync token, every poll is a full multi-calendar fetch; under quota pressure the fixed cadence makes it worse.
**Fix:** Implement backoff-with-jitter in `refreshCalendar`/`refreshWeather` on failure (cap the interval, e.g. 5→10→20→max 30 min), reset on success. Honor `Retry-After` from the backend. Pass `429`/`Retry-After` through `api/calendar.ts` instead of collapsing everything to `502`.

### B5. Timer & listener accumulation risk is low but unbounded subscriptions exist (P1, R7 / §2.1)
**Where:** `src/lib/data.svelte.ts:50-53`, `src/lib/clock.svelte.ts:13`, `src/lib/theme.svelte.ts:14`, `src/lib/embla.ts`.

The three module-level singletons (`appData`, `clock`, `themeController`) each create exactly one `setInterval`/listener at import time and never re-create them — so there is **no** timer accumulation from the singletons (good, and `appData.start()` is called once in `onMount`). The Embla action *does* clean up (`destroy()` on `off`+`destroy`). The real leak risk is:
- `appData.start()` is idempotent-unsafe: if `onMount` ever runs twice (HMR, a future re-mount, or a watchdog soft-reinit that doesn't full-reload), it stacks a *second* pair of intervals and a second `online` listener with no guard. Add a `started` flag.
- The `online` listener and the `SETTINGS_EVENT` listener in `theme.svelte.ts` are never removed — fine for app-lifetime singletons, but if a watchdog soft-reinit is added (B3) these will leak.
- Growing in-memory event arrays: `appData.calendar.events` is *replaced* each poll (not appended), so no growth. Good.
**Why it matters:** The doc demands flat heap / bounded timers/listeners over 72h + accelerated 1,000-cycle tests. The code is *probably* fine, but it is **unproven** — there is no instrumentation, no `performance.memory` sampling, no soak harness.
**Fix:** Add a `started` guard to `AppData.start()`. Add `performance.memory` + `document.getElementsByTagName('*').length` sampling to the heartbeat for trend logging. Run the accelerated view-switch/rollover soak (§2.1) and the 72h device soak (§4) before beta.

### B6. Midnight rollover is DST-safe but has a ≤15s detection latency and a re-render caveat (P2, §2.2)
**Where:** `src/lib/clock.svelte.ts:11-23`, consumers in `MonthView.svelte:28-35`, `WeekView.svelte:25-29`.

**Good:** the clock re-reads `new Date()` every 15s rather than counting a 24h `setTimeout`, so it cannot drift and is immune to the DST "fixed-24h-timeout lands an hour off" bug (§2.4) and to NTP jumps double-firing. Rollover updates `dayKey`, and views react.
**Caveats:** (1) Detection latency is up to 15s — within the doc's ≤60s budget, fine. (2) `MonthView`'s rollover effect (`:28`) only follows the new day if `wasAutoFollowing`; if the user (or a stray touch) selected another day weeks ago, the "Today" highlight is correct (driven by `isToday`) but the *agenda ribbon* stays on the stale selected day forever — on an unattended display a stray touch can strand the ribbon. (3) `themeController.apply` is called every 15s and unconditionally `setAttribute`s — harmless but slightly chatty.
**Fix:** Consider auto-returning the ribbon selection to "today" after an idle timeout (e.g. 5 min of no interaction), so a stray touch self-heals. Pin rollover-on-each-view with injected-clock tests (§2.2).

### B7. Theme sunrise/sunset uses `new Date(sunriseIso)` on Open-Meteo's `timezone=auto` local strings (P2)
**Where:** `src/lib/theme.svelte.ts:19-31`, fed from `api/weather.ts:41-42` (`sunrise`/`sunset` from Open-Meteo with `timezone=auto`).

Open-Meteo with `timezone=auto` returns sunrise/sunset as **local naive ISO** (no offset, e.g. `2026-06-18T05:24`). `new Date('2026-06-18T05:24')` parses as *device-local* — correct only if device TZ == location TZ. If the tablet's TZ differs from the weather location's TZ, the day/night theme flips at the wrong wall-clock time. Low impact (cosmetic dim window) but ties to the A1 device-TZ-trust theme.
**Fix:** Same as A1 — anchor to a configured zone, or accept device-TZ and document it.

---

## C. Error / empty / offline states

### C1. Empty states are partial — weather has a *permanent spinner* failure mode (P1, §2.12)
**Where:** `src/components/WeatherView.svelte:18-19`, `src/components/DayRibbon.svelte:15`, `WeekView.svelte:55`.

- DayRibbon: "No events" — good. WeekView: per-column "·" — acceptable.
- **WeatherView shows `Loading weather…` whenever `wx` is null** — there is *no* distinction between "loading" and "failed/unavailable." If the first weather fetch fails and there's no cache (fresh device, cold start offline), the weather view shows a **perpetual "Loading weather…"** — exactly the "perpetual spinner" the doc forbids (§2.12). `wxStatus` tracks `offline`/`stale` but the view ignores it.
**Fix:** Render a defined "Weather unavailable" state with last-updated time when `wxStatus` is `offline`/`stale` and there's no data; only show "Loading…" on genuine first load.

### C2. Offline detection conflates `navigator.onLine` with real reachability (P2, §2.8)
**Where:** `src/lib/data.svelte.ts:106`, `StatusBar.svelte:12`.

`navigator.onLine` is true on a captive portal or a router that's up but ISP-down, so the status can read "stale" (vs "offline") while genuinely unreachable. Honest-staleness (R8) is *mostly* handled — StatusBar escalates `Updated Xm/Xh ago` and turns `warn` past 20 min — good. But there is **no hard "data is too old to trust" cutoff**; after 6 hours offline it still just says "Updated 6h ago" in `warn`, never a louder "STALE — not live" state.
**Fix:** Add a freshness ceiling (e.g. >30-60 min) that shows an explicit stale badge, matching R8/§3.2's 30-min threshold (and feed it to the heartbeat alert).

### C3. Weather failure correctly isolated from calendar (P1 — PASS, §2.13)
**Where:** `data.svelte.ts:110-131`, separate `try/catch`, separate interval, separate cache.
Weather fetch failure cannot crash calendar — independent code paths, weather exception is swallowed and view degrades. This requirement is **met** (modulo C1's spinner). Good.

---

## D. OAuth / sync failure paths in `api/`

### D1. Token minting is reactive-only; no proactive refresh, no caching of the access token (P1, §2.6)
**Where:** `api/_google.ts:43-64`, called fresh on **every** `api/calendar.ts` and `api/health.ts` request.

Each calendar poll mints a brand-new access token from the refresh token — so there's no "access token expired mid-deployment" risk (it's always fresh per request), which actually *satisfies* the spirit of §2.6 happy-path. **But** it means every 5-min poll does an extra round-trip to Google's token endpoint, and a token-endpoint 5xx/429 (not just `invalid_grant`) collapses to `502` → frontend marks stale with no retry-after/backoff (ties B4). The 400/401→`AuthError` mapping is correct; a transient 503 from Google's token endpoint is treated as a generic upstream 502, which is fine but un-backed-off.
**Fix:** Optionally cache the minted access token (in-memory per warm lambda or a short KV TTL) to cut token-endpoint load; ensure token-endpoint 429/5xx is retried with backoff rather than surfaced as a hard error each cycle.

### D2. `api/health.ts` masks non-auth failures as healthy (P2)
**Where:** `api/health.ts:14-16`

```ts
auth = err instanceof AuthError ? 'needs-auth' : 'ok';
```

A network failure / Google 5xx while checking the token is reported as `auth: 'ok'` (and HTTP 200). So an uptime monitor pointed at `/api/health` sees green during a real Google outage. Combined with B1 (no device heartbeat), monitoring is effectively blind to a live-device-but-stale-sync condition.
**Fix:** Report a third state (`unknown`/`degraded`) for non-auth errors; never claim `ok` on an exception.

### D3. CSRF/`state` param absent in OAuth flow (P2, security-adjacent)
**Where:** `api/auth/start.ts:12-21`, `api/auth/callback.ts`.

No `state` parameter is generated/validated, so the callback accepts any `code`. For a one-time owner-driven setup flow this is low risk, but it's a standard OAuth hardening the security doc would expect. The refresh token is also *displayed in the browser* and manually pasted into env — acceptable for a personal kiosk, worth noting.
**Fix:** Add a `state` nonce (cookie-bound) and validate it in the callback.

---

## Prioritized "fix before beta" list

**P0 — must fix (silent-death / kiosk-fatal):**
1. **B1** Add device heartbeat + remote alerting (no-heartbeat >15m, stale-sync >30m, re-auth immediate; dedup + recovery clear). *Nothing else matters if no one is told the kiosk died.*
2. **B2** Verify OAuth app is **Published/Production** (else 7-day refresh-token death); wire `re-auth-required` into the alert; write the on-site re-auth runbook.
3. **B3** Add in-app watchdog + `location.reload()` self-heal **and** enable Fully's nightly reload + relaunch-on-crash; document Fully settings as config.

**P1 — fix before beta (correctness / recovery):**
4. **A1** TZ-aware all-day/timed parsing (configured display zone, real TZ lib) + 6-zone fixture tests; at minimum document device-TZ dependency.
5. **A3** Month bar overflow: render "+N more" for dropped spanning bars (stop silently dropping multi-day events).
6. **B4** Exponential backoff + jitter on all polling; honor `Retry-After`; pass 429/5xx through instead of flat 502.
7. **C1** Real "Weather unavailable" state (kill the perpetual spinner).
8. **B5** `started` guard on `AppData.start()`; add heap/DOM/timer instrumentation to the heartbeat; run accelerated soak.
9. **D1** Back off token-endpoint 5xx/429; consider caching the access token.

**P2 — should fix:**
10. **A2** remove dead `eventEndDate` ternary + pin with tests.
11. **C2** honest hard-staleness cutoff badge (R8).
12. **B6** idle-return of the agenda ribbon to "today."
13. **D2** health endpoint must not report `ok` on non-auth errors.
14. **B7** theme sunrise/sunset TZ anchoring.
15. **D3** OAuth `state`/CSRF nonce.
16. **A6** distinguish per-calendar fetch failure from empty.

**Cross-cutting (process gate):** There are **no automated tests in the repo at all** — no Vitest, no fixtures, no MSW, no Playwright, no soak harness. The entire §1 test pyramid and §5 acceptance checklist are unimplemented. A "beta" can ship without 100% of this, but the **72h device soak (§4/§5.E)** and the **`invalid_grant` mock test (§2.7)** are the two the doc calls non-negotiable, and both are currently absent.

---

## Manual test checklist (run before cutting beta)

Time/clock (use device clock manipulation per §4 — disable NTP, set clock):
- [ ] Set device to **23:59:50**, watch midnight cross on each of the 3 views; "Today" highlight + agenda + week marker update once, ≤60s, no stale highlight.
- [ ] Set device to **Jan 31 → Feb 1**, **Dec 31 → Jan 1**, and **Feb 28 → Feb 29** (use 2028); grid alignment, day count, year label all correct.
- [ ] Set device TZ to `America/New_York`, set clock to the spring-forward eve, cross it; a 9 AM event still shows 9 AM, no doubled/dropped events, rollover fires once.
- [ ] Repeat for fall-back (1–2 AM repeats); no double rollover.
- [ ] All-day event on `2026-06-21` shows on **June 21** with device TZ set to `Asia/Kolkata`, `UTC`, and `America/New_York` (never the 20th or 22nd). *(Expected to FAIL until A1 — record the shift.)*

OAuth / sync:
- [ ] Temporarily set `GOOGLE_REFRESH_TOKEN` to a garbage value → calendar view keeps last cache, banner appears, status pip goes red, **an alert is received** (after B1/B2). Restore → recovers, alert clears.
- [ ] Throttle/deny network for 1 min / 30 min / 6 h → cached data stays, honest-staleness badge appears past threshold, **auto-recovers with no manual reload**; heap/timers don't balloon.
- [ ] Block Google token endpoint (hosts file / mock) with 503 thrice then 200 → backoff then recovery, no hot-loop, no false re-auth banner.

Layout / overflow / empty:
- [ ] Create a week with a multi-day trip + 3 all-day events on overlapping days → no bar silently dropped (after A3), "+N more" shown.
- [ ] Day with 50 events → bounded layout, "+N more" on singles, no overflow break, swipe frame rate unchanged.
- [ ] Empty calendar → every view shows its defined empty state; weather offline with no cache shows "Weather unavailable", **not** a perpetual spinner (after C1).

Device / Fully Kiosk (on the real tablet):
- [ ] Edge swipes change views and do **not** open Fully menu or the Android status bar; document the exact Fully settings used.
- [ ] Force a `location.reload()` (and Fully crash-relaunch) → app live + correct ≤60s, **no re-auth** needed.
- [ ] Confirm Fully: Start-on-boot, relaunch-on-crash, scheduled 03:30 reload, web-auto-reload all enabled; battery optimization off; screen-stays-on; NTP on; correct production TZ.
- [ ] 1,000 synthetic swipes (or sustained manual swiping) → view index always valid, listeners stable.
- [ ] **≥72h continuous soak** on the device with monitoring live and at least one clock-boundary crossing observed; heap flat, swipes still smooth at hour 72, exactly one alert per simulated fault with a clear.

Monitoring (after B1):
- [ ] Heartbeat POSTs on schedule with all required fields.
- [ ] Simulated device-offline → exactly one alert ≤15 min, recovery clears it.
- [ ] Simulated stale-sync → exactly one alert ≤30 min, recovery clears it.
- [ ] A real test alert was received on the owner's phone/email.
