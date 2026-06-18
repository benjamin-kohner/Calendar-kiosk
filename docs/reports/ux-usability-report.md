# Heuristic Usability Study — Calendar Kiosk

**Subject:** Google Calendar kiosk web app (live at https://calendar-kiosk.vercel.app)
**Context:** Wall-mounted ~9-inch Android tablet, Fully Kiosk Browser, running 24/7. Viewed both up close (touch) and glanceably from ~10 ft across a room. Three horizontally-swipeable full-screen views: Month (+ agenda ribbon), Week, Weather. Auto light/dark theming at sunrise/sunset.
**Method:** Code-level heuristic evaluation against Nielsen's 10 usability heuristics, plus glanceable / ambient-display principles (Mankoff et al.) and at-a-distance legibility guidance (minimum angular text size for reading at distance).
**Reviewer role:** Senior UX Researcher / Usability Specialist
**Stack reviewed:** Svelte 5 + Vite. Components in `src/components/`, styles in `src/app.css`, logic in `src/lib/`.

A note on the device class up front, because it frames every finding below. A wall display is not a phone. The dominant interaction is **looking, not touching** — most "sessions" are a 2-second glance from across the room, and the success metric is *how much correct information lands in those 2 seconds*. Touch is the rare, close-up secondary mode. The current design largely inherits phone-sized type and phone-density layouts, which is the root cause of most issues here.

---

## Severity scale

| Level | Meaning |
|---|---|
| **Critical** | Defeats the core glanceable purpose; fix before beta. |
| **High** | Materially hurts the primary use (reading the calendar at a distance). |
| **Medium** | Noticeable friction or polish gap; fix during beta. |
| **Low** | Minor / nice-to-have. |

---

## Summary of findings

| # | Issue | Severity | Primary heuristic |
|---|---|---|---|
| 1 | Type sizes are phone-scale, not wall-scale | **Critical** | Legibility at a distance / Aesthetic & minimalist |
| 2 | Month shows 6 fixed weeks incl. past weeks | **High** | Match between system & real world / Minimalist |
| 3 | Ribbon defaults to *selected* day, not *today* | **High** | Match between system & real world; Recognition over recall |
| 4 | Swipe navigation is barely discoverable | **High** | Visibility of system status; Help & discoverability |
| 5 | "Today" vs "selected" indicators compete | **Medium** | Consistency & standards; Visibility of status |
| 6 | No live "now" indicator anywhere | **Medium** | Visibility of system status |
| 7 | Event color-coding illegible at distance | **Medium** | Recognition; legibility |
| 8 | Touch targets below 44px minimum | **Medium** | Error prevention; touch ergonomics |
| 9 | Night-dim filter can crush legibility | **Medium** | Legibility; flexibility |
| 10 | Empty / stale / offline states underplayed | **Medium** | Visibility of system status; help users recover |
| 11 | Weather view (noted, not deep) | **High** | Multiple — handled by weather agent |
| 12 | Outside-month days still tappable / shift anchor | **Low** | Consistency; error prevention |

---

## Detailed findings

### 1. Type sizes are phone-scale, not wall-scale — **Critical**
**Heuristics:** At-a-distance legibility; Aesthetic & minimalist design.

The entire type ramp is sized for a phone held at ~30 cm, then deployed to a 9" panel read from ~3 m (10 ft). Distance is roughly 10×, so the type needs to subtend a comparable visual angle to remain readable — and it does not. Concretely, in the month grid:

- Day-number `.num` is `0.78rem`, per-event `.ev` text is `0.62rem`, the "+N more" line is `0.58rem`, spanning bars are `0.6rem`, weekday header `.dow` is `0.65rem`.
- Week view chips are `0.68rem` title / `0.6rem` time; the empty-day marker is a single `·`.
- The ribbon meta line is `0.74rem`.

At 0.58–0.68rem on a 9" tablet, this text is roughly **6–8px of cap height** — legible at arm's length, effectively invisible at 10 ft. The owner's instinct ("make the text slightly larger — just a touch") is **correct in direction but understated in magnitude** for the glance-distance content. See the validation section for a calibrated recommendation: small global bump for chrome, larger bump for the load-bearing glance content.

**Why it matters on a wall display:** the *only* reason this device exists is to be read without walking up to it. Sub-7px text fails the primary job.

**Recommendation:** Introduce a small set of fluid type tokens in `app.css` (e.g. `--fs-glance`, `--fs-body`, `--fs-chrome`) and drive component sizes from them, so the wall-distance content can be tuned in one place. Target a *minimum* rendered ~14–16px for any text meant to be read from across the room (day numbers, event titles, ribbon items, week chips), and reserve sub-12px only for genuinely secondary chrome (status pip text, "uppercase label" eyebrows). Pair the increase with the row reduction in #2, which frees the vertical space to make it affordable.

---

### 2. Month shows 6 fixed weeks including already-past weeks — **High**
**Heuristics:** Match between system and the real world; Aesthetic & minimalist design.

`monthGrid()` in `date.ts` always returns a fixed `42`-cell (6×7) grid anchored to the 1st of the month, and `MonthView` iterates `for (let w = 0; w < 6; w++)`. On a wall calendar whose job is "what's coming," this spends up to ~2 of 6 rows on **days that have already passed**, and it always renders 6 rows regardless of whether the month needs 4, 5, or 6 — so cell height (and the type inside it) is squeezed by weeks nobody will look at.

The owner's request — *current week as the top row, then the next 3 weeks (4 rolling rows)* — is **the right model for this device** and I endorse it. A forward-rolling 4-week window:
- Removes dead past-week rows, reclaiming ~33% vertical space per row → directly funds the larger type in #1.
- Matches the mental model of a kiosk ("the next month of life"), not the print-calendar model ("the calendar month").

**Implementation note:** this is a meaningful change to the grid contract, not just a slice. Today the grid is anchored on the month and labeled with `fmtMonthYear(anchor)`; a rolling window spans month boundaries, so:
- Build the grid from `startOfWeek(today)` and take 4 weeks (28 days) forward.
- The header can no longer be a single "June 2026"; show a span label (e.g. "Jun – Jul 2026") or drop the month-name header in favor of clearly marking month boundaries in-grid (e.g. show the month abbreviation on the `1`).
- The `‹ ›` month-nav buttons and `shiftMonth()` lose their meaning in a pure rolling view. Decide deliberately: either keep them as "page forward/back by 4 weeks," or remove them (a wall display arguably shouldn't be navigable at all — see #4). I recommend keeping a *paging* affordance but defaulting to and auto-returning to the rolling "now" window.
- "Outside month" dimming (`.cell.outside`) no longer applies cleanly; replace it with a subtle weekend tint or first-of-month marker so every day in the 4-week window reads as equally "real."

---

### 3. The ribbon defaults to the *selected* day, not *today* — **High**
**Heuristics:** Match between system and the real world; Recognition rather than recall; Visibility of system status.

`MonthView` initializes `selected = new Date()` and the ribbon (`DayRibbon`) renders `selectedEvents`. So on first paint it does show today — good. But the ribbon's *contract* is "the selected day," and selection is driven by tapping a cell. The failure mode on a wall display is specific and important:

- Someone walks up, taps a future day to peek at it, walks away.
- The ribbon is now **stuck** showing that arbitrary future day. There is a rollover effect that resets to today at midnight *only if* `wasAutoFollowing` is true — but tapping any day other than today sets `wasAutoFollowing = isToday(day)` → `false`, so a stray tap defeats the auto-return until the next midnight, and even then only at midnight, not after a short idle.

For an ambient display, the steady-state content should **always converge back to "now"** without human intervention. A persistent stuck state is a classic ambient-display anti-pattern (the display silently lies about its relevance).

**Why it matters:** a family glancing at the wall expects "today's agenda" to be on the right. If it's silently showing next Thursday because a kid poked it, the display has quietly become wrong — and nobody knows to fix it.

**Recommendation:**
- The ribbon's **default and resting state is always Today.** Make this explicit.
- Add an **idle auto-return**: after N seconds (e.g. 30–60s) with no touch, snap `selected` back to today and re-enable auto-following. This is the single most important "self-healing" behavior for a wall display.
- Keep the rollover effect, but also re-assert "today" on idle rather than waiting for midnight.
- Consider showing a permanent **"Today"** affordance/eyebrow when a non-today day is selected, so the off-state is visible and a tap returns home. (The ribbon already renders a `Today` label only when `isToday(day)` — invert it: when *not* today, show a "tap for today" hint.)

---

### 4. Swipe navigation is barely discoverable — **High**
**Heuristics:** Visibility of system status; Help & documentation / discoverability; Consistency & standards.

The only signifier that three views exist is the dot row (`.dots`) at the bottom: three 9px dots, one tinted with `--accent`. There is no arrow, no peek of the adjacent view, no "swipe" hint. The view name in the topbar (`Month` / `Week` / `Weather`) updates but doesn't imply siblings. On a wall display the problem compounds:

- The dots are 9px — invisible from 10 ft, so from across the room there is **zero indication** more views exist.
- Family members who don't know the gesture will never find Week or Weather.
- Embla is configured `loop: false`, so you can't even wrap around to stumble onto them.

**Why it matters:** discoverability can't rely on a help doc or onboarding on a passive wall device — the affordance must be self-evident.

**Recommendation:**
- Make the dots **tappable page indicators that read at distance**: larger, with the active one clearly dominant, and (ideally) labeled with the view name or a tiny icon. They're already wired to `goTo(i)` — lean into them as the primary nav, not just a status readout.
- Add a faint **peek** of the neighboring view at the screen edge (Embla supports a non-`start` align / containScroll tweak) so the "there's more sideways" affordance is built into the layout.
- Consider **auto-rotation as an option** (e.g. dwell on Month, briefly cycle to Weather every few minutes) so all content surfaces without anyone needing to know the gesture — appropriate for an ambient device. Make it a setting.

---

### 5. "Today" and "selected" indicators compete and can collide — **Medium**
**Heuristics:** Consistency & standards; Visibility of system status.

In the month grid, **today** = filled `--today` (amber) circle behind the day number; **selected** = 2px `--accent` (blue) outline on the cell. In the week view, **today** = `--today` outline on the whole column and amber day number — i.e. "today" uses an *outline* in Week but a *fill* in Month, while "selected" uses an *outline* in Month. Two issues:

1. **Cross-view inconsistency:** the same concept (today) is a fill in one view and an outline in another; the outline style that means "today" in Week means "selected" in Month. A viewer can't transfer the visual language between views.
2. **Collision:** when today is also the selected day (the common resting case), you get an amber fill *and* a blue outline on the same cell — two competing emphases on the one cell that matters most.

**Recommendation:** Pick one consistent encoding system-wide. Recommended: **today = solid accent/amber fill** (strongest, because it's the most-glanced cell), **selected = subtle ring or lifted background** that visibly differs from today and never fights it. Verify the today+selected overlap state looks intentional. Ensure the chosen "today" treatment is the single loudest thing on the screen from 10 ft.

---

### 6. No live "now" indicator — **Medium**
**Heuristics:** Visibility of system status; Match with real world.

The clock ticks (`clock.svelte.ts`, 15s cadence) and "today" is marked, but **there is no indication of the current time-of-day within the day's events.** The ribbon lists today's events as a flat list with no "you are here" line, and there's no visual separation of past vs. upcoming events for today. On a wall calendar the most valuable single fact is often "what's next" — and right now a 9am meeting that's already over looks identical to a 5pm one that hasn't happened.

**Recommendation:**
- In the **ribbon**, visually de-emphasize today's already-passed events (dim them) and/or draw a thin "now" divider between past and upcoming. Optionally surface a "Next: 5:00 PM Soccer" highlight.
- In **Week view**, a subtle horizontal "now" line in today's column would add strong ambient value (this is a known high-value pattern in calendar UIs).
- Cheap win: since the clock already drives reactivity via `clock.now`, gating an `isPast(event)` style is low-effort.

---

### 7. Event color-coding is not legible as a code at distance — **Medium**
**Heuristics:** Recognition rather than recall; legibility; accessibility.

Calendar identity is conveyed by color only: 5px dots in month cells (`.ev i`, `.dots i`), 4px left bars in the ribbon, 3px left borders on week chips, and filled spanning bars. From 10 ft, a 3–5px color swatch is sub-pixel-perception territory — you can see *that* there's an event, not *whose*. Color-only coding also fails for color-blind viewers (~8% of men), and several theme palettes push accent/today/danger hues that can sit close to user calendar colors.

Spanning bars do better (filled color with white text + text-shadow), but per-day dots and chip borders carry no recoverable meaning at distance.

**Recommendation:**
- Treat color as **reinforcement, not the sole channel.** For the few calendars a household actually uses, consider a short text/emoji prefix or initial, or at least make the color element substantially larger (the spanning-bar treatment is the model to copy).
- Increase swatch sizes generally (a 5px dot is decorative, not informative at this distance).
- Sanity-check that calendar colors retain contrast against every theme `--bg-elev`, especially the light `paper`/`daylight` day themes where saturated Google colors on white can vibrate.

---

### 8. Touch targets fall below the 44px minimum — **Medium**
**Heuristics:** Error prevention; touch ergonomics (WCAG 2.5.5 / platform HIG).

For the rare-but-real close-up touch mode, several targets are too small / too dense:
- Nav arrows `‹ ›` are `font-size:1.6rem` with only `0 10px` padding — narrow hit area, and adjacent to the month title.
- The settings gear `.icon` is `1.3rem` with `4px 8px` padding.
- View dots are **9px** — essentially un-tappable precisely; only viable because the swipe gesture is the real nav.
- Month day cells are fine in width but get **short** vertically once 6 rows of events compress them; mis-taps onto the wrong day are likely, which then triggers the stuck-ribbon problem in #3.

**Recommendation:** Ensure every interactive element has a **≥44×44px hit area** (use padding / invisible hit-slop, not just visible size). This pairs naturally with the dot-enlargement in #4 and the 4-row month in #2 (taller cells → safer taps).

---

### 9. Night-dim filter can crush legibility and is global — **Medium**
**Heuristics:** Legibility; Flexibility & efficiency; Aesthetic & minimalist.

Night dimming is implemented as `html[data-night='on'] { filter: brightness(0.55) saturate(0.9) }` over the whole document. This is a blunt instrument:
- It dims *text and indicators equally with backgrounds*, so already-faint `--text-faint`/`--text-dim` content (status, weekday labels, event times) can drop below readable contrast at night — exactly when the room is dark and the panel is the only light.
- `saturate(0.9)` plus brightness cut can wash out the calendar color-coding that's already marginal (#7).
- It's all-or-nothing (`nightDim` boolean), with no intensity control, and it stacks on top of an *already dark* night theme — potentially double-dimming.

**Recommendation:** Prefer **theme-level night palettes** (which already exist) over a global `brightness()` filter for legibility; if a dim is needed for a dark room, make it a **dimming overlay tuned to preserve text contrast** (e.g. lower background luminance more than foreground) and/or expose an intensity setting. At minimum, verify night-dim + each night theme still clears a contrast floor for the dimmest text tokens. Confirm the day/night *transition* itself isn't a jarring instant flip at sunrise/sunset — a short cross-fade reads better on an always-on wall panel.

---

### 10. Empty, stale, and offline states are underplayed — **Medium**
**Heuristics:** Visibility of system status; Help users recognize/recover.

The plumbing here is genuinely good — `data.svelte.ts` keeps last-known data on screen and tracks `stale`/`offline`/`auth`, and `StatusBar` renders a relative "Updated Nm ago" pip that escalates color past 20 min. Two gaps for a 24/7 wall device:
- **The status text is `0.72rem` in `--text-faint`** — the staleness signal, the one thing that tells a viewer "this calendar might be lying to you," is the *least* legible element on screen. Stale data shown confidently is worse than no data.
- **Empty day** in the ribbon is a quiet "No events"; the week empty-day marker is a lone `·`. Fine, but on a family calendar a confidently blank day is meaningful — make "No events" feel intentional rather than like a load failure.
- The **auth banner** is well done (high-contrast red, pulsing, tappable). Good model — the staleness state should borrow some of that visibility *as it ages* (e.g. after hours stale, escalate beyond a faint pip).

**Recommendation:** Scale the staleness indicator's prominence with its severity — faint when fresh, but visibly alarming (color + size, like the auth banner) once data is hours old or offline. Keep showing cached data, but never let it look authoritative when it's stale.

---

### 11. Weather view — noted, not deep (owner: "horrible — fix it") — **High**
A dedicated weather agent owns the redesign, so this is a flagged list, not a full teardown. Observed usability issues in `WeatherView.svelte`:
- **No glanceable hierarchy:** current temp (`3.2rem`) competes with a 7-row daily list and a 12-item horizontal hourly scroll, all on one screen — too much for an ambient glance. Decide the one or two facts that matter (now + today's high/low + next rain) and make them dominant.
- **Hidden hourly scroll:** the hourly strip is `overflow-x:auto` with no scroll affordance — from 10 ft (and even up close) it's not obvious it scrolls or that there are 12 items.
- **Stale-state gap:** unlike the calendar, the weather view has **no freshness/offline indicator** of its own; it'll show hours-old weather as if current. `wxStatus` exists in data but isn't surfaced here.
- **Dense daily rows** at `0.9rem` with a 4-column grid; precip-prob only appears at ≥10%, so the column silently empties — inconsistent rhythm.
- **Loading state** is a bare "Loading weather…" centered string; no skeleton, no last-known fallback shown while refreshing.
- Same distance-legibility problems as #1 apply throughout.

Hand these to the weather agent; the redesign should optimize for *one glanceable answer* plus a quiet detail tier.

---

### 12. Outside-month days remain interactive and shift the anchor — **Low**
**Heuristics:** Consistency & standards; Error prevention.

In the current 6-week grid, tapping an `.outside` (greyed) trailing/leading day calls `pick()`, which reassigns `anchor` to that day's month and re-renders the whole grid — a jarring full-month jump from what looks like a de-emphasized, "not really here" cell. (This finding partly dissolves under the #2 rolling-window redesign, which removes the month-boundary concept, but the interaction lesson stands: don't let faint cells trigger large context changes.)

**Recommendation:** Either make outside/greyed cells non-interactive, or make their tap behavior gentle and obvious. Under the rolling window, ensure no day in the visible 4 weeks looks "inactive" while still being tappable.

---

## Validation of the owner's three requests

**1. "Make the text slightly larger — not much, just a touch."**
**Endorsed, with a refinement on magnitude.** The direction is right and the instinct is healthy (don't bloat the chrome). But "just a touch" undersells what the *glance-distance content* needs: the day numbers, event titles, ribbon items, and week chips are currently 0.58–0.78rem — well below what's readable at 10 ft. Recommendation: a **modest global bump for chrome/labels (~+10–15%)**, but a **larger, deliberate bump for the load-bearing content** (target a rendered minimum of ~14–16px for anything meant to be read across the room). Implement via shared type tokens so it's tunable on the wall. This is affordable *because* of request #2 — see below.

**2. "Six weeks is too many — show current week on top + next 3 weeks (4 rolling rows)."**
**Strongly endorsed.** It matches the device's job ("what's ahead"), kills wasted past-week rows, and the reclaimed vertical space is exactly what funds the larger type in request #1 — the two requests reinforce each other. Note the non-trivial implications: the grid stops being a "calendar month," so the month-name header, the `‹ ›` month nav, and the `.outside` dimming all need rethinking (details in finding #2). Recommend pairing it with idle auto-return so the window always re-centers on "now."

**3. "The weather tab is horrible — fix it."**
**Endorsed; owned by the weather agent.** Confirmed real usability problems (no glanceable hierarchy, hidden hourly scroll, no freshness indicator, dense rows) — see finding #11 for the hand-off list. The fix should center one glanceable answer plus a quiet detail tier, and add the staleness indicator the calendar already has.

---

## Prioritized recommendations for the beta

**Do first (Critical / High — these define whether the wall display works at all):**
1. **Rework the type scale for wall distance** (#1). Introduce shared type tokens; bump glance-content to a ~14–16px rendered floor; keep chrome modest. *Owner request #1, refined.*
2. **Switch the month to a rolling 4-week window** starting on the current week (#2), and handle the header/nav/boundary consequences. *Owner request #2.* Do this together with #1 — it frees the space that makes #1 possible.
3. **Make the ribbon self-healing on "today"** (#3): default to today, auto-return on idle, show a visible off-state when a non-today day is selected.
4. **Make view navigation discoverable** (#4): enlarge/label the page dots, add an edge peek of neighboring views, and consider optional auto-rotation for a hands-off ambient device.
5. **Redesign the Weather view** (#11) — hand off to the weather agent. *Owner request #3.*

**Do during beta (Medium):**
6. Unify today/selected indicators across Month and Week; resolve the overlap state (#5).
7. Add a "now" signal — dim past events / "next up" in the ribbon, optional now-line in Week (#6).
8. Strengthen color-coding as a recoverable code at distance, not color-only (#7).
9. Bring all touch targets to ≥44px hit area (#8).
10. Fix night-dim so it preserves text contrast; verify the sunrise/sunset transition (#9).
11. Scale the staleness indicator's prominence with its age/severity (#10).

**Polish (Low):**
12. Make faint/outside cells non-interactive or gentle (#12).

**One-line beta test to run on the wall:** stand 10 ft back and, in 2 seconds each, answer "what's today's next event?", "what's on Saturday?", and "is this data current?". If any of those fails from across the room, the corresponding fix above is not yet done.
