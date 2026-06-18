# Typography & Legibility Report — Calendar Kiosk

**Device:** wall-mounted ~9-inch Android tablet, landscape ~1024×600, viewed both up close and glanceably from ~6–12 ft.
**Stack:** Svelte 5 + Vite. Type lives inline in each `src/components/*.svelte`; theme tokens in `src/app.css`.
**Owner request:** "Make the text slightly larger — not much, just a touch."

---

## TL;DR

Apply a **single global scale factor of ~1.08–1.10 (≈ +8–10%)** to the whole type system — a "touch," not a redesign. The cleanest way to ship this without editing every component is to set a **root font size** and convert the few `px`/hard `rem` anchors to scale with it, then graduate the densest roles (month in-grid event text, multi-day bars, week chips) with `clamp()` so they grow on the roomier 4-row layout but never overflow the tight cells. The **riskiest spots are the MonthView in-grid event text (`.ev` 0.62rem), the multi-day bars (`.bar` 0.6rem, fixed 14px tall), and the WeekView chips (`.ct`/`.cm`)** — these sit in fixed-height containers, so a naive bump clips text or pushes rows out; they must grow only as far as the new 4-row vertical budget allows.

---

## 1. Current type scale inventory

All sizes are `rem` unless noted (root = browser default 16px, so 1rem = 16px). Grouped by view.

### Header / top bar (`src/App.svelte`)
| Role | Selector | Current | px @16 |
|---|---|---|---|
| Clock | `.clock` | 1.5rem / 600 / tabular-nums | 24px |
| App title | `.app-title` | 1.1rem / 600 | 17.6px |
| View name (MONTH/WEEK) | `.view-name` | 0.62rem / uppercase / ls 2px | 9.9px |
| Settings gear | `.icon` | 1.3rem | 20.8px |
| Sync status | `StatusBar .status` | 0.72rem | 11.5px |
| Sync pip | `.pip` | 7px dot | — |
| Auth banner | `AuthBanner .banner` | 0.85rem / 600 | 13.6px |

### MonthView (`src/components/MonthView.svelte`) — densest view
| Role | Selector | Current | px @16 |
|---|---|---|---|
| Month/year title | `.mhead h2` | 1.15rem / 600 | 18.4px |
| Nav arrows ‹ › | `.nav` | 1.6rem | 25.6px |
| Weekday header (MON…) | `.dow` | 0.65rem / uppercase / ls 1px | 10.4px |
| **Day number** | `.num` | 0.78rem / 600 | 12.5px |
| **In-grid event text** | `.ev` | 0.62rem / lh 1.25 | **9.9px** |
| In-grid event time | `.ev b` | inherits 0.62rem / 600 | 9.9px |
| "+N more" | `.more` | 0.58rem | **9.3px** |
| **Multi-day bar** | `.bar` | 0.6rem / **fixed 14px tall** / lh 14px / #fff | **9.6px** |

Fixed geometry to respect: `.spacer` reserves `lanes × 16px`; `.bars` uses `grid-auto-rows: 14px`; `.bar` is `height:14px; line-height:14px`. These are the overflow chokepoints.

### DayRibbon — agenda ribbon (`src/components/DayRibbon.svelte`)
| Role | Selector | Current | px @16 |
|---|---|---|---|
| "TODAY" label | `.lbl` | 0.7rem / 700 / uppercase | 11.2px |
| Full date heading | `h3` | 1rem / 600 | 16px |
| Event title | `.t` | 0.92rem / 600 | 14.7px |
| Event meta (time·loc) | `.meta` | 0.74rem | 11.8px |
| Empty state | `.empty` | 0.9rem | 14.4px |

### WeekView (`src/components/WeekView.svelte`)
| Role | Selector | Current | px @16 |
|---|---|---|---|
| Range title | `.whead h2` | 1.1rem / 600 | 17.6px |
| "This week" | `.now` | 0.65rem / uppercase | 10.4px |
| Weekday (col head) | `.dow` | 0.6rem / uppercase | 9.6px |
| Day number (col head) | `.dnum` | 1rem / 700 | 16px |
| **Chip title** | `.ct` | 0.68rem / 600 | **10.9px** |
| **Chip time** | `.cm` | 0.6rem | **9.6px** |
| Empty "·" | `.none` | 0.8rem | 12.8px |

