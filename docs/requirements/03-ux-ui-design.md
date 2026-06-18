# UX/UI Design Requirements & Specification
## Calendar Kiosk — Wall-Mounted 9" Android Tablet (Fully Kiosk Browser)

**Document:** 03-ux-ui-design
**Status:** Draft for development
**Target device:** ~9" Android tablet, wall-mounted, landscape, running Fully Kiosk Browser
**Reference quality bar:** Skylight Calendar, Calendar Plus

---

## 0. Context & Constraints

| Constraint | Value / Implication |
|---|---|
| Physical screen | ~9 inch diagonal, landscape, fixed orientation |
| Typical CSS viewport | ~1280 × 800 (declare layout in `vw`/`vh` + `clamp()`, never hard-coded px) |
| Pixel density | ~150–190 DPI — design in CSS px, supply assets at 2x |
| Viewing distance | Dual: **glance from across the room (3–5 m)** AND **touch up close (<0.5 m)** |
| Input | Capacitive touch only. No hover, no keyboard, no mouse, no right-click |
| Runtime | Always-on, 24/7, single page app, no chrome/URL bar (Fully Kiosk full screen) |
| Interaction frequency | Mostly read-only ambient glances; occasional touch |
| Risks | OLED/LCD burn-in, nighttime light pollution, stale data, network drops |

**Design tension to resolve everywhere:** the same pixels must be *readable across a room* (large type, high contrast, few elements) and *useful up close* (enough detail to plan a day). The resolution strategy is **progressive disclosure by proximity**: the glanceable layer is always legible at distance; detail layers appear only on touch.

---

## 1. Design Principles

1. **Glance first, detail on demand.** Every view must answer one question in <2 seconds from across the room ("what's today?" / "what's this week?" / "do I need a coat?"). Detail is one tap away, never required.
2. **Legible at distance beats dense.** When density and legibility conflict, legibility wins. Truncate, don't shrink below the distance-legible floor.
3. **Calm, ambient, premium.** No motion that demands attention, no notification badges screaming for action. It is furniture that informs, not an app that nags.
4. **Touch targets forgiving.** Assume a finger approaching a wall-mounted screen at an angle. Minimum 44×44 CSS px, preferred 56×56, generous spacing.
5. **Always-on aware.** The display lives 24/7. It must protect the panel (burn-in), respect the room (night dimming), and never show a frozen or lying screen.
6. **Honest state.** Always show data freshness. A stale or errored calendar must look different from a fresh one — never silently show old data as if current.
7. **Self-recovering.** No state requires a human to fix it. Errors retry; idle returns home; nothing gets "stuck" needing a tap to come back.

---

## 2. Information Architecture

### 2.1 Top-level structure

Three peer views, swipeable in a fixed linear order. There is no nested navigation, no menus, no settings reachable from the ambient UI (config lives behind a hidden long-press, see 3.4).

```
        ┌───────────┐   ┌───────────┐   ┌───────────┐
 swipe  │   MONTH   │ ⇄ │   WEEK    │ ⇄ │  WEATHER  │  swipe
        │  + ribbon │   │           │   │           │
        └───────────┘   └───────────┘   └───────────┘
             [1]             [2]             [3]
```

- Order is intentional: **Month (overview) → Week (this-week detail) → Weather (context)** — broad to narrow to ambient.
- **Default / home view = Month.** The app always idles back to Month at the start of "today."
- A persistent **page indicator** (3 dots) shows position. No back button needed — the model is flat.

### 2.2 Persistent global header (all views)

A thin top bar, identical across all three views to anchor the user:

```
┌────────────────────────────────────────────────────────────┐
│  Thursday          June 18              72°☀  ⟳ 2m   ● ● ●  │
│  large date        month context        weather  sync  pages│
└────────────────────────────────────────────────────────────┘
```

