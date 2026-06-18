# Calendar Kiosk — Master Product Requirements Document (PRD)

**Document owner: Product**
Status: Draft v1.0 · Last updated: 2026-06-18

---

## 0. TL;DR

A web app that runs permanently on a wall-mounted ~11-inch Android tablet (inside Fully Kiosk Browser) and displays the household's Google Calendar 24/7. Three swipeable full-screen views — **Month + agenda ribbon**, **Week**, and **Weather** — optimized to be glanceable from across a room on a ~9-inch usable canvas. The defining requirement: **Google authentication must survive unattended for at least 3 months** (the prior build re-linked every ~7 days). This is solved at the product level by shipping the OAuth client in **Production** status (not Testing) plus a server-side token store; everything else is built around an always-on, low-touch, read-mostly experience that feels comparable to Skylight / Dragon Touch / Calendar Plus.

---

## 1. Product Vision & Goals

### 1.1 Vision
A "set it and forget it" family calendar that lives on the wall, stays current without anyone touching it, and answers the household's two constant questions at a glance: *"What's happening today/this week?"* and *"What's the weather?"* — with the polish of a commercial smart-display product but running on inexpensive, owner-controlled hardware and the family's existing Google Calendar.

### 1.2 Goals
| # | Goal | Why it matters |
|---|------|----------------|
| G1 | **Unattended Google auth ≥ 3 months** (target: indefinite) | The #1 failure of the prior build; kills trust if broken |
| G2 | **Glanceable from ~10 ft** on a ~9-inch screen | The device is mounted, read from across a room |
| G3 | **Zero-maintenance always-on operation** | Runs 24/7 in Fully Kiosk; must self-recover, never need a laptop |
| G4 | **Fast, obvious navigation** between 3 views | Swipe; no menus to learn; works for all ages |
| G5 | **Premium feel** rivaling Skylight/Calendar Plus | Color-coded people, clean typography, screensaver, weather |

### 1.3 What "success" feels like
A family member walks past, glances, and instantly knows today's plan and whether to grab a coffee. Nobody has touched the tablet in weeks. It is always showing live data.

---

## 2. Target User & Context of Use

### 2.1 Context of use (drives every design decision)
- **Mounted & always-on.** Fixed orientation, screen kept on (or motion-woken via Fully Kiosk). No keyboard, no mouse — **touch only**.
- **Glanceable distance.** Read from 6–12 ft. Implies large type, high contrast, minimal chrome, generous whitespace, color as the primary scanning aid.
- **Small canvas.** ~11-inch tablet, but usable area ~9 inches once Fully Kiosk chrome / bezel framing is accounted for. Layout must not assume desktop real estate.
- **Low-touch interaction.** Primary mode is *reading*, not editing. Interaction budget is "a few taps and swipes," not data entry.
- **Single shared household device.** One linked Google account (the household calendar / a calendar that aggregates members). No per-user login on the device.
- **Home network, consumer hardware.** Wi-Fi may blip; tablet may reboot after a power cut. App must recover automatically.

### 2.2 Constraints
- Runs in **Fully Kiosk Browser** (Android WebView). Standard modern web stack only; no native APK.
- Must tolerate Fully Kiosk behaviors: scheduled reloads, screensaver/motion wake, "keep screen on," cached local content.
- **Auth secrets cannot live safely in the browser** → implies a small backend (or serverless function) holding the OAuth refresh token and minting calendar/weather reads.

---

## 3. Personas

**P1 — "The Organizer" (primary buyer/installer).** Tech-comfortable adult (the user, Ben). Sets it up once, links Google, mounts it. Wants it to *never break* and look premium. Cares about reliability and that auth never expires. Will tolerate a one-time config step; will not tolerate weekly re-linking.

**P2 — "The Household Glancer" (primary daily user).** Any family member, any age. Never configures anything. Walks by, glances, occasionally swipes between views or taps a day. Needs zero learning curve and large, legible information.

**P3 — "The Planner" (secondary).** An adult checking the week ahead or weekend weather while standing at the device. May tap into a day or an event for detail. Wants quick, accurate, color-coded answers — not to manage the calendar from the wall (they do that on their phone).

---

## 4. Prioritized Feature List (MoSCoW)

