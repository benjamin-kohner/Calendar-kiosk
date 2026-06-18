# Calendar Kiosk — Visual Polish & Beta Readiness Report

**Author:** Product Design + Polish lead
**Date:** 2026-06-18
**Scope:** Broader visual/product polish + beta roadmap. *Out of scope (already owned by owner): larger text pass, Month → 4-row "current + next 3 weeks" change, weather redesign.*
**Reference:** `docs/requirements/00-PRD-master.md` (§4 MoSCoW, §4.1, §5, §6)

---

## 0. Verdict

The app is **structurally sound and close to beta**. The architecture is clean, themes are real, offline/staleness handling is genuinely good, and the three-view swipe model is the right IA. What separates today's build from a "premium smart-display" feel is a layer of **polish details** (legibility at distance, spacing rhythm, the header, motion) plus a **handful of high-value behaviors** that the PRD already promised but that aren't built yet — most notably the **Week view is currently a 7-column agenda list, not the time-axis layout the PRD describes (§5.2)**, and there is **no idle reset, no event detail, and no screensaver/idle mode**.

Recommendation: ship a beta, but treat it as **"v1-lite"** — fold in a small, ruthless punch-list of polish fixes plus 3–4 cheap, high-impact features. Defer anything requiring a time-grid rebuild or write scopes.

A blunt note on the brief's framing: the brief lists "now-line in Week view" as a strong candidate. **It can't be added as-is** — the current Week view has no time axis to draw a line on. That's called out explicitly in §2 and the punch-list.

---

## 1. Visual-Polish Critique (with concrete fixes)

### 1.1 Legibility at distance (the core goal — G2/R6)
This is the most important critique. The PRD demands a **6–12 ft read** on a 9-inch canvas, yet much of the type is sized for a phone in the hand:

| Element | Current | Problem | Fix |
|---|---|---|---|
| Month grid event text (`.ev`) | `0.62rem` | Unreadable past ~3 ft | Floor body text at **0.8rem**; grid event lines at min **0.72rem** |
| "+N more" (`.more`) | `0.58rem` | Effectively invisible at distance | `0.7rem`, and use `--text-dim` not `--text-faint` |
| Spanning bar text (`.bar`) | `0.6rem`, 14px tall | Cramped | `0.72rem`, 18px lane height |
| Week chip title (`.ct`) | `0.68rem` | Borderline | `0.8rem` |
| DOW labels, view-name sub-label | `0.6–0.65rem` | OK as labels, but `--text-faint` is too low-contrast | Bump faint labels to `--text-dim` |

The owner's "slightly larger text" pass should explicitly **establish a minimum type floor** (nothing below ~0.72rem on the glanceable surface) rather than scaling everything up proportionally — the smallest items are the ones that fail the distance test.

**Contrast:** `--text-faint` is used for real information (status text, "+N more", weekday headers, location). On the light themes (`paper`, `daylight`) `--text-faint` is a pale grey on near-white — it will wash out under glare. Reserve `--text-faint` for decorative-only text; promote any *information* to `--text-dim`.

### 1.2 Spacing & rhythm
- **Inconsistent gutter padding.** Month uses `padding: 0 12px 8px`, Week `0 12px 8px`, Weather `4px 16px 8px`, the topbar `8px 16px`. Pick one horizontal page gutter (16px) and apply it consistently so the three views feel like one product when swiping.
- **Grid cell internals are tight** (`3px 4px 2px`). With the move to 4 rows the cells get taller — use the new vertical room to add breathing space (`6px`) and a slightly larger day number.
- **No consistent spacing scale.** Values are ad-hoc (1px, 2px, 3px, 4px, 6px, 8px, 9px, 10px, 12px, 16px). Introduce 3–4 CSS custom props (`--space-1..4`) and snap to them. Cheap, and it visibly tightens the whole UI.

### 1.3 Color
- **Per-calendar event colors print white text** (`.bar { color:#fff }`) regardless of background. A pale Google calendar color (e.g. light blue/yellow) + white text + the `paper` theme = unreadable bars. **Fix:** compute text color from bar luminance (white vs near-black), or add a subtle dark scrim. This is the single most likely "looks broken" bug on a light theme.
- **Two different "today" cues.** Month highlights today with `--today` (amber) filling the day number; Week outlines the column with `--today`; the selected day in Month uses `--accent` (blue) outline. Three different treatments for "current/selected." Acceptable, but document the rule: **amber = today, accent = your selection.** Make sure they never collide confusingly (today *and* selected).
- **Accent vs today amber** are both warm on some themes (`graphite`, `dusk`), reducing the today/selected distinction. Verify per-theme that the two are clearly different hues.