- **Left:** day-of-week + day number, the single largest glanceable element on screen.
- **Center:** month/year context (smaller).
- **Right cluster:** mini weather chip (current temp + icon, links to Weather view on tap), **sync freshness indicator** (⟳ + "Xm ago"), and the **3-dot page indicator**.
- Header height ≈ 10–12% of viewport. Same on every view so the user is never disoriented after a swipe.

### 2.3 Content map

| View | Primary content | Secondary (on tap) |
|---|---|---|
| Month | 5–6 week grid, event dots/chips, **today highlighted**, **daily ribbon** for selected day | Day detail overlay: full agenda for tapped day |
| Week | 7 day columns, timed events as blocks, all-day row, now-line | Event detail popover |
| Weather | Current conditions hero, hourly strip, 5-day forecast | (none — terminal view) |

---

## 3. Navigation & Gesture Model

### 3.1 Gestures

| Gesture | Action | Notes |
|---|---|---|
| **Horizontal swipe L/R** | Move between the 3 views | Primary navigation. Carousel paging, snaps to one view per swipe. Rubber-band at the ends (no wrap). |
| **Tap a day cell (Month)** | Select that day → loads it into the ribbon | Single tap; selection is sticky until idle reset |
| **Tap an event chip** | Open event detail overlay | Dismiss by tapping scrim or auto-dismiss after 20 s |
| **Tap mini-weather chip (header)** | Jump directly to Weather view | Shortcut across the carousel |
| **Tap a dot in the page indicator** | Jump to that view | Larger touch target than visual dot |
| **Vertical swipe (Week)** | Scroll the day timeline | Only where content overflows |
| **Long-press (3 s) top-right corner** | Open hidden admin/settings | Deliberately obscure; not discoverable by glance |
| **Any touch** | Wake from dim/screensaver to full brightness | See §11–12 |

**Gestures deliberately NOT used:** pinch-zoom (disabled), double-tap, two-finger gestures, edge swipes (reserved by Android/Fully). Keep the gesture vocabulary minimal — a family member or guest should succeed on the first try.

### 3.2 Tappable inventory (what is interactive)

Everything interactive must be visually distinguishable up close (slight elevation, rounded container, or clear affordance) without being noisy at distance.

- Day cells (Month), event chips (Month + Week), mini-weather chip, page-indicator dots, overlay scrim (to dismiss), overlay close button.
- **Non-interactive:** the ribbon itself (display only), grid lines, weather forecast tiles (terminal info), now-line.

### 3.3 Transitions

- View swipes: horizontal slide, **200–250 ms, ease-out**. No bounce, no parallax theatrics.
- Overlays: fade + 8 px rise, 150 ms. Scrim fades to 60% black.
- Day selection in ribbon: cross-fade ribbon content 180 ms — no layout jump.
- All transitions respect `prefers-reduced-motion` → instant.

### 3.4 Idle reset

After **90 s of no touch**, the app returns to the home state: Month view, today selected in the ribbon, any overlay dismissed. This keeps the ambient display predictable — anyone glancing at it always sees "today," never a stranded sub-screen.

---

## 4. Layout Wireframes

> All wireframes target the landscape canvas. Dimensions are proportional; implement with a CSS grid using `fr` units + `clamp()` type so layouts breathe across the 1024–1280 width range.

### 4.1 View 1 — Month grid + Daily Ribbon

