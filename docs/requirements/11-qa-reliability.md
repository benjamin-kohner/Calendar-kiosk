# 11 — QA, Testing & Reliability Requirements

**Component:** Calendar Kiosk Web App (Android tablet, Fully Kiosk Browser)
**Operating profile:** Always-on, unattended, 24/7 for 3+ months between physical touches
**Document owner:** QA / Reliability
**Status:** Baseline requirements — gates production deployment

---

## 0. Why this document exists

This app's entire value proposition is *correct information shown continuously without anyone touching it*. A bug that only manifests after 6 weeks of uptime, at a DST boundary, or when an OAuth refresh token silently expires is indistinguishable to the end user from "the thing is broken." Therefore reliability is not a feature — it is the acceptance bar.

Two failure classes dominate and both are invisible in a 10-minute demo:

1. **Slow-burn failures** — memory leaks, unbounded DOM growth, accumulated timers, listener leaks, render thrash. They kill the device days/weeks in.
2. **Boundary/edge failures** — day rollover, month/year boundary, DST, timezone, token expiry, API 410 resync. They fire on a clock, not on a click.

The testing strategy below is built to surface both *without waiting for real time to pass* (see §9, time/clock manipulation).

---

## 1. Test Strategy

### 1.1 Test pyramid (target distribution)

| Layer | Share | Speed | What it owns |
|---|---|---|---|
| **Unit** | ~60% | ms | Date/time math, recurrence expansion, timezone/DST conversion, token-state machine, view-model transforms, overflow logic, parsing of Google API payloads |
| **Integration** | ~30% | s | OAuth refresh flow against a mock auth server, calendar sync incl. incremental sync tokens & 410 handling, weather client + cache, render pipeline against fixture data, gesture handler wiring |
| **End-to-end (E2E)** | ~10% | s–min | Full app in a headless/real browser: view swiping, day rollover, offline→online, token-expiry recovery, soak |

**Hard rule:** All time- and timezone-dependent logic MUST be unit-testable with an **injectable clock and injectable timezone**. No code may read `Date.now()`, `new Date()`, or the system timezone directly outside a single time-source module. This is the single most important testability requirement in the app — it makes §2.2–§2.5 and §9 possible.

### 1.2 Determinism requirements

- **Injectable clock.** A `Clock` abstraction (e.g. `clock.now()`) wraps all current-time reads. Tests can set, freeze, and advance it. Production binds it to the real clock.
- **Injectable timezone.** The display timezone is configuration, not "whatever the device says." Tests run the full suite under at least: `America/New_York` (DST, negative offset), `America/Los_Angeles`, `Australia/Lord_Howe` (30-min DST shift — catches half-hour-offset bugs), `Asia/Kolkata` (`UTC+5:30`, no DST), `UTC`, and the device's configured production zone.
- **Network virtualization.** All Google Calendar, OAuth, and weather HTTP is routed through a layer that can be mocked/intercepted (MSW or equivalent) for integration tests and a real-but-controllable fake server for E2E.
- **No hidden global state** between tests; each test seeds its own clock, tz, token state, and fixtures.

### 1.3 Tooling (reference — adapt to stack)

- Unit/integration: Vitest/Jest with fake timers + a real timezone library (Luxon/Temporal/`date-fns-tz`). **Do not roll your own DST math.**
- Network mocking: MSW (Mock Service Worker).
- E2E + soak: Playwright (Chromium) for CI; **plus at least one soak run on the actual target tablet in Fully Kiosk** (emulators do not reproduce the device's GC behavior, GPU memory, or Fully's WebView).
- Memory/leak inspection: Chrome DevTools heap snapshots via remote debugging against the tablet's WebView; `performance.memory` sampling in-page for trend logging.
- CI: run unit + integration on every commit; run E2E nightly; run the accelerated soak (§9) weekly and before every release.

---

## 2. Test Scenarios

Each scenario lists: **trigger**, **expected behavior**, **failure mode it guards against**, and **how to test without waiting**.

### 2.1 Long-run soak / memory-leak (P0)