### WeatherView (`src/components/WeatherView.svelte`)
| Role | Selector | Current | px @16 |
|---|---|---|---|
| Big temp | `.temp` | 3.2rem / 700 / tabular | 51px |
| Weather icon | `.icon` | 3.4rem | 54px |
| Condition | `.cond` | 1rem | 16px |
| Location | `.loc` | 0.78rem | 12.5px |
| Stat values | `.stats` | 0.85rem / tabular | 13.6px |
| Stat labels | `.stats span` | 0.7rem / uppercase | 11.2px |
| Hourly hour | `.hl` | 0.68rem | 10.9px |
| Hourly icon | `.hi` | 1.3rem | 20.8px |
| Hourly temp | `.ht` | 0.85rem / 600 | 13.6px |
| Hourly precip | `.pp` | 0.62rem | 9.9px |
| Daily row | `.day` | 0.9rem | 14.4px |
| Daily icon | `.di` | 1.1rem | 17.6px |
| Daily precip | `.dp` | 0.7rem | 11.2px |

**Smallest text currently on screen:** `.more` 9.3px, `.bar` 9.6px / `.cm` / `.dow`(week), `.ev` 9.9px. At 6–12 ft, anything under ~11–12px is effectively a smudge for most viewers. These are the legibility losers and the items the bump should help most — within their geometry limits.

---

## 2. Recommended slightly-larger scale

### Strategy: one global lever + graduated dense roles

**A "touch" = ~+8–10% overall.** Rather than hand-edit 40 declarations, set a root size and let `rem`-based sizes ride it. Two mechanisms:

1. **Global lever** — bump `:root` font-size so every `rem` grows in lockstep.
2. **Density guards** — for the 3 fixed-geometry roles (in-grid events, bars, week chips) use `clamp()` and grow their *containers* in step, so they enlarge on the new 4-row layout but cap before overflow.

### Step 1 — global root bump (add to `src/app.css` `:root`)

```css
:root {
  /* 1.06–1.10 = "a touch". 1.0625 → 1rem = 17px. Start here, tune live on the tablet. */
  font-size: 106.25%;            /* 16px → 17px base; +6.25% everywhere rem is used */
  --type-scale: 1.0625;          /* documentation/handle for future tuning */
}
```

This alone lifts every `rem` value by 6.25% with zero per-component edits — clock 24→25.5px, ribbon title 14.7→15.6px, weather temp 51→54px, day numbers 12.5→13.3px, etc. **It does not touch the px-anchored geometry** (`.bar` height, `.spacer`, `.bars` rows), which is exactly what you want for a first, safe pass: text in flexible containers grows, fixed cells don't yet break.

If +6.25% reads as too timid on the wall, raise to `108.75%` (1rem = 17.4px, ≈ +8.75%) or `110%` (17.6px). Recommend **starting at 106.25% and judging from 8 ft**, then nudging.

### Step 2 — graduate the dense MonthView roles (uses freed vertical space from 6→4 rows)