The signature view. A month grid that gives the at-a-glance shape of the month, paired with a **right-hand daily ribbon** showing the full agenda for the selected day. This is the Skylight-class "see the month, read the day" pairing.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Thursday  18      June 2026          72°☀   ⟳ 2m       ● ○ ○         │ header
├───────────────────────────────────────────────┬──────────────────────┤
│  MON  TUE  WED  THU  FRI  SAT  SUN             │   THU 18              │
│ ┌────┬────┬────┬────┬────┬────┬────┐           │  ─────────────────   │  R
│ │  1 │  2 │  3 │  4 │  5 │  6 │  7 │           │  TODAY               │  I
│ │ •• │ •  │    │ •  │    │••• │ •  │           │                      │  B
│ ├────┼────┼────┼────┼────┼────┼────┤           │  ⬤ 09:00  Standup    │  B
│ │  8 │  9 │ 10 │ 11 │ 12 │ 13 │ 14 │           │      Ben · Zoom      │  O
│ │ •  │    │ •• │ •  │ •  │    │    │           │                      │  N
│ ├────┼────┼────┼━━━━┼────┼────┼────┤           │  ⬤ 12:30  Lunch w/   │
│ │ 15 │ 16 │ 17 │┃18┃│ 19 │ 20 │ 21 │  ← today  │      Sam · Cafe Rio  │  (selected
│ │••  │ •  │    │┃••┃│••• │ •  │    │  selected  │                      │   day's full
│ ├────┼────┼────┼━━━━┼────┼────┼────┤           │  ⬤ 16:00  Dentist    │   agenda)
│ │ 22 │ 23 │ 24 │ 25 │ 26 │ 27 │ 28 │           │      Dr. Lee         │
│ │    │ •  │ •  │    │ •  │    │    │           │                      │
│ ├────┼────┼────┼────┼────┼────┼────┤           │  ───────────────     │
│ │ 29 │ 30 │    │    │    │    │    │           │  + 2 more            │
│ └────┴────┴────┴────┴────┴────┴────┘           │                      │
└───────────────────────────────────────────────┴──────────────────────┘
        ~62–66% width (grid)                       ~34–38% width (ribbon)
```

Specifications:
- **Grid:** 7 columns × 5–6 rows. Weekday headers row is fixed and short. Each cell shows the **date number** (top-left) and **event indicators** below.
- **Event indicators in cells:** at room distance individual event text is unreadable, so cells use **color-coded dots** (one dot per event, max ~4 then a "+N" pip), colored by calendar. Up close these read as "how busy + whose." This is the density-vs-glanceability resolution for the grid: dots not text.
- **Today** cell: bold ring/filled accent (the strongest single emphasis in the grid).
- **Selected day** cell (defaults to today): heavier border + tinted fill so it's clear which day the ribbon mirrors.
- **Out-of-month days:** dimmed to ~35% opacity (still present for continuity).
- **Weekend columns:** very subtle background tint to aid week-shape scanning.
- **Ribbon (right):** see §6.

### 4.2 View 2 — Week

A timed week view for "what does this week actually look like." This is the planning view — denser, expected to be read up close more often.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Thursday  18      June 16–22         72°☀   ⟳ 2m       ○ ● ○         │ header
├──────────────────────────────────────────────────────────────────────┤
│       MON16  TUE17  WED18*  THU19  FRI20  SAT21  SUN22                 │ day cols
│ allday│[Trip ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓]      [Birthday ▓]                      │ all-day
│ ──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────               │
│  8 AM │      │ ▟▟▟  │      │      │      │      │                      │
│  9 AM │ ▓▓▓  │ ▓▓▓  │═════ │ ▓▓▓  │      │      │      ← now-line      │
│ 10 AM │ ▓▓▓  │      │ ▟▟▟  │      │ ▓▓▓  │      │                      │
│ 11 AM │      │      │      │      │      │      │                      │
│ 12 PM │ ░░░  │      │ ███  │ ░░░  │      │      │                      │
│  1 PM │      │      │ ███  │      │      │      │                      │
│  2 PM │      │ ▟▟▟  │      │ ▟▟▟  │      │      │                      │
│  ▼ scroll for evening                                                  │
└──────────────────────────────────────────────────────────────────────┘
   ▓ = Cal A   ░ = Cal B   █ = Cal C   ▟ = Cal D   (color-coded blocks)
```

