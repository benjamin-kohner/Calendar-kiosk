# 10 — Premium Features Specification

**Product:** Google-Calendar-backed family kiosk — wall-mounted ~9" Android tablet, 24/7 always-on.
**Views:** Monthly + agenda, weekly, weather.
**Goal:** Deliver the "premium feel" of Skylight / Dragon Touch / Calendar Plus / DAKboard, while keeping the build **read-focused** on Google Calendar and realistic for a personal project.
**Date:** 2026-06-18

---

## SCOPE DECISION — user, 2026-06-18 (overrides recommendations below)

The user reviewed this spec and **cut** the following features entirely (do not build, do not propose):
- ❌ Photos / slideshow integration
- ❌ Chores
- ❌ Reward stars
- ❌ To-dos / checklists (no Google Tasks `W1` scope needed)
- ❌ Groceries / shopping lists
- ❌ Meal planning
- ❌ AI event import
- ❌ Voice control

This collapses the auth ladder to **R0 (calendar read-only) + R1 (local-only state)** permanently — no W1/W2/R2. No write scopes of any kind.

The user **explicitly wants** (these become premium priorities):
- ✅ **Custom theming** — selectable color themes / palettes for the whole UI.
- ✅ **Custom layouts** — configurable view layouts / arrangement.
- ✅ **Auto-dim (day/night)** — but likely delegated to the tablet rather than built in app (see note below).

> **Auto-dim note:** Fully Kiosk Browser PLUS already has a scheduled day/night brightness/dimming feature and a screen-off timer (see `06-kiosk-deployment.md`). Recommendation: let **Fully handle the backlight** (zero code), and separately offer an in-app **dark/night theme** as part of custom theming (reduces emitted light + burn-in). So we do NOT need to build auto-dim *logic* — we need a dark theme + a Fully schedule.

Net MVP premium set: **custom theming, custom layouts, multi-calendar color coding, the daily agenda ribbon, today/now line, weather view, birthdays/holidays via subscribed calendars** — all read-only, all local config.

---

## 0. Guiding constraints (read this first)

The whole product thesis is **read-mostly**. The single hardest architectural decision is *whether a feature can live on a read-only Google Calendar token, or whether it forces us up the auth/storage ladder*. Every feature below is judged against that ladder:

### Auth & storage tiers (the cost ladder)

| Tier | What it unlocks | Cost / risk |
|------|-----------------|-------------|
| **R0 — Calendar read-only** (`calendar.events.readonly` / `calendar.readonly`) | All event display, multi-calendar, all-day vs timed, agenda, today line, birthdays/holidays via subscribed calendars | **Lowest.** "Sensitive" scope. OAuth consent screen + Google verification eventually, but no security assessment. This is our baseline. |
| **R1 — Local-only state** (on-device storage, no Google write) | Idle slideshow, clock/quote/"on this day", weather, avatars, view toggles, countdowns derived from events, *display-only* check-off that doesn't persist to Google | **Low.** No extra scope. State lives in the tablet (Room/SQLite/SharedPrefs). Risk: not synced to phones, lost on reset. |
| **R2 — Separate backend / synced store** (Firebase, Supabase, or self-hosted) | Chores with persistence across devices, shopping lists editable from phones, meal plans, reward stars | **Medium.** Real backend to run 24/7, auth, sync, cost. This is where "personal project" scope starts to strain. |
| **W1 — Google Tasks write** (`tasks` scope) | To-dos / checklists that round-trip with the user's existing Google Tasks | **Medium.** New scope + write access, but Tasks API is simple and free. No Calendar write needed. |
| **W2 — Google Calendar write** (`calendar.events`) | Create/edit/delete events from the kiosk, persist meal "events", chore events | **Highest.** "Restricted" scope → Google security assessment ($$$, annual) for a published app. **Avoid for a personal project** unless the app stays in "testing" mode for <100 users (our case — so technically usable, but flagged as the heaviest auth path). |