- **Trigger:** App runs continuously.
- **Expected:** After 72h continuous run (and the accelerated equivalent of 90 days, §9), the app is still rendering correct, current data; JS heap is flat (no upward trend), DOM node count is bounded, timer/listener counts are bounded, and frame rate for swipes is unchanged from hour 0.
- **Guards against:** Heap growth from re-render leaks, detached DOM nodes, `setInterval`/`setTimeout` accumulation, event-listener accumulation on re-mounted views, growing in-memory event arrays that are never pruned, canvas/image leaks in weather view.
- **Acceptance:**
  - JS heap trend over a 24h window: slope ≤ **+2% per 24h** after warm-up, and absolute heap never exceeds the device budget (define a hard ceiling, e.g. 150 MB for the WebView — measure on the target device).
  - **DOM node count** returns to a stable baseline after navigating away and back N times (no monotonic growth).
  - **Active timer count** and **listener count** stable across 1,000 simulated view switches.
- **How to test without waiting:** Drive the app through accelerated day-rollover and view-switch cycles (thousands of cycles in minutes/hours), sampling `performance.memory`, `document.getElementsByTagName('*').length`, and instrumented timer/listener registries between cycles. Plot the trend; a leak shows as a line with positive slope. A separate real-time 72h run on the device confirms the accelerated result.

### 2.2 Midnight / day rollover (P0)

- **Trigger:** Local wall-clock crosses 00:00.
- **Expected:** "Today" highlight moves to the new day; agenda drops past events / advances to the new day's events; relative labels ("Today", "Tomorrow") recompute; the weekly view's current-day marker moves; no stale "today" left highlighted.
- **Guards against:** "Today" computed once at load and never updated; off-by-one where the highlight flips a day early/late due to timezone; a `setTimeout(tomorrow)` that drifts or fires twice.
- **Acceptance:** Set clock to `23:59:50`, let it cross midnight, assert the UI updated within ≤ 60s of the boundary, exactly once, with the correct new day.
- **How to test without waiting:** Inject clock, advance across the boundary, assert. Repeat for the boundary occurring while the app is on each of the three views.

### 2.3 Month / year boundary (P0)

- **Trigger:** Day rollover that is also a month or year change (e.g. `Jan 31 → Feb 1`, `Dec 31 → Jan 1`, `Feb 28 → Feb 29` in a leap year).
- **Expected:** Month grid re-renders for the new month with correct day-of-week alignment, correct number of days, correct leading/trailing days from adjacent months; year label updates; leap-year Feb 29 present in 2028/2032 and absent in 2026/2027.
- **Guards against:** Hardcoded 30/31, wrong leap-year rule, day-of-week off-by-one at month start, year not advancing.
- **Acceptance:** Parameterized test across all 12 month transitions + a leap and non-leap February + a year boundary; grid layout matches a golden reference for each.

### 2.4 DST transitions (P0)