Specifications:
- **7 day columns**, today's column highlighted (tinted background + bold header). Today's column may auto-scroll into a comfortable read position.
- **All-day row** pinned under the day headers; multi-day events span columns as a continuous bar.
- **Timed events** = color-coded blocks positioned by time, height ∝ duration. Show start time + title; truncate title with ellipsis. Overlapping events split the column width side-by-side.
- **Now-line:** a thin accent horizontal line with a left-edge dot at the current time, only on today's column. Auto-scroll so the now-line sits in the upper third.
- **Default visible window:** ~7 AM–9 PM (busiest hours); vertical swipe reveals earlier/later. A faint "▼ scroll" hint appears when content overflows.
- **Compressed mode:** if a day is empty all week for a time band, the band may visually compress — but keep the hour gridlines honest; never reorder time.

### 4.3 View 3 — Weather

Ambient context view — large, calm, glanceable. Lowest information density of the three.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Thursday  18      June 18           72°☀   ⟳ 2m       ○ ○ ●         │ header
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│        ☀                72°            Sunny                          │
│      (big icon)      (huge temp)    H 81°  ·  L 58°                    │ current
│                                     Feels 74° · Wind 6mph              │
│                                                                        │
│ ───────────────────────────────────────────────────────────────────  │
│  NOW   1PM   2PM   3PM   4PM   5PM   6PM   7PM   8PM   9PM            │ hourly
│   ☀     ☀     ⛅    ⛅    ☁     ☁     🌧    🌧    🌙    🌙            │
│  72°   74°   75°   74°   71°   68°   64°   61°   58°   56°            │
│ ───────────────────────────────────────────────────────────────────  │
│   THU      FRI      SAT      SUN      MON                             │ 5-day
│    ☀        ⛅       🌧       🌧       ☀                              │
│  81°/58°  79°/55°  70°/52°  68°/51°  77°/54°                          │
└──────────────────────────────────────────────────────────────────────┘
```

Specifications:
- **Current conditions hero:** oversized icon + temperature (the single biggest number anywhere in the app — readable across the room), with H/L and feels-like/wind as supporting text.
- **Hourly strip:** ~10 hours, horizontally laid out, icon + temp per hour. "NOW" labels the first column.
- **5-day forecast:** day + icon + high/low.
- Weather view doubles as a calm fallback when calendar data is unavailable (it depends on a different data source).
- Optional gentle background tint keyed to conditions (clear = warm, rain = cool blue, night = deep navy) — subtle, never compromising text contrast.

---

## 5. Typographic Scale & Hierarchy

Distance legibility drives type. Rule of thumb: at ~3 m, body text should be **≥24 CSS px**; primary glance numbers much larger. Use a single high-legibility variable sans (e.g. **Inter**, **SF Pro**, or **Roboto Flex**) with tabular figures for all times/dates/temps.

| Token | Size (CSS px @1280w) | Weight | Use |
|---|---|---|---|
| `display` | 64–88 | 700 | Current temp (Weather hero), today's day-number |
| `h1` | 40–48 | 700 | Header day-of-week, ribbon date |
| `h2` | 28–32 | 600 | Ribbon "TODAY", section labels |
| `body-lg` | 22–24 | 500 | Event titles in ribbon, event blocks |
| `body` | 18–20 | 500 | Times, secondary event meta |
| `caption` | 14–16 | 600 (uppercase, tracked) | Weekday headers, hour labels, sync status |
| `micro` | 12–13 | 600 | "+N more" pips, fine print |

Rules:
- Use **`clamp(min, vw-based, max)`** for fluid scaling across the width range.
- **Tabular/monospaced figures** for all numerals so times and temps don't jitter.
- Max **2 weights** visible per view; rely on size + color, not many weights, for hierarchy.
- Line length in the ribbon capped ~28–32 chars; truncate event titles with ellipsis (full text in detail overlay).
- Generous line-height (1.3–1.4) for distance reading.
- **Never** shrink below `body` (18 px) to fit more content — truncate or paginate instead.

---

## 6. The Daily Ribbon

The ribbon is the product's signature element: a vertical, chronological **agenda strip** on the right of the Month view that shows the **full day's events for the selected day** (defaults to today). It turns the month grid from "dots" into "a readable plan" without leaving the overview.

### 6.1 Anatomy

```
┌──────────────────────┐
│  THU 18              │ ← ribbon date header (matches selected cell)
│  TODAY  ·  3 events  │ ← context line: relative label + count
│ ─────────────────────│
│  ⬤ 09:00            │ ← color bar = calendar color
│     Standup          │    title (body-lg)
│     Ben · Zoom       │    meta: attendee/owner · location (body)
│                      │
│  ⬤ 12:30            │
│     Lunch w/ Sam     │
│     Cafe Rio         │
│                      │
│  ◐ NOW              │ ← optional "now" divider between past/upcoming
│ ─────────────────────│
│  ⬤ 16:00 Dentist    │
│  ⬤ 18:00 Soccer     │
│ ─────────────────────│
│  + 2 more            │ ← overflow pip → tap opens full day overlay
└──────────────────────┘
```

### 6.2 Behavior
- **Selected day drives it.** Tap any Month cell → ribbon cross-fades to that day. Idle reset → back to today.
- **Chronological**, top = earliest. Each entry: left **color bar/dot = calendar color**, time, title, one line of meta.
- **Past events** of *today* dim to ~50% and sit above a subtle **"NOW" divider**; next-up event gets a faint highlight. (For non-today selected days, no now-divider.)
- **Relative label** in the context line: "TODAY", "TOMORROW", or weekday name.
- **Empty day:** see §9.
- **Overflow:** show as many as fit at full legibility, then "+N more" → tap opens the full-day detail overlay (scrollable). Never shrink type to cram.
- The ribbon is **display-only** except the "+N more" pip and individual event taps (open detail).

---

## 7. Color System

### 7.1 Foundations (Day / default theme)

A near-neutral, high-contrast base lets the calendar colors carry meaning. Define everything as CSS custom properties so Day/Night/Dim swap one token set.

| Token | Day value | Role |
|---|---|---|
| `--bg` | `#0E1116` (deep charcoal) | App background — dark base reduces light pollution and makes color chips pop |
| `--surface` | `#171B22` | Cards, ribbon, blocks |
| `--surface-2` | `#1F242E` | Selected/today fills |
| `--text-primary` | `#F4F6F8` | Primary text (contrast ≥ 12:1 on `--bg`) |
| `--text-secondary` | `#A8B1BD` | Meta text (contrast ≥ 4.5:1) |
| `--grid-line` | `#2A313C` | Grid/dividers |
| `--accent` | `#4DA3FF` | Today ring, now-line, focus |
| `--accent-on` | `#0E1116` | Text on accent |
| `--danger` | `#FF6B6B` | Error/stale states |