### MUST (MVP — without these the product fails its core promise)
- **M1. Durable Google auth (≥3 months unattended).** OAuth client published to **Production** status; **server-side refresh-token storage**; silent access-token refresh; the device never needs to re-link during normal operation. *(See §9 Risks for why this specifically fixes the 7-day bug.)*
- **M2. Read live Google Calendar events** for the linked account, across all selected calendars, for the visible date range.
- **M3. Month view** with a **daily agenda "ribbon"** (today's / selected day's events alongside the grid).
- **M4. Week view** with time-of-day layout of events.
- **M5. Weather view** (current + multi-day forecast) for a configured location.
- **M6. Swipe navigation** between the three views, with a clear current-view indicator.
- **M7. Color-coding by calendar / person**, consistent across all views.
- **M8. Always-on resilience:** auto-refresh of data on an interval; auto-recovery after reload/network blip; graceful "stale data" handling (show last-known + quiet indicator rather than a blank/error screen).
- **M9. Fixed-orientation, touch-first, ~9-inch-optimized layout** (large type, high contrast, glanceable).
- **M10. One-time setup/link flow** that an Organizer can complete from a phone/laptop, after which the device runs unattended.

### SHOULD (v1 — expected of a "premium" product)
- **S1. Tap a day → day detail** (full agenda for that day) from Month view.
- **S2. Tap an event → event detail** (title, time, location, description, which calendar).
- **S3. All-day & multi-day event rendering** done well in both Month and Week.
- **S4. Multiple calendars toggle / selection** (choose which Google calendars appear).
- **S5. "Now" line and auto-scroll to current time** in Week view.
- **S6. Per-person legend** (names + colors) visible/glanceable.
- **S7. Screensaver / dimming integration** that cooperates with Fully Kiosk (photo or clock screensaver when idle, wakes to calendar on motion/touch).
- **S8. Date/time header & live clock** persistent across views.
- **S9. Auto-return to "home" view** (e.g., Month/today) after N minutes of no interaction, so the wall display always resets to the most useful default.
- **S10. Settings screen** reachable but out of the way — now includes: calendar title (§4.1 F3), auto/manual theme + day/night theme pickers (F1), device-location toggle + manual weather fallback (F2), events-on-grid toggle + max-per-day (F4), ribbon position, week start, units, and per-calendar show/hide. *(Implemented.)*

### COULD (v2 — differentiators / nice-to-have)
- **C1. Lightweight event creation/quick-add** from the device.
- **C2. Chores / tasks checklist** (Skylight-style) — read/write a tasks list.
- **C3. Shared lists** (groceries/to-dos).
- **C4. Meal planning** lane.
- **C5. Photo screensaver from a shared album.**
- **C6. Today/agenda "ribbon" enhancements** (next event countdown, "free until…").
- **C7. Theming / light & dark auto-switch by time of day.** → **Promoted to MUST, see §4.1 F1 (implemented).**
- **C8. Multi-account or non-Google calendar support (e.g., iCal/Outlook).**
- **C9. Weather-driven smart hints** (e.g., "Rain at 3pm — bring an umbrella").

### WON'T (explicitly out of scope for now)
- **W1. Native Android app / Play Store distribution** — it's a web app in Fully Kiosk.
- **W2. Full calendar management / power-editing** rivaling the Google Calendar app — editing stays on phones.
- **W3. Multi-tenant SaaS / accounts for strangers** — this is a personal/household deployment.
- **W4. Video conferencing, smart-home dashboards, or general kiosk widgets** beyond calendar+weather.
- **W5. Offline-first full functionality** — graceful stale display is enough; no full offline editing.
- **W6. Premium "family hub" extras — cut by owner (2026-06-18):** photo/slideshow integration, chores, reward stars, to-dos/checklists, grocery/shopping lists, meal planning, AI event import, and voice control are **all out of scope**. This keeps the app permanently **read-only** on Google Calendar (no write scopes, no Google Tasks, no extra synced storage). Supersedes earlier COULD items C1–C5.

---

## 4.1 Owner Feedback — Locked Decisions (2026-06-18, v1.1)

These refine the MoSCoW above and are **implemented in the MVP build**. Each is user-configurable per the owner's "have options for all these things" instruction.

