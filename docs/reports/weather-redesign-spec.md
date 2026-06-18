# Weather View Redesign Spec

**Target:** Wall-mounted ~9" Android tablet, landscape, **1024 × 600**, viewed from across a room (~2–4 m). One of three swipeable kiosk views.
**Stack:** Svelte 5 + Vite. Themeable via CSS variables in `src/app.css` (6 named themes, dark + light).
**Files in scope:** `src/components/WeatherView.svelte`, `src/lib/weatherCodes.ts`, possibly `api/weather.ts` (one new field), and a new `src/lib/WeatherIcon.svelte`.

---

## 1. Blunt critique of the current view

The current `WeatherView.svelte` is functional but reads like a phone widget shrunk onto a wall display. From across a room it is mostly unreadable. Specific problems:

**Glanceability / distance legibility (the core failure).**
- The hero temp is `3.2rem` (~51px). On a 9" panel at 1024px viewed from 3 m, that is small. The single most important number on the screen should dominate, and it doesn't. It competes for visual weight with a 3.4rem emoji sitting right next to it.
- The 5-item stats block (Feels/High/Low/Wind/Humidity) is `0.85rem` with `0.7rem` uppercase labels (~11px). That is invisible from across the room. It's a dense phone-style grid, not a glance target.
- The 7-day list rows are `0.9rem` with day names in `4em` columns. Tiny, low-contrast (`--text-dim` / `--text-faint`), and evenly distributed with `justify-content: space-evenly`, so nothing is emphasized — every row has identical weight.

**Emoji icons (the worst offender visually).**
- Emoji render differently on every platform; on Android they'll be the system (Noto) set, which is flat, multicolor, and inconsistent in size and baseline. `☀️` vs `⛅` vs `🌧️` have wildly different visual footprints, so the hourly strip and daily list look ragged.
- Emoji ignore theme. They are always full-saturation multicolor and clash with all 6 themes (especially the muted sand/forest/light ones). You can't tint, stroke-match, or size-normalize them.
- Day/night handling is a hack: only a few codes have a `night` variant (`🌙`), so a "Partly cloudy" night still shows a daytime-ish glyph, and most precipitation codes have no night form at all.
- `❓` as the fallback is unacceptable on a premium wall display.

**Layout & hierarchy.**
- Three stacked sections (hero / hourly / daily) with `gap: 10px` and `padding: 4px 16px 8px` — cramped, no breathing room, and it doesn't use the 1024px width. The hero is a 3-column grid that leaves the right third as a tiny stats table while the bottom 7-day list is squeezed into leftover vertical space. The horizontal real estate of a landscape panel is wasted.
- `overflow-x: auto` on the hourly strip implies scrolling — but this is a **kiosk with no one standing at it**. Scrollable content is dead content. Everything must fit on screen, no scroll.
- Only 12 hourly cells at 52px — arbitrary, and they don't align to the daily section below.

**Data underuse.**
- We already fetch `sunrise`/`sunset` per day and never show them. For a home wall display, "sunset 8:31pm" is one of the most useful glanceable facts and it's thrown away.
- Precip probability is shown only as a bare number when `>= 10%` with no visual encoding (no bar, no color ramp), so you can't scan "when will it rain."
- `apparent` (feels-like) is buried as one of five equal stats rather than tied to the hero temp where it belongs.

**Verdict:** redesign, don't patch. Keep the data layer; rebuild the presentation around three zones with a real typographic hierarchy, replace emoji with a themeable inline-SVG icon set, and surface sunrise/sunset.

---

## 2. Redesign direction (summary)

A **three-zone landscape layout**: a large left **hero column** (~40% width) that you can read from the doorway — giant temperature, condition word, hi/lo and feels-like, location, and today's sunrise/sunset — paired with a right **detail column** (~60%) holding a clean **hourly strip** (top) and a **7-day forecast** (bottom). Replace all emoji with a small set of **stroke/fill inline SVG icons** that inherit theme color and have a day/night variant for every condition. Add **subtle day/night ambient theming** (a soft gradient wash behind the hero that shifts warm at dawn/dusk, cool at night) layered on top of the existing CSS-variable themes so it never fights the user's chosen palette.

---