> A **dark base UI** is chosen deliberately: it suppresses nighttime glare, is calmer as 24/7 ambient furniture, and gives saturated calendar colors maximum contrast. (A light theme may be offered as an admin option but dark is default.)

### 7.2 Multi-calendar color coding

Each calendar/person gets one identity color, used consistently across all three views (cell dots, week blocks, ribbon bars).

Palette designed for **distinguishability at distance** and **AA contrast against `--surface`**. 8-color set (degrade gracefully if more calendars exist by cycling with a pattern/initial):

| # | Name | Hex | Suggested for |
|---|---|---|---|
| 1 | Coral | `#FF6B6B` | Person A |
| 2 | Amber | `#FFB454` | Person B |
| 3 | Lime | `#A3E048` | Person C |
| 4 | Teal | `#2DD4BF` | Person D |
| 5 | Sky | `#4DA3FF` | Person E |
| 6 | Indigo | `#8B8CFF` | Person F |
| 7 | Magenta | `#E879C9` | Person G |
| 8 | Slate | `#9AA7B8` | Shared / misc |

Rules:
- Colors are **adjacent in hue spacing** to remain distinguishable for the most common color-vision deficiencies; reinforce with **owner initial / icon** on event chips so color is never the *only* signal (accessibility + distance).
- Color appears as a **left bar or dot**, not as the event's background fill text area, to preserve text contrast.
- **A small legend** (color ↔ name) is available in the day-detail overlay and admin, not cluttering the ambient views.
- Maintain a contrast floor: event title text always uses `--text-primary`, never the calendar color, so legibility is independent of the palette.