| # | Decision | Behavior | Setting |
|---|----------|----------|---------|
| **F1. Auto day/night theme** | Theme is **not** a single manual choice by default. The app **automatically uses a light theme during the day and a dark theme at night, switching at local sunrise/sunset** (sourced from the weather feed; falls back to fixed hours until weather loads). | Promotes old **C7** to **MUST**. Light themes: Paper, Daylight. Dark themes: Midnight, Graphite, Forest, Dusk. | "Auto day/night" vs "Manual"; separate **Day theme** + **Night theme** pickers; "Dim further at night" toggle. |
| **F2. Location from device** | Weather location is taken from the **tablet's own geolocation** automatically — the user does not type coordinates. | Replaces manual-entry-first weather location. Persists last fix for offline. | "Use this device's location" toggle; manual lat/lon/label fields shown only when off. |
| **F3. Custom app title** | The header shows a **configurable title** (e.g. "Ben & Kel's Calendar"), with the view name as a small sub-label. | New feature; default "Calendar". | Free-text "Calendar title" field. |
| **F4. Events drawn on the month grid** | The Month grid cells show **actual events** (not just dots): up to N single-day events per cell as time+title lines, and **multi-day / all-day events as horizontal bars that span columns and wrap across week rows**. Density is accepted as a tradeoff on the small screen; overflow collapses to "+N more". The agenda ribbon still shows full detail for the selected day. | Enhances **M3**. Lane-stacking prevents overlapping bars from colliding. | "Show events on the calendar grid" toggle; "Max events per day" (2/3/4); ribbon position (right/bottom). |

> Note on F1 vs. night-dimming: the in-app dark night theme is the primary night treatment; an optional extra dim layer is offered, and the tablet's Fully Kiosk backlight schedule (doc 06) remains the hardware-level complement.

---

## 5. The Three Core Views (Detailed Behavior)

> All three are **full-screen**, share a **persistent top header** (date, live clock, tiny connection/staleness indicator), and are reachable only by **horizontal swipe** in a fixed order: **Month ⇆ Week ⇆ Weather**. A small dot indicator (●○○) shows which of the three is active.

### 5.1 View 1 — Month + Daily Agenda Ribbon (the default/home view)
**Purpose:** the at-a-glance "what's this month and what's today" screen.
**Layout:** a month grid that fits the ~9-inch canvas, plus an **agenda ribbon** showing the full event list for **today** (or the selected day) so the most-needed info is always spelled out, not just dotted.
**Behavior:**
- Grid shows weeks of the current month; **today is clearly highlighted**.
- Each day cell shows events as **color-coded chips/dots** (color = person/calendar). Cells gracefully truncate ("+2 more") on busy days.
- **Tap a day** → that day becomes the selected day; the ribbon updates to its agenda *(SHOULD: also a fuller day-detail)*.
- **Ribbon** lists chronological events for the selected day with time, title, color; all-day events grouped at top.
- Returns to **current month / today** automatically after inactivity (S9).
- Vertical scroll allowed *within* the ribbon; horizontal swipe is reserved for switching views (see §6 for gesture disambiguation).

### 5.2 View 2 — Week
**Purpose:** the "plan the week / where do I need to be" screen.
**Layout:** 7 day-columns (configurable week start) with a time axis; events placed by start/end time, color-coded, overlapping events handled side-by-side.
**Behavior:**
- **All-day / multi-day events** rendered in a banner row at top, spanning columns.
- **"Now" line** across the current time; on open, **auto-scrolls to current time** (S5) so the relevant part of the day is visible without scrolling.
- Tap an event → event detail (S2).
- Current day column visually emphasized.
- Defaults to the current week; resets after inactivity.