### 1.4 Motion
- Motion is currently **near-absent** except dot scale and the auth pulse. That's defensible for a kiosk (calm is good), but a few touches would read as "premium":
  - **Theme/day-night transition is a hard cut.** Add `transition: background-color .6s, color .6s` on `body` so sunrise/sunset and night-dim **fade** instead of snapping. High impact, near-zero effort.
  - **Selected-day change** in Month could cross-fade the ribbon content (100–150ms) rather than hard-swapping.
  - Keep everything ≤ ~300ms and ease-out; nothing bouncy on a wall display.
- **Night-dim via `filter: brightness(.55)`** is a heavy full-page filter applied to a WebView 24/7 — verify it doesn't cause compositing jank or burn-in patterns on the tablet. A dimming **overlay** (semi-transparent black layer) is often gentler than a brightness filter and animates more cheaply.

### 1.5 The header
- **The custom title is the household's identity and it's tiny** (`1.1rem`) and visually outranked by the clock (`1.5rem`). For a "Ben & Kel's Calendar" wall piece, the title should feel like the nameplate. Rebalance: title ~1.3rem semibold, clock can stay prominent but they should feel intentional, not competing.
- **The 3-column grid (`1fr auto 1fr`) will break with a long title** — a long custom title in the center column will collide with the clock and the status/gear cluster. Add `min-width:0` + ellipsis on the title, or move the title to the left and clock to a corner.
- **The gear is a raw `⚙︎` glyph** at `--text-dim`. Fine, but per §6 the settings affordance should be "deliberately understated" so the household doesn't wander in. Consider **long-press on the header** to open settings and making the visible gear even quieter (or only-on-touch), reducing accidental entry. At minimum, confirm the gear's tap target is ≥ 44px.
- **Status text + gear + clock** are three separate type treatments crammed at the right. Tighten into one quiet cluster.

### 1.6 The page-dot navigation
- **Dots are unlabeled** (`●○○`). A glancer can't tell *which* dot is Weather. For 3 fixed views, consider **tiny labels or icons under/beside the dots** (Month · Week · Weather) — it removes the only "what am I looking at" ambiguity in the IA. The view name already appears in the header, so this is optional, but labeled dots are more glanceable than the header sub-label.
- **Dots are small** (9px, scale 1.3 active) and low on the screen. Bump to ~11px and increase active contrast. Ensure each dot's **tap target is ≥ 44px** (pad the button, keep the visual dot small) — right now the clickable area is barely larger than the 9px dot.
- The dots sit in `padding: 10px 0 14px` of dead space at the bottom. With the 4-row month change you'll want that vertical budget back; consider a thinner dot bar.