### 7.3 Contrast acceptance
- All text meets **WCAG AA** (≥4.5:1 body, ≥3:1 large). Primary glance elements target ≥7:1.
- Calendar dot/bar against its surface ≥3:1.

---

## 8. Density vs Glanceability

The explicit tradeoff per view (this is a first-class design decision, not an accident):

| View | Bias | How |
|---|---|---|
| **Month** | Glanceable | Dots not text in cells; detail offloaded to ribbon + overlay |
| **Week** | Balanced→dense | Color blocks with short titles; the "plan" view, read closer |
| **Weather** | Maximally glanceable | Huge hero, sparse forecast tiles |

Cross-cutting rules:
- **Hard legibility floor** (§5): nothing below 18 px; if it won't fit legibly, truncate or paginate.
- **Whitespace is a feature** — resist filling every pixel. Calm > crammed.
- **One primary focus per view** (today number / today column / current temp).
- Detail is always reachable in **one tap**, so the ambient layer can stay sparse.

---

## 9. Empty / Loading / Error / Offline States

Every state must be visually distinct and never look like a frozen or lying screen.

### 9.1 Loading (cold start / refresh)
- **Skeleton** placeholders matching final layout (grid cells, ribbon rows shimmer) — no spinner-only blank.
- Refreshes are **silent background** updates; only the header sync indicator animates (⟳ spins). Never blank the screen to refresh.
- Cold start budget: meaningful content < 3 s; if data lags, show skeleton + last-known cached data labeled stale.

### 9.2 Empty
- **Empty day (ribbon):** friendly, not blank — large check/sun glyph + "Nothing scheduled" + (optional) "Enjoy the day." Keeps the panel intentional.
- **Empty month area:** grid still renders (dates are never "empty"); cells simply show no dots.
- **Empty week:** show the grid with gridlines and a soft centered "No events this week."

### 9.3 Error / Stale
- **Calendar sync failed:** header sync indicator turns `--danger` and reads "Offline · last synced 14m ago." **Keep showing last-known data** (clearly labeled stale) rather than wiping it — a stale calendar is more useful than a blank one, *as long as it's labeled*.
- **Hard failure (no cache at all):** centered non-alarming card: icon + "Can't reach calendar — retrying…" with an auto-retry countdown. No dead end, no required tap.
- **Weather failed:** Weather view shows last value greyed with "Weather unavailable"; header weather chip hides rather than lying.
- **Auto-retry** with backoff (e.g. 30 s → 1 m → 5 m, cap 5 m). Recovery is automatic and silent; the indicator returns to normal.

### 9.4 Clock/timezone
- The "now" indicators (header date, now-line, TODAY) update at least every minute and at midnight roll the whole app to the new day automatically (re-select today, re-render month if month changed).

---

## 10. Today / Now Indicators

| Indicator | Where | Treatment |
|---|---|---|
| **Today (date)** | Header | Largest element; day-of-week + number |
| **Today cell** | Month grid | `--accent` ring or filled chip on the date number |
| **Selected day** | Month grid | Tinted fill + heavy border (defaults to today) |
| **Today column** | Week | Tinted column background + bold header |
| **Now-line** | Week (today col only) | Thin `--accent` line + left dot at current time, ~1 px, updates each minute |
| **NOW divider** | Ribbon (today only) | Subtle rule separating past (dimmed) from upcoming |
| **NOW label** | Weather hourly | First hourly column labeled "NOW" |