## 3. Layout — ASCII wireframe (1024 × 600)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  HERO (≈410px wide)              │  DETAIL (≈614px wide)                          │
│                                  │  ┌──────────────────────────────────────────┐ │
│   ☀  (icon 132px)                │  │ HOURLY  (single row, 8 cells, no scroll) │ │
│                                  │  │  Now  1PM  2PM  3PM  4PM  5PM  6PM  7PM   │ │
│      72°            ← 150px      │  │   ☀    ☀    ⛅   ⛅   🌧   🌧   🌦   ☀     │ │
│   Partly Cloudy    ← 30px        │  │  72°  74°  75°  74°  71°  68°  66°  64°   │ │
│   Burlingame, CA   ← 20px        │  │  ░░    ░░   ▂    ▂   ▆██  ▆██  ▄▄   ░░     │ │ ← precip bars
│                                  │  └──────────────────────────────────────────┘ │
│   ┌─────────────────────────┐    │  ┌──────────────────────────────────────────┐ │
│   │ Feels 70°   H 78° L 61° │    │  │ 7-DAY  (rows, today emphasized)          │ │
│   │ ───────────────────────  │    │  │ Today  ⛅  ▁▁▁  ●40%   61°——78°          │ │
│   │ 🌅 6:42a   🌇 8:31p      │    │  │ Thu    ☀   ▁▁▁         59°——80°          │ │
│   │ Wind 6 mph  Humid 54%   │    │  │ Fri    🌧  ███  ●70%   55°——69°          │ │
│   └─────────────────────────┘    │  │ Sat    🌦  ▆▆▆  ●50%   57°——72°          │ │
│                                  │  │ Sun    ☀   ▁▁▁         60°——81°          │ │
│                                  │  │ Mon    ⛅  ▁▁▁         62°——83°          │ │
│                                  │  │ Tue    ☀   ▁▁▁         63°——84°          │ │
│                                  │  └──────────────────────────────────────────┘ │
└──────────────────────────────────┴────────────────────────────────────────────────┘
```

Root grid: `grid-template-columns: 410px 1fr;` `gap: 20px;` `padding: 24px 28px;` `height: 100%;`
Detail column: `grid-template-rows: auto 1fr;` `gap: 16px;` (hourly sized to content, 7-day fills remainder).
**No element scrolls. Everything fits 1024×600.**

---

## 4. Component breakdown, sizing & data binding

### 4.1 Hero (`.hero`, left column)
Vertical stack, left-aligned, generous spacing.

| Element | Source | Size (px) | Weight / color | Notes |
|---|---|---|---|---|
| Condition icon | `wxInfo(current.code, current.isDay)` | **120–140px** SVG | `currentColor` = `--text` | Single accent-tinted detail allowed (sun = `--today`/warm, rain drops = `--accent`). |
| Temperature | `round(current.temp)` | **140–160px**, line-height 0.9 | `700`, `--text`, `tabular-nums` | The dominant element on screen. Degree mark `°` at ~0.5em, no unit letter in hero. |
| Condition label | `wxInfo().label` | **28–32px** | `500`, `--text-dim` | e.g. "Partly Cloudy". |
| Location | `weather.label` | **18–20px** | `--text-faint`, letter-spacing 0.3px | |
| Stat card | see below | — | `--bg-elev` surface, `--radius-sm`, `16px` padding | Groups secondary facts into ONE quiet card so it reads as a unit, not noise. |

**Stat card rows** (3 lines, each line a labeled pair, ~17–18px value / ~12px uppercase label):
1. `Feels <apparent>°`  ·  `H <today.tempMax>°`  ·  `L <today.tempMin>°`
2. `🌅 <sunrise h:mm a>`  ·  `🌇 <sunset h:mm a>` (use SVG sunrise/sunset glyphs, not emoji) — from `daily[0].sunrise/sunset`
3. `Wind <windSpeed> <speedUnit>`  ·  `Humidity <humidity>%`

Feels-like is placed adjacent to H/L so the "how warm is it really" story is one glance.

### 4.2 Hourly strip (`.hourly`, detail top)
- **Exactly 8 cells**, equal-width via `display:grid; grid-template-columns: repeat(8, 1fr);` — **no horizontal scroll**, no fixed-px cells. Source: `weather.hourly.slice(0, 8)`.
- First cell label = **"Now"**; remaining labels = `hourLabel(h.time)` (e.g. "2PM").
- Each cell, top→bottom: time label (13px, `--text-dim`) / SVG icon (34–38px) / temp (20px, `600`) / **precip bar**.
- **Precip bar**: a fixed-height track (~22px tall, full cell width minus padding) with a fill whose height = `precipProb%`, color `--accent`, on a `--bg-elev-2` track. Show the `%` number (12px, `--accent`) only when `precipProb >= 20`. This turns rain timing into a scannable bar chart instead of stray numbers.
- Cells sit on the panel background (no individual card boxes) separated by subtle vertical hairlines (`--surface-line`) OR a single `--bg-elev` rounded container behind the whole strip. Prefer the container for a cleaner premium look.

### 4.3 7-Day forecast (`.daily`, detail bottom)
- 7 rows, `grid-template-rows: repeat(7, 1fr)` filling available height; each row is a grid:
  `grid-template-columns: 64px 40px 1fr 56px 132px;` → **[day name][icon][temp-range bar][precip pill][hi/lo numbers]**.
- Source: `weather.daily.slice(0, 7)`.

| Column | Source | Spec |
|---|---|---|
| Day name | `i===0 ? 'Today' : fmtWeekday(...)` | 18px; Today = `--text` `600`, others `--text-dim`. |
| Icon | `wxInfo(d.code)` | 26–28px SVG. |
| Temp-range bar | `tempMax`/`tempMin` over week min/max | Horizontal track with a colored segment positioned/sized to each day's range across the **week's** min–max (Apple-style). Cool end `--accent`, warm end `--today`. Strong glanceable "which days are hot/cold." |
| Precip pill | `d.precipProb` | Show pill (`●NN%`, `--accent` text) only when `>= 20`; else empty. |
| Hi/Lo | `tempMax`/`tempMin` | `H` bold `--text`, `L` `--text-faint`, right-aligned, `tabular-nums`, 18px. |

- **Today row** gets a subtle highlight: `background: --accent-soft; border-radius: --radius-sm;` to anchor the eye.
- Rows separated by 1px `--surface-line` hairlines (omit on the highlighted today row).

---

## 5. Icons — replace emoji with inline SVG

**Do not use emoji.** Build a small inline-SVG component so icons inherit theme color, normalize size/baseline, and support a night variant for every code.

**Recommended approach — one of:**
1. **Custom mini-set (preferred for control):** ~12 SVG primitives covering the WMO buckets: `clear-day`, `clear-night`, `partly-day`, `partly-night`, `cloudy`, `fog`, `drizzle`, `rain`, `sleet/freezing`, `snow`, `showers`, `thunder`. Stroke-based, `stroke="currentColor"`, `stroke-width≈2`, single accent fill allowed (sun disc, lightning bolt). 24×24 viewBox, scaled via CSS `width/height`. ~2–3 KB total inlined.
2. **Open icon set (faster):** **Meteocons** (https://bas.dev/work/meteocons, MIT) — has matching day/night SVGs per WMO-ish condition; ship the static (non-animated) SVGs to keep the kiosk calm. Alternatively `weather-icons` (Erik Flowers, SIL OFL) as an icon font, but inline SVG is cleaner for theming.

**Implementation:**
- New `src/lib/WeatherIcon.svelte` taking `{ code, isDay = true, size }`. It maps code→variant name and renders the matching inline `<svg>` with `currentColor`.
- Extend `src/lib/weatherCodes.ts`: replace the emoji `icon`/`night` strings with a stable `variant` key (e.g. `'rain'`, `'partly'`) plus `label`, **and a full night variant for every condition** (every code resolves to a day and a night glyph — no missing-night fallthrough).
- Replace all `{info.icon}` usages in `WeatherView.svelte` with `<WeatherIcon code={...} isDay={...} size={...} />`.
- Color rule: icons default to `currentColor` (inherits the zone's text color). The hero icon may tint its signature element with `--today` (sun) or `--accent` (precip) for a premium accent; keep secondary icons monochrome to avoid a rainbow grid.

---

## 6. Day/night theming & color

The 6 existing themes own the base palette — **do not override them**. Add a thin ambient layer driven by `current.isDay` and time-of-day relative to `daily[0].sunrise/sunset`:

- **Ambient wash:** a soft radial/linear gradient behind the hero only (`position:absolute; inset:0; opacity ~0.10–0.16; pointer-events:none`), composited over `--bg`.
  - Day (clear): warm-to-cool top glow.
  - Golden hour (within ~45 min of sunrise/sunset): warmer amber wash (lean on `--today`).
  - Night: cool deep-blue wash.
- Keep it **subtle** — a wall display runs 24/7; high-saturation backgrounds cause burn-in concern and look gaudy. Tints, not fills.
- All foreground colors stay on theme variables so contrast holds in light themes too.
- Accent usage: `--accent` for precipitation/cool, `--today` for sun/warm/highlight. Precip bars, precip pills, and the cold end of range bars use `--accent`; the today-row highlight uses `--accent-soft`.

---

## 7. Typographic scale (anchor for glanceability)

| Token | px | Use |
|---|---|---|
| `--wx-hero` | 150 | Hero temperature |
| `--wx-icon-hero` | 130 | Hero condition icon |
| `--wx-h1` | 30 | Condition label |
| `--wx-h2` | 20 | Hourly temp, daily hi/lo, day names, location |
| `--wx-body` | 17 | Stat-card values, sunrise/sunset |
| `--wx-icon-hour` | 36 | Hourly icons |
| `--wx-icon-day` | 27 | Daily icons |
| `--wx-cap` | 12–13 | Labels, %s, time captions (use sparingly) |

Use `tabular-nums` on every number so values don't jitter on refresh. Minimum on-screen text size **13px**; nothing smaller than the current `0.62–0.7rem` captions.

---

## 8. Data gaps / Open-Meteo changes

Everything in the wireframe is buildable from the **current** `WeatherPayload` **except UV index**:

- **`sunrise` / `sunset`** — already fetched per day, currently unused. **Just surface it.** No API change.
- **Feels-like / apparent** — already present (`current.apparent`). No change.
- **Precip probability (hourly + daily)** — already present. No change. (Note: daily `precipProb` is `precipitation_probability_max`, a *probability*, not an amount — label it as a % chance, never "in" of rain.)
- **UV index — NOT currently fetched.** If you want a UV chip in the hero stat card, add to `api/weather.ts`:
  - `&daily=...,uv_index_max` (and optionally `&current=...,` there is no current UV; use `daily.uv_index_max[0]`).
  - Add `uvMax: number` to `WeatherDay` in `types.ts` and map it in the proxy.
  - Render as `UV <round(uvMax)>` with a 0–11+ severity color (green→amber→red) in the stat card. **Flagged as optional / requires the new field.**
- **Daily precipitation amount** — also NOT fetched (only probability). Only needed if you'd rather show "0.3 in" than "%". Would require `&daily=...,precipitation_sum` + a `precipSum` field. Recommend **staying with probability** (simpler, already available, more glanceable for "will it rain"). Flagged.

---

## 9. Acceptance criteria

1. **No scrolling** in any zone; entire view fits 1024×600 with no clipped or cut-off content.
2. Hero temperature is the single largest element (~150px) and legible from ≥3 m.
3. **Zero emoji** in the rendered output; all weather glyphs are inline SVG via `WeatherIcon.svelte`, sized consistently, inheriting theme color, with a distinct day/night variant for **every** WMO code (no `❓` fallback shown for known codes; a neutral "unknown" SVG for the rest).
4. Hourly strip shows exactly 8 equal-width cells with a precip **bar** (not bare number), `%` shown only when ≥20.
5. 7-day forecast shows 7 rows filling the column height, with a temp-**range bar** scaled to the week's min/max, today row highlighted with `--accent-soft`.
6. Sunrise and sunset times are visible in the hero stat card.
7. Renders correctly across **all 6 themes** (dark + light): all text meets contrast on its surface; ambient day/night wash never reduces foreground contrast below readable.
8. All numeric values use `tabular-nums`; no layout shift on data refresh.
9. No element below 13px font size.
10. Day/night ambient wash is subtle (≤~0.16 opacity), driven by `current.isDay` + sunrise/sunset, and does not override the user's selected theme.

---

## 10. Suggested implementation order

1. Add `WeatherIcon.svelte` + refactor `weatherCodes.ts` to `{ label, variant, nightVariant }`.
2. Rebuild `WeatherView.svelte` markup to the two-column grid; wire hero, hourly (8-cell grid), 7-day (range bars).
3. Add precip bars, today-row highlight, sunrise/sunset, stat card.
4. Add the ambient day/night wash layer.
5. (Optional, needs API change) Add UV index to `api/weather.ts` + `types.ts` and render the UV chip.
6. Verify across all 6 themes at 1024×600 on the live kiosk.