### 1.7 Theme quality
- **6 themes is already more than a beta needs.** Quality > quantity. Recommend **auditing each theme against both content types** (dense month grid + white-text event bars) and **cutting any that fail**, rather than shipping 6 half-checked themes. `paper` + `midnight` (the defaults) must be flawless; the other four are "nice to have."
- **`.swatch span { mix-blend-mode: difference }`** in settings is a clever trick to keep theme names legible on any swatch bg, but `mix-blend-mode: difference` is fragile across WebView versions and can produce ugly mid-tones. Verify on the actual tablet; if it looks off, switch to an explicit light/dark text choice per swatch.
- Light themes need a **shadow/elevation pass** — on `paper`/`daylight`, `--bg-elev` (#fff) cells on a near-white page (#f5f2eb) have almost no separation. Add a hairline border or the defined `--shadow` to cells so the grid reads as a grid.

### 1.8 The agenda ribbon
- **Fixed 240px width** regardless of canvas. On a 9-inch landscape that's a big chunk; verify it doesn't starve the grid. Consider a fraction (`minmax(200px, 26%)`).
- **No "tap event for detail"** — the ribbon is the natural place for it (see §2, S2). Today the ribbon is read-only text.
- **Event rows truncate title to one line** (`white-space:nowrap`). The ribbon is the *one place* full detail should live (§5.1); allow titles to wrap to 2 lines here.
- **Empty state is a bare "No events"** in faint grey (see §1.9).
- The "Today" label only shows when the selected day *is* today (otherwise empty span). When you've tapped a future day, the ribbon header is just a date with no context. Add a relative label ("Tomorrow", "Sat") so it's always clear what you're looking at.

### 1.9 Empty states (currently the weakest polish area)
Empty states are an afterthought and they're what the display shows on quiet days/nights:
- **Ribbon empty:** "No events" in `--text-faint`. For a family display, a warm empty state ("Nothing scheduled — free day ✨" or a "Next event: …" line) is far more premium. **This is the single best home for the "next event / free until" indicator** (§2, C6).
- **Week empty column:** a single faint "·". Reads as a rendering bug, not "nothing planned." Replace with a quiet "—" baseline or nothing.
- **Weather loading:** plain "Loading weather…" — fine, but a skeleton/spinner reads better and the weather redesign should cover it.
- **No first-run / no-calendars state.** If calendars haven't loaded, the grid is just empty cells. A one-line "Connecting to Google…" tied to `calStatus === 'loading'` would prevent a "blank/broken" first impression (M8 spirit).
- **Auth banner** is good and appropriately loud — leave it.

---

## 2. PRD Deferred SHOULD/COULD — Beta vs Later

Judged on **value to a single-family wall display** vs **effort**, given **read-only, no new scopes**.

| Item | What | Value | Effort | Recommendation |
|---|---|---|---|---|
| **S9 — Idle reset to home/today** | After N min of no touch, return to Month/today & current date | **High** — the display must self-heal to the useful default after someone pokes it. MonthView already auto-follows the date rollover *only while `wasAutoFollowing`*; once someone navigates months, it never returns. | **Low** — one idle timer in `App.svelte` resetting view index + a "reset" signal to views | **BETA (Must).** Cheapest high-value item; directly serves the always-on promise. |
| **S2 — Tap event → detail popover** | Tap any event (grid/ribbon/week) → popover with title, time, location, description, calendar | **High** — the "Planner" persona (P3) explicitly wants this; it's the main reason to touch the display at all | **Medium** — one popover component + plumb event data + dismiss-on-outside-tap. Data is already fetched. | **BETA (Should).** Biggest single "feels finished" lift. Read-only, no scopes. |
| **C6 — "Next event / free until" indicator** | A line showing the next upcoming event or "free until 3pm" | **High** — answers the household's constant question at a glance; doubles as the ribbon's empty state | **Low–Med** — compute from already-loaded events; render in ribbon header/empty | **BETA (Should).** High value, reuses existing data, fixes the weak empty state. |
| **Week-of indicator** | Clearer "which week / week N" context | **Medium** — Week already shows a date range + "This week"; gap is small | **Low** — label polish | **BETA (Must, trivial).** Roll into the Week header polish; add "Next week"/relative labels. Not a standalone feature. |
| **S5 — "Now" line + auto-scroll in Week** | Time-axis now-line | **Medium** | **High** — **the current Week view has no time axis at all** (it's a 7-col agenda list). Delivering a true now-line means rebuilding Week into a timed grid — a significant layout job that fights the small canvas. | **LATER.** Don't rebuild Week for beta. Instead, in the agenda-list Week, **emphasize today's column and mark the next/in-progress event** — 90% of the value at 10% of the cost. Defer the real time-grid to post-beta. |
| **S7 — Screensaver / idle clock mode** | Dim clock/photo screensaver when idle | **Med-High** — a big "premium" signal; also reduces burn-in on an always-on panel | **Medium** — a full-screen clock+date (+weather) overlay after a longer idle, dismiss on touch. Photos are **out of scope** (W6), so do a **clock screensaver only**. Fully Kiosk also offers a hardware-level screensaver — decide whether to lean on that instead. | **BETA (Should) — clock-only, simple.** Pairs naturally with S9's idle timer (same timer, two stages: reset → screensaver). If time-boxed, ship S9 now and the clock screensaver as the first fast-follow. |
| **S1 — Tap day → fuller day detail** | Day detail beyond the ribbon | **Low** — the ribbon already *is* the day's full agenda for the selected day | **Med** | **LATER / SKIP.** Largely redundant with the ribbon. |
| **S6 — Per-person legend on-canvas** | Names+colors visible without opening settings | **Medium** — color-coding is only useful if you know whose color is whose | **Low** — a thin legend strip or fold names into event chips | **BETA (Should, if cheap).** A compact, collapsible legend (or initials on chips) makes the color system legible. Keep it tiny so it doesn't eat the glance surface. |
| **C9 — Weather hints** | "Rain at 3pm" | Low for beta | Med | **LATER.** Owner's weather redesign may revisit; not core. |
| C1–C5, C8 (quick-add, chores, lists, meals, non-Google) | — | — | — | **OUT (W6 / read-only).** Explicitly cut. Don't reconsider for beta. |

---

## 3. Prioritized BETA Punch-List

Scope rule for all of the below: **read-only, no new OAuth scopes, no Week time-grid rebuild.** Items are ordered so the cheap, high-impact work lands first.

### MUST (beta blockers — polish + the cheap behaviors)
1. **Legibility floor.** Establish a minimum type size (~0.72rem) on the glanceable surface; bump the smallest offenders (`.ev`, `.more`, `.bar`, Week `.ct`). Promote *information* text off `--text-faint` onto `--text-dim`. *(Coordinate with owner's text pass.)*
2. **Event-bar text contrast bug.** Compute bar/chip text color from background luminance (or add a scrim). Prevents unreadable pale-colored events, especially on light themes. **Functional, not cosmetic.**
3. **Light-theme cell separation.** Add a hairline border / shadow to grid cells and week columns so `paper`/`daylight` read as a grid, not a flat sheet.
4. **Idle reset to home/today (S9).** Single idle timer in `App.svelte`: after N min, swipe back to Month and reset anchor/selected to today. Directly serves the always-on promise.
5. **Consistent page gutter + spacing scale.** One horizontal gutter (16px) across all three views; introduce `--space-*` tokens and snap values.
6. **Header rebalance + long-title safety.** Make the title the nameplate; add `min-width:0`/ellipsis so long titles don't collide with clock/status/gear. Confirm gear and dot tap targets ≥ 44px.
7. **Week-of / relative-day labels.** "This week"/"Next week" in Week; "Today"/"Tomorrow"/weekday in the ribbon header so context is never ambiguous.
8. **Theme audit & cut.** Verify all 6 themes against the dense grid + colored bars; make `paper` + `midnight` flawless; cut any theme that fails rather than shipping it broken. Verify `mix-blend-mode` swatch trick on-device.

### SHOULD (strongly recommended for beta; ship in this order if time-boxed)
9. **Tap-event detail popover (S2).** One read-only popover reused by ribbon, grid, and week. Biggest "feels finished" lift.
10. **"Next event / free until" line (C6)** in the ribbon — doubles as the warm empty state. Fixes the weakest polish area with already-loaded data.
11. **Day/night + dim fade transition.** `transition` on `body` background/color so sunrise/sunset/dim fade instead of snapping. Tiny effort, real "premium" payoff. Verify the night-dim approach (overlay vs `filter`) for jank/burn-in on the tablet.
12. **Clock screensaver idle mode (S7, clock-only).** Reuse the S9 idle timer as a second, longer stage → full-screen dim clock+date(+weather), dismiss on touch. Photos stay out (W6). If time runs short, this is the natural first fast-follow.
13. **Warmer empty/loading/first-run states.** Ribbon empty, week empty column, and a "Connecting to Google…" first-run state tied to `calStatus`.
14. **Glanceable color legend (S6)** — compact names+colors (or initials on chips) so the color system is self-explanatory. Keep it small.

### LATER (post-beta — deliberately deferred)
- **Real Week time-axis + now-line + auto-scroll (S5)** — requires rebuilding Week from an agenda list into a timed grid; too big for beta. Interim: emphasize today's column and the next/active event in the existing list.
- **S1 fuller day-detail** — redundant with the ribbon.
- **C9 weather hints** — revisit with the weather redesign.
- **All write-scope features (C1–C5, C8)** — out per W6.

### Suggested beta cut line
Ship **MUST (1–8)** + **SHOULD 9, 10, 11** as the target beta. Items 12–14 are the fast-follow if the beta date is tight. Everything in LATER is explicitly post-beta.