With 4 rows instead of 6, each `.week` is ~50% taller, so cells can carry slightly bigger event text and a taller bar. Override these explicitly with `clamp()` (min = today's size so nothing ever shrinks; max = a deliberate ceiling):

| Role | Selector | Before | After (proposed) | Notes |
|---|---|---|---|---|
| Day number | `.num` | 0.78rem | `clamp(0.82rem, 1.6vh, 0.92rem)` | ~13.9→15.6px; grows with the taller row |
| In-grid event | `.ev` | 0.62rem | `clamp(0.66rem, 1.3vh, 0.74rem)` | ~11.2→12.6px — pulls it over the 11px floor |
| "+N more" | `.more` | 0.58rem | `0.64rem` | ~10.9px; small but acceptable for a count |
| Multi-day bar text | `.bar` | 0.6rem | `0.66rem` | ~11.2px |
| Bar height | `.bar` / `.bars` grid-auto-rows / `.spacer` | 14px / 14px / 16px | **16px / 16px / 18px** | grow the bar geometry in lockstep with text |
| Weekday header | `.dow` | 0.65rem | `0.7rem` | ~11.9px |
| Month title | `.mhead h2` | 1.15rem | (rides root) | no override needed |

Concrete edits in `MonthView.svelte`:
```css
.num  { font-size: clamp(0.82rem, 1.6vh, 0.92rem); }
.ev   { font-size: clamp(0.66rem, 1.3vh, 0.74rem); }
.more { font-size: 0.64rem; }
.dow  { font-size: 0.7rem; }
.bar  { font-size: 0.66rem; height: 16px; line-height: 16px; }
.bars { grid-auto-rows: 16px; }
.spacer { height: calc(var(--lanes) * 18px); }
.bars { top: 24px; } /* was 22px — keep bars clear of the larger day number */
```
**Do Step 2 only after the 6→4-row change ships.** On the current 6-row grid these sizes risk clipping; on 4 rows they fit comfortably.

### Step 3 — graduate WeekView chips (independent of row change, modest)

| Role | Selector | Before | After | Notes |
|---|---|---|---|---|
| Chip title | `.ct` | 0.68rem | `0.74rem` | ~12.6px; now comfortably readable |
| Chip time | `.cm` | 0.6rem | `0.66rem` | ~11.2px; over the floor |
| Col weekday | `.dow` | 0.6rem | `0.66rem` | ~11.2px |
| Day number | `.dnum` | 1rem | (rides root) | — |

Week columns scroll vertically (`.scroll.evs`), so taller chips reflow rather than overflow — lower risk than Month. Safe to ship with Step 1.

### Net effect
Nothing on screen ends up below **~11px**; the previously-sub-10px roles (`.ev`, `.bar`, `.cm`, `.more`, week `.dow`) all clear the at-a-distance floor, while large roles (clock, weather temp) grow proportionally and stay within their generous space.

---

## 3. Legibility issues beyond size (prioritized)

### P0 — fixes that matter most at distance

1. **Light-theme contrast on event bars/chips (white-on-color).** `.bar` (MonthView) and the agenda `.bar` use `color:#fff` over arbitrary Google event colors (`bar.ev.color`). On Paper/Daylight themes a pale event color (e.g. light yellow/green) gives white text near-zero contrast. The single `text-shadow: 0 1px 1px rgba(0,0,0,.35)` is not enough on light fills.
   **Fix:** pick bar text color by background luminance instead of always `#fff`. Add a helper:
   ```ts
   // luminance-based contrast pick
   export function onColor(hex: string): string {
     const c = hex.replace('#',''); const r=parseInt(c.slice(0,2),16),
       g=parseInt(c.slice(2,4),16), b=parseInt(c.slice(4,6),16);
     return (0.2126*r + 0.7152*g + 0.0722*b) > 150 ? '#1a1a1a' : '#fff';
   }
   ```
   Apply `color:{onColor(bar.ev.color)}` on `.bar` and on the ribbon item bar's adjacent text. Targets WCAG ≥ 4.5:1 for the small bar text.

2. **`--text-faint` is too low-contrast on light themes for real text.** Paper `--text-faint:#a39d90` on `--bg:#f5f2eb` ≈ ~1.9:1; Daylight `#97a3b2` on `#eef2f7` ≈ ~2.2:1 — both fail badly. It's used for `.view-name`, week `.dow`, `.more`, `.none`, sync status, weather `.loc`. Acceptable for decorative dots, **not** for words read at distance.
   **Fix:** darken the light-theme faint tokens — Paper `--text-faint: #8a8478` (→ ~3:1), Daylight `--text-faint: #7d8a9a`. Reserve `--text-faint` for truly secondary glyphs; promote any distance-read label (e.g. week `.dow`, `.more`) to `--text-dim`.

3. **Tabular numerals are inconsistent.** Clock, weather temps/stats, daily/weather rows correctly use `font-variant-numeric: tabular-nums`. **Day numbers** (`.num`, `.dnum`) and **in-grid event times** (`.ev b`, time chips) do **not** — numerals jitter and read unevenly in a grid of dates.
   **Fix:** add `font-variant-numeric: tabular-nums;` to `.num`, `.dnum`, and `.ev b` (and ideally a global rule for any date/time numeral). Cheap, sharpens the date grid noticeably.

### P1 — comfort and robustness

4. **Line-height on small dense text.** `.ev` is `1.25`; chip `.ct` `1.15`; ribbon `.t` `1.2`. For small text at distance, slightly looser leading aids word recognition. Where vertical budget now allows (Month 4-row, scrolling Week/ribbon), nudge multi-line-capable text to **1.3**. Keep single-line truncated rows tight.

5. **Truncation / ellipsis coverage.** Good: `.ev .evt`, `.bar`, chip `.ct`, ribbon `.t`/`.meta` all `text-overflow: ellipsis`. Gaps: **`.cond`** (weather condition) and **`.loc`** have no truncation — a long condition string ("Thunderstorm with heavy hail") can wrap/push layout in the fixed `.hero` grid. Add `overflow:hidden; text-overflow:ellipsis; white-space:nowrap;` to `.cond` and `.loc`. Also confirm `.bar` ellipsis is actually visible — at 14px height with `line-height:14px` the clipped glyph can swallow the "…"; the bump to 16px in §2 helps.

6. **Weight for legibility at distance.** Most labels are 600/700 — good. But the lowest-contrast + lightest-weight combos are the worst: week `.cm` (0.6rem, default 400, `--text-dim`) and `.more` (400, `--text-faint`). After the size bump, also lift these to **500–600** so thin strokes don't disappear at 10 ft.

7. **`--text-dim` on light themes — spot-check.** Paper `--text-dim:#6b675e` on `#f5f2eb` ≈ ~4.6:1 (OK for normal text, fine for ≥14px). Daylight `#5a6776` on `#eef2f7` ≈ ~5.2:1 (OK). These pass; no change needed, but note that after enlarging chip time/meta they're carrying more visual weight — acceptable.

### P2 — night mode and polish

8. **Night dimming compounds low contrast.** `html[data-night='on'] { filter: brightness(0.55) saturate(0.9); }` multiplies every contrast ratio down. Already-marginal faint text (P0 #2) becomes unreadable at night. After fixing the faint tokens, re-verify the night-on Paper/Daylight combos; consider a smaller brightness cut (e.g. 0.65) or skipping the dim on light themes (they're already low-glare).

9. **Minimum readable size policy.** Adopt a floor: **no text role below ~11px (≈0.7rem at a 16px root) for anything carrying words**; dots/pips/decorative glyphs exempt. After §2 this holds; codify it so future additions don't reintroduce sub-10px labels.

---

## Suggested rollout order

1. **Step 1 global root bump** (`106.25%`) + **P0 #1/#2/#3** (contrast + tabular nums). Ship together — safe on the current 6-row layout, biggest legibility win for least risk.
2. **Step 3 WeekView chips** + **P1 #5 truncation, #6 weight**.
3. **After 6→4-row Month change lands:** **Step 2** graduated Month sizes + bar geometry, then re-test overflow on a real device with a busy week.
4. **P2** night-mode contrast re-check.

Tune the root percentage live on the actual tablet from ~8 ft — it's a one-line dial, so iterate there rather than guessing.

---

### Files referenced
- `/Users/benjaminkohner/Desktop/Automations/New Calendar App/src/app.css` — tokens, themes, night filter
- `/Users/benjaminkohner/Desktop/Automations/New Calendar App/src/App.svelte` — header clock/title/status
- `/Users/benjaminkohner/Desktop/Automations/New Calendar App/src/components/MonthView.svelte` — day numbers, in-grid events, bars
- `/Users/benjaminkohner/Desktop/Automations/New Calendar App/src/components/WeekView.svelte` — chips
- `/Users/benjaminkohner/Desktop/Automations/New Calendar App/src/components/DayRibbon.svelte` — agenda ribbon
- `/Users/benjaminkohner/Desktop/Automations/New Calendar App/src/components/WeatherView.svelte` — weather scale
- `/Users/benjaminkohner/Desktop/Automations/New Calendar App/src/components/StatusBar.svelte`, `AuthBanner.svelte`