### 5.3 View 3 — Weather
**Purpose:** the household's second-most-asked question.
**Layout:** large **current conditions** (temp, condition icon, feels-like, hi/lo) + a **multi-day forecast** strip (e.g., 5–7 days) and optionally an **hourly** strip for today.
**Behavior:**
- Location is set once in Settings (S10); defaults sensibly.
- Refreshes on an interval; shows last-updated quietly; never blanks on a fetch failure (M8).
- Units (°F/°C) follow Settings.
- *(v2 C9: surface a one-line weather hint tied to today's events.)*

---

## 6. Navigation Model

- **Primary navigation = horizontal swipe** across three full-screen views in fixed order **Month ⇆ Week ⇆ Weather**, with a persistent **3-dot indicator**. This is the entire top-level IA — no nav bar, no hamburger for the main flow.
- **Within a view:** vertical gestures and taps are local (scroll the ribbon, scroll the week's time axis, tap a day/event). **Horizontal swipe is always reserved for view switching** — to avoid gesture conflicts, scrollable regions scroll vertically only, and any horizontal-pan content (none in MVP) is excluded.
- **Date navigation within a view** (prev/next month/week): via **on-screen arrows / tap targets** rather than swipe, so swipe stays unambiguously "switch view." *(This is a deliberate decision to keep the gesture model dead simple for P2.)*
- **Drill-down:** tap day → day agenda; tap event → event detail; both dismiss back to the view (tap outside / back affordance).
- **Settings:** reachable from a small, deliberately understated affordance (e.g., long-press header or a corner gear), kept out of the glanceable surface so the household can't wander into it accidentally.
- **Inactivity reset (S9):** after N minutes, return to the home view (Month/today) and current date, and hand off to screensaver/dimming per Fully Kiosk (S7).

---

## 7. Success Metrics

| Metric | Target | How measured |
|--------|--------|--------------|
| **Unattended auth uptime** (primary) | **≥ 90 days with zero re-link**, goal indefinite | Days since last manual re-auth; alert if a re-link is ever needed |
| Data freshness | Calendar reflects changes within ≤ 5 min; weather within ≤ 30 min | Refresh interval logs |
| Display availability | App is showing live data ≥ 99% of waking hours | Heartbeat / last-successful-fetch timestamp |
| Crash/blank-screen rate | ~0 manual reboots needed per month | Reload & error logging |
| Glanceability | An adult can name today's events & weather from ~10 ft in <5s | Informal household usability check |
| Setup effort | One-time link completes in < 5 min, no repeats | Setup walkthrough |

---

## 8. Non-Goals

See **WON'T (W1–W5)** in §4. In short: not a native app, not a full calendar editor, not multi-tenant SaaS, not a general smart-home dashboard, and not offline-first. The product is intentionally a **read-mostly, household-scoped, web-based wall display** for calendar + weather.

---

## 9. Assumptions

- **A1.** A small backend (server or serverless function) is available to securely hold the OAuth **refresh token** and proxy Google Calendar + weather reads. *(Browser-only token storage is unsafe and was part of the prior fragility.)*
- **A2.** The Google Cloud project's OAuth consent screen can be moved to **Production** publishing status (it stays in test/internal-style use but published), which removes the **7-day refresh-token revocation** that applies to apps in **Testing** mode — this is the root-cause fix for the re-link pain.
- **A3.** The refresh token will be exercised at least every few months (the app polls constantly), so the only other Google expiry rule — invalidation after **6 months of non-use** — is never triggered.
- **A4.** One household Google account/calendar set is the source of truth; members keep their own calendars but expose them to it (shared or aggregated).
- **A5.** The tablet stays on the home Wi-Fi and powered; Fully Kiosk is configured for keep-screen-on, scheduled reload, and motion/idle screensaver.
- **A6.** A weather data provider with a free/cheap tier and a stable API is acceptable.
- **A7.** Fixed orientation (landscape assumed) and a single, known device profile (~11-inch, ~9-inch usable) define the responsive target.

---

## 10. Risks & Mitigations

| ID | Risk | Impact | Mitigation |
|----|------|--------|-----------|
| **R1** | **Google auth expires** (the prior killer) | Product unusable until manual re-link | Ship OAuth in **Production** (not Testing) → no 7-day revoke (A2); store refresh token server-side; refresh access tokens silently; keep token "used" so 6-month rule never fires (A3); **alert the Organizer** the instant a re-link is ever required so it's fixed before anyone notices |
| R2 | Refresh token still revoked (password change, >100 tokens, user revokes access, Google policy change) | Re-link needed | Detect `invalid_grant`, surface a clear on-device "re-link needed" state + remote alert to Organizer; minimize token churn (single stored token) |
| R3 | Fully Kiosk / WebView quirks (memory leaks, stale cache, frozen WebView over days) | Frozen or blank display | Scheduled daily reload; client watchdog/heartbeat; design for idempotent reload; never depend on long-lived in-memory state |
| R4 | Network blips / API outages | Stale or missing data | Cache last-known data; show quiet staleness indicator; never blank the screen (M8) |
| R5 | Gesture conflict (swipe-to-switch vs scroll/pan) | Frustrating navigation | Reserve horizontal swipe exclusively for view switching; vertical-only scroll regions; arrows for date nav (§6) |
| R6 | Small-screen legibility at distance | Fails core glanceability goal | Distance-first type scale, high contrast, color-as-primary-cue, ruthless truncation with "+N more" |
| R7 | Weather API cost/limits/deprecation | Weather view degrades | Provider-agnostic adapter; cache; pick a stable free-tier provider |
| R8 | Backend hosting cost / reliability | Whole app depends on it | Keep backend tiny (token proxy + read cache); choose low-cost always-on/serverless host; it's the single most reliability-critical component |
| R9 | Scope creep into Skylight-parity (chores/meals/lists) before core is rock-solid | MVP slips, auth/reliability under-baked | Strict MoSCoW; chores/meals/lists are **COULD/v2** only, after G1–G4 proven |

---

## 11. Phased Delivery Roadmap

### MVP — "It works and it never logs out" (MUST set, M1–M10)
**Theme:** durable auth + the three views, read-only, glanceable, always-on.
- Backend token proxy with **server-side refresh token**, OAuth client in **Production** (R1/A2) — *this is gate #1; nothing ships without it.*
- Read live calendar; **Month + agenda ribbon**, **Week**, **Weather** views.
- **Swipe** between the three; 3-dot indicator; persistent header/clock.
- Color-coding by person/calendar.
- Always-on resilience: interval refresh, auto-recovery, stale-data handling.
- ~9-inch landscape, touch-first, distance-legible layout.
- One-time link flow for the Organizer.
- **Exit criteria:** runs unattended on the wall for **2+ weeks with zero re-link**, no manual reboots, all three views showing live data.

### v1 — "It feels premium" (SHOULD set, S1–S10)
**Theme:** depth, polish, and the touches that make it feel like a commercial product.
- Day detail & event detail drill-downs; great all-day/multi-day rendering.
- Multiple-calendar selection & per-person legend.
- Week "now" line + auto-scroll to current time.
- Screensaver/dimming integration with Fully Kiosk; inactivity reset to home.
- Settings screen (weather location, units, time format, week start, theme, calendars).
- **Exit criteria:** auth uptime **≥ 90 days proven**; household can do all daily glances + drill-downs without help.

### v2 — "Skylight-class" differentiators (COULD set, C1–C9)
**Theme:** move from "calendar display" toward "family hub," only after core is rock-solid.
- Quick-add / lightweight event creation.
- Chores/tasks, shared lists, meal-planning lane (Skylight Calendar Plus-style).
- Photo screensaver from a shared album; theming & time-of-day light/dark.
- Agenda enhancements (next-event countdown, "free until…"); weather-aware hints.
- Optional non-Google calendar sources.
- **Exit criteria:** at least 2 differentiator features in daily use without regressing G1–G4.

---

## 12. Open Questions (to resolve before/while building)
1. Confirm backend host & where the refresh token is stored (cost vs. reliability — R8).
2. Confirm weather provider and its limits (R7).
3. Confirm exact device resolution/orientation to finalize the responsive target (A7).
4. Confirm how members' calendars are aggregated into the single linked account (A4).
5. Decide the inactivity reset timeout and screensaver content default (S7/S9).

---

## 13. Competitive Reference (product-level only)

These commercial digital family calendars (**Skylight / Skylight Calendar Plus, Dragon Touch, Calendar Plus**) set the bar this product is measured against. Relevant patterns we intentionally echo: **Google/Outlook sync, per-person color-coding, a clean glanceable wall display, and premium add-ons (chores, lists, meal planning, photo screensaver)** — the last group gated to **Calendar Plus**-style premium tiers. We deliberately match their *glanceable color-coded calendar + weather* core in MVP/v1 and treat their *chores/meals/lists* layer as our **v2 (COULD)** differentiators. A separate agent owns deep competitive analysis; this PRD stays product-level.

*Sources consulted:* [Skylight Calendar](https://myskylight.com/calendar/) · [Skylight Calendar Plus](https://myskylight.com/products/calendar-skylight-plus) · [Google OAuth 2.0 docs](https://developers.google.com/identity/protocols/oauth2) · [Fully Kiosk Browser](https://www.fully-kiosk.com/en/)