Consistency rule: `--accent` means "now/today" everywhere; never reuse it for a calendar color.

---

## 11. Day vs Night (Dim) Modes — Always-On Display

The display is on 24/7; brightness and palette must adapt so it's informative by day and unobtrusive at night.

| Mode | Trigger | Behavior |
|---|---|---|
| **Day** | ~07:00–21:00 (configurable, or ambient-light sensor if available) | Full brightness, default dark theme as specified |
| **Dim / Night** | ~21:00–07:00 | Reduce overall luminance ~40–60%, lower `--text-primary` to a softer white, desaturate calendar colors ~20%, dim accents. Content unchanged, just calmer/darker |
| **Deep night (optional)** | e.g. 23:00–06:00 | Minimal "night clock" — large dimmed time + date + tomorrow's first event only, very low brightness, to protect sleep and the panel |

Implementation notes:
- Mode is a **theme token swap** (CSS variables) + a CSS brightness/opacity layer; no relayout, so transitions are a smooth 600 ms cross-fade.
- Respect Fully Kiosk's own screen-brightness/scheduling where possible; the web app's dim mode is the *content* dim, complementing device backlight scheduling.
- Times are admin-configurable.

---

## 12. Screensaver / Photo Idle Mode & Burn-in Protection

To protect the panel and look premium when unused:

- **Idle photo/clock mode** after a configurable idle period (e.g. 5 min, layered *after* the §3.4 home reset). Two options:
  1. **Photo slideshow** (family photos) with a small overlay clock + date + next event ("Up next: Dentist 4:00"). Ken-Burns-slow, ≥20 s per image.
  2. **Minimal clock** screensaver (large time/date on near-black) if no photos configured.
- **Wake on any touch** → instant return to Month/home (§3.4), full brightness.
- **Burn-in protection (always-on, all views):**
  - Subtle **pixel-shift**: shift the whole layout by a few px on a slow cycle (e.g. every few minutes) so static elements (header, gridlines) don't etch in.
  - Avoid permanently static maximum-brightness elements; the dark theme already helps.
  - Screensaver imagery should drift/cycle, never hold one frame.
- Coordinate with Fully Kiosk: the web app can render its own screensaver, OR defer to Fully's screensaver/dim — pick one to avoid double-dimming; **recommend the web app owns idle visuals** (photos + next event) for the premium feel, and Fully handles only deep-night backlight.

---

## 13. Touch Targets & Ergonomics

- **Minimum** touch target: **44 × 44 CSS px** (Apple/Material floor). **Preferred: 56 × 56.**
- **Month day cells** are inherently large (grid ÷ 7 × ~5) — comfortably exceed the minimum; the whole cell is tappable, not just the number.
- **Event chips** padded to ≥44 px tall even if visual text is shorter (expand hit area, not visual).
- **Page-indicator dots:** small visual (8–10 px) but **48 px hit area** each.
- **Spacing ≥ 8 px** between independent targets to prevent mis-taps.
- **No reliance on hover** — no hover-only affordances, tooltips, or states.
- Account for a **wall-mounted angle**: targets near screen edges get extra padding (edge events are harder to hit on a vertical surface).
- Provide **immediate touch feedback** (≤100 ms): subtle scale/tint on press so the user knows the tap registered, important on a shared wall device.

---

## 14. Acceptance Criteria (developer-verifiable)

**Navigation & gestures**
- [ ] Horizontal swipe moves exactly one view; order is Month → Week → Weather; ends rubber-band (no wrap).
- [ ] Page indicator (3 dots) reflects current view; tapping a dot navigates to it.
- [ ] Tapping the header weather chip opens the Weather view from any view.
- [ ] Tapping a Month day cell updates the ribbon to that day within 250 ms with a cross-fade (no layout jump).
- [ ] Tapping an event opens a detail overlay; tapping the scrim or 20 s idle dismisses it.
- [ ] After 90 s no touch, app returns to Month + today selected, overlays closed.
- [ ] Pinch-zoom and double-tap-zoom are disabled.