> **Rule of thumb for this project:** stay in **R0 + R1** for the MVP. Reach for **W1 (Google Tasks)** only for to-dos. Treat **R2** and **W2** as Phase 2+ and only if the value is proven. Flag every W2 feature loudly.

### Kiosk reality checks
- **Touch is available** (it's a touchscreen tablet) but the device is wall-mounted and shared — assume *glanceable, low-interaction* design. Heavy data entry happens on phones, not the wall.
- **24/7 always-on** → burn-in, idle/ambient mode, and nightly auto-refresh of tokens/data matter.
- **9" screen** is small. The legend, sidebar, and ribbon compete for space; not everything can be on-screen at once.

---

## 1. Feature catalog

Each feature: **what it does · data source · read/write · complexity · priority** (Must / Should / Could for a single-or-small-family use case).

Complexity scale: **S** (a day or two), **M** (a week-ish), **L** (multi-week / new subsystem).

---

### 1.1 Multi-calendar / per-person color coding & legend
- **What:** Pull several Google Calendars (Mom, Dad, Kids, Shared/Family, Holidays). Each calendar → a color. Render events in that color across month/week/agenda. Show a **legend** mapping color → person/calendar.
- **Data source:** Google Calendar (`calendarList.list` for the set + each calendar's events). Color can come from Google's per-calendar `backgroundColor`, or be overridden locally for better contrast on a small screen.
- **Read/Write:** **R0 read-only.** Color overrides are **R1 local**.
- **Complexity:** **M** — merging N event streams, dedupe, color mapping, legend UI.
- **Priority:** **MUST.** This is the #1 thing that makes a family calendar feel "premium" vs. a single-account viewer.

### 1.2 All-day vs. timed event rendering
- **What:** All-day events render as full-width banners/chips at the top of a day; timed events render in time order (and on a time grid in week view). Multi-day all-day events span across cells.
- **Data source:** Google Calendar (`start.date` = all-day; `start.dateTime` = timed).
- **Read/Write:** **R0 read-only.**
- **Complexity:** **M** — multi-day spanning and overlap layout are the fiddly parts.
- **Priority:** **MUST.** Core correctness; competitors all do this and its absence reads as "cheap."

### 1.3 Daily agenda "ribbon" / detail strip
- **What:** A focused strip (usually for **today**, optionally a tapped day) listing that day's events in order with time, title, person color, and location — the "what's happening today" panel beside the month grid. Skylight's hero view.
- **Data source:** Google Calendar (filtered to selected day).
- **Read/Write:** **R0 read-only.**
- **Complexity:** **S–M.**
- **Priority:** **MUST.** Highest glance value on a wall.

### 1.4 Today / now line
- **What:** Highlight today's cell in month view; in week/day view draw a moving horizontal "now" line at the current time; auto-scroll week view to current time.
- **Data source:** Local clock.
- **Read/Write:** **R1 local** (no network).
- **Complexity:** **S.**
- **Priority:** **MUST** for week view, **SHOULD** for month (cell highlight is trivial).

### 1.5 Weather on calendar + weather view
- **What:** Dedicated weather view (current + multi-day forecast) **and** a small weather icon/high-low overlaid on each upcoming day in the calendar — the DAKboard "correlate weather with events" touch.
- **Data source:** Third-party weather API (Open-Meteo = free/no-key, recommended; or OpenWeather). **Not Google.**
- **Read/Write:** **R1 local** (read external API, cache locally). No Google scope.
- **Complexity:** **S** standalone view; **M** to overlay per-day in the grid (layout + only ~7–10 day forecast horizon).
- **Priority:** **MUST** (weather view is already in scope); per-day overlay is **SHOULD.**

### 1.6 Birthdays / holidays / iCal subscriptions
- **What:** Show birthdays, public holidays, sports schedules, school calendars, etc. on the grid.
- **Data source:** **Google Calendar's own subscription mechanism.** The user subscribes to holiday/birthday/iCal feeds *inside Google Calendar*; they then appear as additional calendars in `calendarList`. We just read them like any other calendar.
- **Read/Write:** **R0 read-only.** (Zero extra work for us — the user does the subscribing in Google.)
- **Complexity:** **S** (it's just more calendars + legend entries).
- **Priority:** **MUST** — essentially free given 1.1, high perceived value.

### 1.7 Recurring routines / repeating events
- **What:** Daily/weekly routines (morning routine, trash day, practice) shown reliably, including exceptions ("this week soccer is Thursday").
- **Data source:** Google Calendar. **Critical:** request events with `singleEvents=true` so the API expands RRULEs and exceptions for you. Do **not** hand-parse RRULE.
- **Read/Write:** **R0 read-only.**
- **Complexity:** **S** if you use `singleEvents=true` (Google does the expansion). **L** if you foolishly parse recurrence yourself — don't.
- **Priority:** **MUST** (correctness; recurring events are most of a family calendar).

### 1.8 Reminders & countdowns
- **What:** "Christmas in 12 days," "Grandma visits in 3 days" — countdown chips/widgets for upcoming notable events; optional gentle on-screen reminder for the next event.
- **Data source:** Derived from Google Calendar events (e.g., events on a "Countdowns" calendar, or events tagged in title). No push notifications (it's a wall display — *show*, don't *notify*).
- **Read/Write:** **R0 read-only** for the data; countdown math is **R1 local.**
- **Complexity:** **S.**
- **Priority:** **SHOULD.** Cheap, delightful, very "premium," but not core.

### 1.9 Chores & task lists / to-dos
This is the feature most responsible for the Skylight "premium" feel — and the most auth-expensive. Split it:

- **(a) Simple to-do checklists (Google Tasks-backed)**
  - **What:** Display the family's Google Tasks lists; check items off from the wall.
  - **Data source:** **Google Tasks API.**
  - **Read/Write:** Read = `tasks.readonly` (**R0-equivalent**). Check-off = **W1 (`tasks` write scope).**
  - **Complexity:** **M.**
  - **Priority:** **SHOULD** (read), **COULD** (write/check-off).

- **(b) Per-person chore charts with reward stars** (Skylight's signature)
  - **What:** Assign chores to family members, recurring schedules, kids tap to complete, earn stars toward rewards.
  - **Data source:** Needs structured per-person state, star balances, reward definitions — **does not fit Google Calendar or Tasks cleanly.** Needs **R2 separate backend** to sync with phones (or **R1 local** if wall-only and non-synced).
  - **Read/Write:** **R2** (synced) or **R1** (local-only).
  - **Complexity:** **L.**
  - **Priority:** **COULD** (Phase 2). High wow-factor, high cost. The honest call for a personal project: do **local-only** if at all, and only if there are kids who'll use it.

### 1.10 Meal planning
- **What:** Assign meals to days; show this week's dinners; optionally import recipes.
- **Data source:** Two viable paths:
  - **Cheap path (recommended):** a dedicated **"Meals" Google Calendar** — each dinner is an all-day event ("🍝 Spaghetti"). **R0 read-only** to display; user enters meals from their phone's Google Calendar. Near-zero build cost, reuses everything.
  - **Premium path:** structured meal DB + recipe import → **R2 backend** or **W2 calendar write.**
- **Read/Write:** **R0** (cheap path) vs **R2/W2** (premium path).
- **Complexity:** **S** (cheap path) / **L** (premium path).
- **Priority:** **SHOULD** via the cheap calendar path; recipe import is **COULD / Phase 3.**

### 1.11 Shopping / grocery lists
- **What:** A shared grocery list visible on the wall, editable from phones.
- **Data source:** Editable-from-phone is the whole point, so a wall-local list is nearly useless. Options:
  - **Google Tasks** as the list store (**W1** to check off; reuses 1.9a plumbing).
  - **R2 backend** for a richer list.
  - Integrate an existing app (AnyList/Bring) — out of scope, third-party APIs are messy.
- **Read/Write:** **W1 (Tasks)** or **R2.**
- **Complexity:** **M.**
- **Priority:** **COULD.** Real value only once phones can edit it → don't do it wall-local.

### 1.12 Photo screensaver / ambient slideshow (idle mode)
- **What:** After N minutes idle, fade into a full-screen photo slideshow (optionally with a small clock/next-event overlay). Tap to wake. Also doubles as **burn-in protection** for 24/7 use.
- **Data source:** **Local photos on device**, or a folder synced from Google Photos/Drive. **R1 local** if photos are side-loaded; reading Google Photos via API is heavier (separate scope, and Google Photos API access has tightened) — prefer a synced local folder.
- **Read/Write:** **R1 local.**
- **Complexity:** **M** (idle detection, fade transitions, wake; clean Android lifecycle handling for 24/7).
- **Priority:** **SHOULD.** Big premium feel, doubles as burn-in protection, no Google scope. Strong MVP candidate if time allows.

### 1.13 Family member avatars / profiles
- **What:** Each person has a name, color, and avatar/photo; events show the assignee's avatar; legend shows faces not just colors.
- **Data source:** **R1 local** config (map a Google calendar → person name/color/avatar image on device).
- **Read/Write:** **R1 local.**
- **Complexity:** **S–M.**
- **Priority:** **SHOULD.** Cheap, big contribution to "family" warmth; pairs naturally with the 1.1 legend.

### 1.14 "On this day" / quote / clock widgets
- **What:** Ambient widgets — large clock, daily inspirational quote, "on this day in history," date.
- **Data source:** Clock = local. Quote/on-this-day = small bundled list **or** free API (cache daily). **R1 local.**
- **Read/Write:** **R1 local.**
- **Complexity:** **S.**
- **Priority:** **COULD** (clock is basically free and worth including; quote/on-this-day are nice-to-have flavor).

### 1.15 Quick controls
- **What:** On-screen controls to switch views (month/week/weather), jump to today, toggle slideshow, refresh/sync now, brightness/night-dim schedule.
- **Data source:** **R1 local** (UI + local settings). Night-dim is important for a 24/7 bedroom/kitchen wall.
- **Read/Write:** **R1 local.**
- **Complexity:** **S–M.**
- **Priority:** **MUST** for view switching + today + sync; **SHOULD** for night-dim/brightness schedule.

---

## 2. Summary matrix

| # | Feature | Data source | Auth tier | Complexity | Priority |
|---|---------|-------------|-----------|------------|----------|
| 1.1 | Multi-calendar color coding + legend | Google Cal | R0 (+R1 overrides) | M | **MUST** |
| 1.2 | All-day vs timed rendering | Google Cal | R0 | M | **MUST** |
| 1.3 | Daily agenda ribbon | Google Cal | R0 | S–M | **MUST** |
| 1.4 | Today / now line | Local clock | R1 | S | **MUST** (week) |
| 1.5 | Weather view + on-calendar | Weather API | R1 | S–M | **MUST** / SHOULD overlay |
| 1.6 | Birthdays / holidays / iCal | Google Cal subs | R0 | S | **MUST** |
| 1.7 | Recurring routines | Google Cal (`singleEvents`) | R0 | S | **MUST** |
| 1.8 | Reminders & countdowns | Google Cal derived | R0 + R1 | S | SHOULD |
| 1.9a | To-dos (Google Tasks) | Google Tasks | R0 read / **W1** write | M | SHOULD / COULD |
| 1.9b | Chore charts + reward stars | Separate store | **R2** or R1-local | L | COULD (P2) |
| 1.10 | Meal planning | "Meals" Google Cal | R0 (cheap) / R2 (rich) | S / L | SHOULD (cheap path) |
| 1.11 | Shopping / grocery lists | Google Tasks / backend | **W1** or **R2** | M | COULD |
| 1.12 | Photo slideshow / idle mode | Local photos | R1 | M | SHOULD |
| 1.13 | Avatars / profiles | Local config | R1 | S–M | SHOULD |
| 1.14 | On-this-day / quote / clock | Local + small API | R1 | S | COULD |
| 1.15 | Quick controls | Local | R1 | S–M | **MUST** (core) |

**Auth tier legend:** R0 = Calendar read-only · R1 = local-only · R2 = separate synced backend · W1 = Google Tasks write · W2 = Google Calendar write (avoid).

---

## 3. Recommended feature set by phase

### MVP (Phase 1) — "premium read-only family calendar"
Everything here lives in **R0 + R1**. No Google write scope, no backend.
- **1.1** Multi-calendar color coding + legend
- **1.2** All-day vs timed rendering
- **1.3** Daily agenda ribbon
- **1.4** Today / now line
- **1.5** Weather view (+ per-day overlay if time)
- **1.6** Birthdays/holidays/iCal (via Google subscriptions)
- **1.7** Recurring routines (`singleEvents=true`)
- **1.13** Avatars/profiles (pairs with the legend)
- **1.15** Quick controls (view switch, today, sync, **night-dim**)

This set alone already out-glances a basic calendar app and delivers most of the Skylight "feel" without touching write scopes.

### Phase 2 — "ambient + light interaction"
- **1.12** Photo slideshow / idle mode (also burn-in protection — high ROI, no scope)
- **1.8** Reminders & countdowns
- **1.10** Meal planning via the **"Meals" Google Calendar** cheap path (still R0)
- **1.9a** To-dos: **read** Google Tasks (still R0-equivalent); add **W1 check-off** only if wanted
- **1.14** Clock/quote/on-this-day ambient widgets

### Phase 3 — "full premium, only if proven worth the cost"
- **1.9b** Chore charts + reward stars → **local-only first**; synced (**R2**) only if a real backend is justified
- **1.11** Shopping lists (Google Tasks **W1**, so phones can edit)
- **1.10** Meal planning premium path / recipe import (**R2**)

---

## 4. Flags & honest cautions (per the brief)

- **Avoid Google Calendar WRITE (W2 / `calendar.events`):** it's a *restricted* scope requiring a Google security assessment for any published app. For a personal project keep the OAuth app in **testing mode (<100 users)** and **read-only** — or you sign up for annual paid CASA audits. Every feature above is deliberately reachable without W2.
- **Backend storage (R2) is the real scope-creep risk**, not the auth. Chore stars, rich meal plans, and rich shopping lists all need a synced store you must run 24/7. Default to **local-only** or a **Google-Calendar/Tasks-as-database** trick before standing up Firebase/Supabase.
- **Google Tasks (W1) is the *only* write scope worth taking** for this project: free, simple, non-restricted, and it round-trips with tools the family already uses for to-dos and groceries.
- **Use `singleEvents=true` + `timeMin/timeMax`** on every events query. It makes recurrence and exceptions Google's problem, not yours, and collapses 1.7 from L to S.
- **Google Photos API is heavier than it looks** (tightened access, separate scope). For the slideshow, sync a **local folder** (Drive/Photos backup to device) and read files locally — stay in R1.
- **Burn-in & 24/7:** the idle slideshow + night-dim aren't just premium polish; on an always-on wall tablet they're effectively *required* for hardware longevity. Prioritize them earlier than their "SHOULD" rating implies if the panel is OLED.
- **Small screen:** the legend, agenda ribbon, weather overlay, and any sidebar all compete for ~9". Plan a layout where ambient widgets (clock/quote/slideshow) own the *idle* state and the calendar owns the *active* state, rather than cramming everything simultaneously.

---

## Sources
- [Skylight Calendar Plus subscription](https://myskylight.com/products/calendar-skylight-plus)
- [Skylight — Manage chores and family tasks](https://myskylight.com/how-to-manage-chores-and-family-tasks-with-skylight-calendar/)
- [Skylight — Meal planning](https://myskylight.com/how-to-meal-plan-with-skylight-calendar-time-saving-tips-for-families/)
- [DAKboard site](https://dakboard.com/site) · [DAKboard custom layouts / blocks](https://blog.dakboard.com/announcing-dakboard-custom-layouts/)
- [Google Calendar API — choose scopes](https://developers.google.com/workspace/calendar/api/auth)
- [Google Calendar API — Events: list (`singleEvents`, `iCalUID`)](https://developers.google.com/workspace/calendar/api/v3/reference/events/list)