- **Trigger:** Spring-forward (clock skips an hour) and fall-back (an hour repeats) in the configured timezone.
- **Expected:** Event start/end times remain correct relative to the user's wall clock; an event at 9:00 AM still shows 9:00 AM after DST; no event appears doubled or dropped; the "now" line / current-day logic stays correct; any internal scheduled timer (midnight rollover, refresh) still fires correctly on the DST day (which is 23h or 25h long).
- **Guards against:** Computing durations in UTC and rendering naively; midnight-rollover timer using a fixed 24h `setTimeout` that lands an hour off on DST days; the repeated 1–2 AM hour in fall-back causing a double rollover or a skipped refresh.
- **Acceptance:**
  - With tz = `America/New_York`, simulate the spring-forward date: an all-day event and a 1:30 AM timed event behave correctly (1:30 AM doesn't exist that day — verify defined behavior).
  - With tz = `America/New_York`, simulate fall-back: the 1:00–2:00 AM window occurring twice does not double-render events nor fire the rollover/refresh twice.
  - Run the half-hour-DST zone (`Australia/Lord_Howe`) to catch 30-minute-offset assumptions.
- **How to test without waiting:** Set clock to the day before the transition, advance through it with injected tz; assert event times against expected wall-clock values.

### 2.5 Timezone correctness (P0)

- **Trigger:** Events created in a different timezone than the display; all-day events; the device timezone differing from the calendar's timezone.
- **Expected:** A timed event is shown in the **display timezone**. An **all-day event spans the correct local day(s)** regardless of the device or event-origin timezone (the classic bug: an all-day event "shifting" a day because it was treated as a UTC midnight instant).
- **Guards against:** Treating all-day `date` values as UTC datetimes; mixing `dateTime` (with offset) and `date` (floating) handling; device-timezone leakage.
- **Acceptance:** Fixture set with: event in `America/Los_Angeles` displayed in `America/New_York`; an all-day event on `2026-06-21` shown on June 21 in `Asia/Kolkata`, `UTC`, and `America/New_York` (never June 20 or 22); a multi-day all-day event with correct start/end days.

### 2.6 OAuth token refresh — happy path (P0)

- **Trigger:** Access token nears/reaches expiry during normal operation.
- **Expected:** App refreshes the access token using the refresh token **before** or on the first 401, transparently, with no visible interruption and no user interaction. New token persisted.
- **Guards against:** Access token expiring (typically ~1h) and the app simply stopping updates for the rest of the deployment — the #1 silent-death risk for an unattended kiosk.
- **Acceptance:** With a mock auth server, set access-token TTL to a short value; run the app across multiple expiry cycles; assert sync continues uninterrupted and refresh is invoked proactively (e.g. at TTL − safety margin) rather than only reactively.

### 2.7 OAuth refresh failure — recovery path (P0)

- **Trigger:** Refresh attempt fails: `invalid_grant` (refresh token revoked/expired — Google can expire refresh tokens, especially for unverified/testing apps where they expire in ~7 days), network failure during refresh, clock skew rejection, or auth server 5xx.
- **Expected (defined, tiered behavior):**
  - **Transient failure** (network/5xx): exponential backoff with jitter, keep retrying, keep showing last-good cached data, surface "data may be stale" only after a threshold.
  - **Permanent failure** (`invalid_grant`): app enters a clearly-defined **re-auth-required** state, displays an on-screen prompt/QR/instructions to re-authenticate, **and fires a remote alert** (§5) because no one is standing at the kiosk. It must NOT silently show stale data forever pretending it's live.
- **Guards against:** Infinite silent failure; tight retry loop hammering the auth server; showing month-old data as if current.
- **Acceptance:** Mock auth returns `invalid_grant`; assert app reaches re-auth state, shows the prompt, emits the alert, and does not crash or hot-loop. Mock auth returns 503 thrice then 200; assert backoff then recovery with no alert (or a recovered/cleared alert).
- **How to test without waiting (key for the 3-month claim):** Configure the mock/refresh layer to reject after N refreshes or after a simulated 7-day mark, proving the revoked-refresh-token path works — without waiting 7 real days. **This is the single most important non-time-waiting test** because expired refresh tokens are the most likely real cause of a kiosk going dark.

### 2.8 Network loss & recovery (P0)

- **Trigger:** Wi-Fi drops, captive portal, router reboot, ISP outage — for seconds, minutes, or hours.
- **Expected:** App shows **last-good cached data**, marks staleness honestly once beyond a freshness threshold, retries with backoff, and **fully self-recovers** when connectivity returns (no manual reload). After a long offline period it does a clean resync, not a corrupted partial state.
- **Guards against:** White screen / crash on fetch failure; never retrying after the first failure; requiring a manual reload to recover; stale data shown as fresh.
- **Acceptance:** Toggle network offline for 1 min / 30 min / 6h; assert: no crash, staleness indicator appears past threshold, automatic recovery + resync on reconnect, heap/timers don't balloon during the outage (backoff must cap, not accelerate).

### 2.9 Google API errors / rate limits / 410 resync (P0)

- **Trigger:** Google Calendar API returns `401` (token), `403` rate-limit/quota, `429`, `5xx`, and critically **`410 Gone`** on an incremental sync (the stored `syncToken` is no longer valid).
- **Expected:**
  - `410` → discard the sync token and perform a **full resync** from scratch, then resume incremental sync. This is mandatory; Google *will* return 410 eventually for a long-lived sync.
  - `401` → trigger token refresh (§2.6) and retry once.
  - `403`/`429` → respect `Retry-After`/backoff, exponential backoff with jitter, do not hammer.
  - `5xx` → backoff + retry.
- **Guards against:** Treating 410 as fatal (kiosk stops updating permanently); ignoring rate limits and getting the app's quota throttled/blocked.
- **Acceptance:** Mock API returns 410 mid-session; assert full resync occurs, event list is correct afterward, incremental sync resumes. Mock 429 with `Retry-After`; assert honored. Mock 5xx storm; assert bounded backoff.

### 2.10 Recurring & all-day events (P1, correctness-critical)

- **Trigger:** RRULE recurrences (daily/weekly/monthly/yearly), with `EXDATE` exceptions, modified single instances (`recurringEventId` overrides), `COUNT`/`UNTIL` limits, and all-day recurrences.
- **Expected:** Instances expand to the correct occurrences in the visible window; exceptions are removed; overridden instances reflect their modified time/title; recurrence respects the event's timezone across DST (e.g. a weekly 9 AM meeting stays 9 AM local across a DST change).
- **Guards against:** Off-by-one in expansion windows, ignoring EXDATE, double-showing an overridden instance, DST drift in recurrences.
- **Acceptance:** Fixture suite covering each RRULE frequency, EXDATE, an overridden instance, COUNT/UNTIL, and a recurrence crossing a DST boundary; expansion matches golden output.

### 2.11 Many-events-per-day overflow (P1)

- **Trigger:** A day with more events than the cell/agenda can show (e.g. 15 events on one day in the month grid).
- **Expected:** Graceful overflow — a "+N more" affordance or bounded list, no layout break, no overlap, no infinite scroll growth, no perf cliff.
- **Guards against:** Layout overflow, clipped/illegible cells, render-time blowup, the overflow path leaking DOM nodes (ties to §2.1).
- **Acceptance:** Render days with 0, 1, typical, and 50 events; assert bounded layout, correct overflow indicator, frame budget held.

### 2.12 Empty states (P1)

- **Trigger:** No events today / this week / this month; no calendars; weather unavailable.
- **Expected:** Intentional empty-state messaging (e.g. "No events today"), never a blank/broken region or a perpetual spinner.
- **Acceptance:** Each view with empty data shows its defined empty state; no spinner persists beyond timeout.

### 2.13 Weather API failure (P1)

- **Trigger:** Weather provider down, rate-limited, returns malformed payload, or times out.
- **Expected:** Weather view degrades gracefully (last-good cached reading with timestamp, or a clean "weather unavailable" state) — **and weather failure NEVER affects calendar correctness or the app's stability.** Calendar is the critical path; weather is best-effort.
- **Guards against:** A weather fetch exception crashing the whole app; weather retry loop competing with calendar sync; stale weather shown as current.
- **Acceptance:** Weather endpoint returns 500 / timeout / garbage JSON; assert calendar unaffected, weather shows degraded state, no crash, bounded retry.

### 2.14 Swipe gesture reliability & Fully Kiosk conflict (P1)

- **Trigger:** User swipes between monthly+agenda ↔ weekly ↔ weather; rapid/partial/diagonal swipes; swipes near screen edges.
- **Expected:** Each intended swipe changes exactly one view in the correct direction; partial swipes settle (snap back or advance) deterministically; rapid swipes don't desync the view index or stack transitions; gestures keep working after weeks of uptime (ties to §2.1 listener leaks).
- **Fully Kiosk conflict:** Fully Kiosk intercepts edge swipes for its own UI (status bar pull-down, Fully's menu/settings gesture, address bar). The app's horizontal swipes MUST NOT collide with Fully's gestures, and Fully MUST be configured to suppress system gestures.
- **Guards against:** Edge swipe opening Android status bar / Fully menu instead of changing view; double-advance on fast swipe; gesture handler accumulating listeners over time; view index drifting out of range.
- **Acceptance:**
  - Automated: synthesize 1,000 swipes (left/right, fast/slow, partial) and assert view index is always valid and matches the net direction; listener count stable.
  - On-device (mandatory, manual): in actual Fully Kiosk, verify edge swipes change views and do **not** trigger Fully's menu or Android status bar. Document the exact Fully settings (disable status bar, disable pull-down, motion/gesture settings, fullscreen, immersive mode) in the deployment checklist.

---

## 3. Reliability Requirements

| ID | Requirement | Target |
|---|---|---|
| R1 | **Uptime** — app shows current, correct data | ≥ **99.5%** of wall-clock over any 30-day window (≤ ~3.6h stale/month, ideally driven only by upstream outages) |
| R2 | **Unattended duration** — runs with zero physical interaction | ≥ **90 days** (proven via accelerated test, §9) |
| R3 | **Auto-recovery from transient faults** (network, API 5xx/429, weather) | Fully automatic, no human action; recover within one backoff cycle of the fault clearing |
| R4 | **Token continuity** | Access token auto-refreshed before expiry; refresh failures escalate per §2.7 — never silent indefinite staleness |
| R5 | **Watchdog / auto-reload** | App and the browser self-heal from hangs/crashes (see §3.1) |
| R6 | **Health-check / heartbeat** | App emits a liveness+freshness heartbeat; staleness/offline raises a **remote alert** (see §3.2) |
| R7 | **Memory stability** | Heap/DOM/timers bounded per §2.1 over ≥ 72h continuous + accelerated 90-day equivalent |
| R8 | **Honest staleness** | When data cannot be refreshed past a threshold, the UI visibly indicates staleness (with last-updated time) rather than implying freshness |
| R9 | **Graceful degradation order** | Calendar correctness > calendar freshness > weather. A non-calendar subsystem failure must never take down calendar display |

### 3.1 Watchdog / auto-reload (R5)

Layered defense — no single mechanism is trusted:

1. **In-app watchdog (heartbeat counter).** A monotonic counter ticks on each successful render/data cycle and is written to a known location (e.g. `localStorage` timestamp `lastHealthyTick`). A self-check (e.g. `requestAnimationFrame`/interval) detects if the main loop or data pipeline has stalled and triggers a soft re-init or a `location.reload()`.
2. **Fully Kiosk auto-reload.** Configure Fully's **"Reload on screen on"** / scheduled periodic page reload (e.g. nightly at a quiet hour, say 03:30 local) AND Fully's **"Relaunch on crash"** / "Restart app on idle/error." A scheduled nightly reload is the cheapest insurance against accumulated leaks; it must occur at a time that does not collide with the midnight rollover test window.
3. **Fully Kiosk app watchdog.** Enable Fully's built-in periodic check that the page is responsive and reloads/restarts the WebView if not.
4. **Android level.** Ensure the device disables auto-updates that restart the browser unexpectedly, sets the app to auto-start on boot (Fully "Start on boot"), and keeps the screen on / device awake (no battery optimization killing Fully).

**Requirement:** After any forced reload, the app returns to a correct live state within **≤ 60s**, with the user's last view or a defined default view, and no re-auth needed (token persisted).

### 3.2 Health-check, heartbeat & remote alerting (R6)

Because the kiosk is unattended, **the system must tell a human when it has gone dark.** Silent failure is the worst outcome.

- **Heartbeat:** The app POSTs a heartbeat to a monitoring endpoint on a fixed interval (e.g. every 5 min) containing: timestamp, app version, last successful calendar sync time, last successful weather fetch time, token state (valid / refreshing / re-auth-required), JS heap sample, uptime since last reload, and current view. Fully Kiosk can also push its own device-level heartbeat/remote-admin telemetry.
- **Staleness/offline alerting:** A monitor (cron/uptime service / Fully's remote admin / a tiny serverless function) raises an alert if:
  - No heartbeat received for **> 15 min** (device offline / browser dead / Wi-Fi down), OR
  - Heartbeat reports `last successful calendar sync` older than **> 30 min** (token/API problem while device is alive), OR
  - Heartbeat reports `token state = re-auth-required` (immediate alert), OR
  - Heap sample exceeds the ceiling (leak warning).
- **Alert channel:** push notification / email / SMS to the owner. Alerts must be **deduplicated** (don't fire every 5 min) and must send a **recovery/clear** notification.
- **Requirement:** A simulated device-offline event and a simulated stale-sync event each produce exactly one actionable alert within the detection window, and a recovery clears it. This alerting path itself is part of acceptance — an unmonitored kiosk fails R6 even if the app is perfect.

---

## 4. How to test the "3 months unattended" claim without waiting 3 months

The claim is proven by **collapsing real time into simulated time** along every axis that changes with time. Nothing here requires more than a few hours of wall-clock.

| Real-world thing that takes time | How we simulate it fast |
|---|---|
| Access token expiry (~1h) | Mock auth server with short TTL; drive dozens of expiry/refresh cycles in minutes (§2.6) |
| Refresh token expiry/revocation (~7 days for testing apps; revocations any time) | Mock auth returns `invalid_grant` after N refreshes / a simulated 7-day mark; assert re-auth state + alert (§2.7) |
| Day/month/year/DST rollovers (days–years) | Injectable clock advanced through each boundary; injectable timezone (§2.2–§2.5) |
| Google `410 Gone` sync-token invalidation (days–weeks) | Mock API returns 410 on demand; assert full resync (§2.9) |
| Memory leak accumulation (days–weeks) | Accelerated thousands of view-switch + rollover + sync cycles while sampling heap/DOM/timers; extrapolate the slope (§2.1) |
| Network blips over months | Programmatic offline/online toggling at varied durations (§2.8) |
| Browser/page going stale | Force-trigger watchdog + nightly reload paths and assert clean recovery (§3.1) |

**Two complementary proofs are required:**

1. **Accelerated suite (CI, repeatable):** All of the above, run automatically. Proves logic correctness across every boundary and that leaks don't exist in the JS layer. Runs in minutes–hours.
2. **Real-time device soak (manual, pre-release):** ≥ **72h** continuous on the actual tablet in actual Fully Kiosk, with one scheduled DST/rollover trick (set the device clock to just before a boundary and let it cross naturally) and the monitoring stack live. This proves what the JS-only accelerated test cannot: real WebView GC behavior, GPU/canvas memory, Fully's reload/crash handling, Wi-Fi radio behavior, and the heartbeat→alert→recovery loop end to end.

**Clock-manipulation method (device):** Disable network time, set the system clock manually to T-minus-90-days or to the eve of a DST/year boundary, let the app run and the clock cross the boundary, observe. Always also test with **network time on** to ensure NTP-driven clock jumps (which can move the clock by seconds-to-minutes) don't double-fire or skip the rollover timer.

---

## 5. Pre-Deployment Acceptance Checklist

Deployment is **blocked** until every box is checked. Group A is correctness; B is reliability; C is device/Fully; D is monitoring.

### A. Correctness (run accelerated suite, all green)
- [ ] All unit tests pass under all required timezones (§1.2).
- [ ] Day rollover updates UI exactly once, on time, on all 3 views (§2.2).
- [ ] Month/year/leap boundaries render correct grids (§2.3).
- [ ] DST spring-forward and fall-back: no dropped/doubled events, no double rollover, correct wall-clock times, half-hour-DST zone passes (§2.4).
- [ ] All-day events land on the correct local day in all test zones (§2.5).
- [ ] Recurring events expand correctly incl. EXDATE/overrides/COUNT/UNTIL and across DST (§2.10).
- [ ] Many-events overflow renders cleanly at 0/1/typical/50 events (§2.11).
- [ ] Empty states render for every view (§2.12).

### B. Reliability
- [ ] Access-token auto-refresh proven across multiple cycles (§2.6).
- [ ] Refresh-failure → re-auth state + alert + no hot-loop (§2.7).
- [ ] `invalid_grant` (simulated 7-day) path proven (§2.7, §4).
- [ ] Network loss (1m/30m/6h) → cached data, honest staleness, auto-recovery (§2.8).
- [ ] API 401/403/429/5xx handled with backoff; **410 → full resync** proven (§2.9).
- [ ] Weather failure does not affect calendar or stability (§2.13).
- [ ] Accelerated leak test: heap/DOM/timers bounded (§2.1).
- [ ] Watchdog soft-recovery and `location.reload()` path proven (§3.1).
- [ ] App returns to live correct state ≤ 60s after a forced reload, no re-auth (§3.1).

### C. Device & Fully Kiosk
- [ ] Fully: Start on boot enabled; Relaunch/restart on crash enabled; periodic page reload scheduled at quiet hour (e.g. 03:30); web auto-reload/watchdog enabled.
- [ ] Fully: status bar disabled, pull-down disabled, immersive/fullscreen on, screensaver/dimming configured for an always-on display, motion detection (if used) doesn't blank content.
- [ ] Android: battery optimization disabled for Fully; auto screen-off disabled (or Fully keeps screen on); OS/browser auto-update won't silently restart mid-deployment; device set to correct production timezone; NTP enabled.
- [ ] Swipe gestures change views correctly and do **not** trigger Fully menu / Android status bar (manual, on-device, §2.14).
- [ ] Swipe stress (1,000 synthetic swipes) leaves view index valid and listeners stable (§2.14).
- [ ] Persistent storage survives reload (tokens, sync token, cache) so reload needs no re-auth.

### D. Monitoring & alerting
- [ ] Heartbeat POSTs on schedule with required fields (§3.2).
- [ ] Simulated device-offline → exactly one alert within ≤ 15 min, recovery clears it (§3.2).
- [ ] Simulated stale-sync (token/API) → exactly one alert within ≤ 30 min, recovery clears it (§3.2).
- [ ] `re-auth-required` → immediate alert (§3.2).
- [ ] Owner contact/alert channel verified live (a real test alert was received).

### E. Final gate
- [ ] **≥ 72h real-time soak on the production tablet in Fully Kiosk passed** with monitoring live and at least one clock-boundary crossing observed (§4).
- [ ] Rollback/recovery runbook exists (how to re-auth on-site, how to force-reload remotely via Fully, who gets paged).

---

## 6. Acceptance Criteria (concrete, measurable)

| Area | Criterion |
|---|---|
| Uptime | ≥ 99.5% fresh-data uptime over a 30-day window |
| Day rollover | UI reflects new day within ≤ 60s of local midnight, exactly once |
| Token refresh | 0 user-visible interruptions across ≥ 10 simulated access-token expiries |
| Refresh failure | 100% of `invalid_grant` cases reach re-auth state + alert; 0 hot-loops |
| Network recovery | Auto-recovers within ≤ 1 backoff cycle (≤ 2 min) after connectivity returns; 0 manual reloads needed |
| 410 resync | 100% of 410s result in successful full resync; event list correct afterward |
| Memory | Heap slope ≤ +2%/24h after warm-up; absolute heap < device ceiling; DOM/timers/listeners non-monotonic over 1,000 cycles |
| DST | 0 dropped, 0 doubled events across both transitions; rollover/refresh timers fire exactly once |
| All-day TZ | 0 day-shift errors across all 6 test timezones |
| Swipe | ≥ 99.9% of synthetic swipes yield a valid view index with correct net direction; 0 Fully-gesture collisions on-device |
| Weather failure | 0 calendar/app crashes attributable to weather; degraded state shown |
| Watchdog | App live + correct ≤ 60s after forced reload; no re-auth |
| Alerting | Offline detected ≤ 15 min, stale-sync ≤ 30 min, re-auth immediate; exactly-once + recovery clear |
| Soak | ≥ 72h device soak with stable memory and continuous correctness |

---

## 7. Prioritized Test Matrix

**Priority key:** P0 = blocks release, kiosk-fatal if broken · P1 = blocks release, correctness/UX-fatal · P2 = should-fix, polish/edge.

| # | Scenario | Layer(s) | Priority | Kiosk impact if broken | Test-without-waiting method |
|---|---|---|---|---|---|
| 1 | OAuth refresh failure / `invalid_grant` recovery + alert | Integration, E2E | **P0** | Kiosk silently goes dark for the rest of the deployment | Mock auth `invalid_grant` after N refreshes (§2.7) |
| 2 | Access-token auto-refresh (happy path) | Integration | **P0** | Updates stop after ~1h | Short-TTL mock auth, many cycles |
| 3 | Memory leak / soak | Unit-instrumented + E2E + device | **P0** | Device slows then crashes after days/weeks | Accelerated cycle loop + 72h device soak |
| 4 | Google `410 Gone` → full resync | Integration | **P0** | Updates stop permanently on first 410 | Mock API 410 on demand |
| 5 | Day / midnight rollover (all views) | Unit, E2E | **P0** | Shows yesterday forever | Injectable clock across boundary |
| 6 | DST transitions (both, incl. ½-hour zone) | Unit | **P0** | Wrong times / double or skipped rollover | Injected clock+tz across transition |
| 7 | Timezone & all-day correctness | Unit | **P0** | All-day events on wrong day; wrong times | 6-timezone fixture matrix |
| 8 | Network loss & auto-recovery | Integration, E2E | **P0** | White screen / needs manual reload | Programmatic offline/online toggling |
| 9 | Watchdog / auto-reload recovery | E2E, device | **P0** | Hang requires physical visit | Force watchdog + reload paths |
| 10 | Heartbeat + remote staleness/offline alerting | Integration, device | **P0** | Failures go unnoticed for weeks | Simulate offline/stale; assert alert+clear |
| 11 | API rate-limit/429/5xx backoff | Integration | **P0** | Quota throttling; retry storm | Mock 429 with `Retry-After`, 5xx storm |
| 12 | Month / year / leap boundary | Unit | **P1** | Wrong grid at month turn | Injected clock across boundaries |
| 13 | Recurring events (RRULE/EXDATE/overrides/DST) | Unit | **P1** | Wrong/missing/duplicated occurrences | Golden-output fixture suite |
| 14 | Swipe reliability + Fully gesture conflict | E2E synthetic + device manual | **P1** | Views unreachable / Fully menu opens | 1,000 synthetic swipes + on-device check |
| 15 | Many-events-per-day overflow | Unit, E2E | **P1** | Broken layout on busy days | Render 0/1/typical/50-event days |
| 16 | Weather API failure isolation | Integration | **P1** | Weather bug crashes whole app | Mock 500/timeout/garbage JSON |
| 17 | Empty states (all views) | Unit, E2E | **P1** | Blank/broken regions, stuck spinners | Empty fixtures per view |
| 18 | Reload restores live state ≤ 60s, no re-auth | E2E, device | **P1** | Stuck on login after nightly reload | Force reload, assert persisted token |
| 19 | NTP clock-jump robustness | E2E, device | **P2** | Double/skipped rollover on time sync | NTP on + manual clock nudge |
| 20 | Locale/format (12h/24h, week start) | Unit | **P2** | Cosmetic/format wrongness | Locale-parameterized tests |

---

## 8. Test data / fixtures (maintain as golden files)

- Timezone matrix: `America/New_York`, `America/Los_Angeles`, `Australia/Lord_Howe`, `Asia/Kolkata`, `UTC`, production zone.
- Event fixtures: timed (cross-tz), all-day (single + multi-day), recurring (each frequency + EXDATE + override + COUNT + UNTIL + DST-crossing), 50-events-in-a-day, empty calendar.
- Google API responses: normal page, `nextSyncToken` flow, `410 Gone`, `401`, `403` quota, `429` + `Retry-After`, `5xx`.
- Auth responses: valid refresh, expiring access token, `invalid_grant`, auth 503.
- Weather responses: valid, 500, timeout, malformed JSON.

---

## 9. Notes on environment fidelity

- **Always validate on the real device.** Fully Kiosk's WebView (Android System WebView / GeckoView depending on Fully build), the tablet's GC, GPU memory, and Wi-Fi radio behave differently from desktop Chromium. CI catches logic bugs; only the device catches reliability bugs.
- **Pin the WebView/Fully versions** used in acceptance; an OS/WebView auto-update can invalidate the soak result. Re-run the device soak after any forced WebView/Fully update.
- **Record the exact Fully Kiosk settings** as code/config artifact so a re-flash reproduces the validated configuration.