**Layout & legibility**
- [ ] Layout renders correctly at 1024×768 through 1280×800 with no clipping or overlap (fluid `clamp()`).
- [ ] No visible text smaller than 18 CSS px in any ambient view.
- [ ] Current temp (Weather) and today's date (header) are the largest elements and legible at 3 m (≥56 px effective).
- [ ] Numerals use tabular figures (times/temps don't shift width as they change).

**Color & calendars**
- [ ] Each calendar's color is identical across Month dots, Week blocks, and ribbon bars.
- [ ] Event chips show owner initial/icon in addition to color (color is not the sole differentiator).
- [ ] All body text ≥4.5:1 contrast; large text ≥3:1; calendar dot/bar ≥3:1 against its surface (verify with a contrast checker).
- [ ] Day-detail overlay contains a color↔name legend.

**Today / now**
- [ ] Today cell, today column, and now-line are all visibly marked using `--accent`; `--accent` is not used as any calendar color.
- [ ] Now-line position and header time update at least once per minute.
- [ ] At local midnight the app rolls to the new day automatically (today re-selected, month re-rendered if needed) without manual interaction.

**States**
- [ ] Cold start shows skeleton layout, then content within 3 s (or cached+stale label if slower).
- [ ] Background refresh never blanks the screen; only the sync indicator animates.
- [ ] An empty day shows a friendly empty state, not a blank panel.
- [ ] On sync failure, last-known data remains visible and the header shows "Offline · last synced Xm ago" in `--danger`.
- [ ] Sync auto-retries with backoff and silently recovers the indicator on success.
- [ ] Weather failure greys last values / hides the header chip; it never displays a fabricated value.

**Always-on / idle**
- [ ] Day→Night dim transition fires on the configured schedule, reducing luminance and desaturating colors via a 600 ms cross-fade, with no relayout.
- [ ] Idle screensaver (photos+clock+next event, or minimal clock) activates after the configured idle period and exits on any touch within 300 ms back to Month/home.
- [ ] A pixel-shift cycle measurably offsets static layout over time (burn-in mitigation).
- [ ] Admin/settings is reachable only via the 3 s long-press in the designated corner and not discoverable from ambient UI.

**Touch ergonomics**
- [ ] All interactive elements have ≥44×44 px hit areas (≥48 for page dots) with ≥8 px separation.
- [ ] Every tap produces visible feedback within 100 ms.
- [ ] No interaction depends on hover.

**Motion**
- [ ] `prefers-reduced-motion` disables slide/fade animations (instant transitions) while preserving function.

---

## 15. Open Questions / Admin-Configurable

- Photo source for screensaver (local folder vs. cloud album).
- Ambient-light sensor availability on the chosen tablet (auto vs. scheduled dim).
- Light theme as an option (default remains dark).
- Week view default time window and start-of-week (Mon vs Sun).
- Number of calendars expected (drives palette-cycling strategy beyond 8).

---

## Sources
- [Skylight Calendar — Smart Family Calendar](https://myskylight.com/calendar/)
- [Skylight Calendar Max](https://myskylight.com/products/skylight-calendar-max-shadow-box-natural-aluminum-with-plus-plan)
- [Skylight Wall Calendar Review — Emma Taryn Jones](https://www.emmatarynjones.com/blog/skylight-wall-calendar-review-features-pros-cons)
- [Fully Kiosk Browser — official docs](https://www.fully-kiosk.com/en/)
- [Best Digital Family Calendars & Displays 2026 — Morgen](https://www.morgen.so/blog-posts/digital-family-calendar)
