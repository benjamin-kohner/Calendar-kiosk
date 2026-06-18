# 07 — Interaction & Gesture Design Specification

**Product:** Calendar Kiosk Web App
**Target device:** ~9-inch Android touch tablet, landscape or portrait, running **Fully Kiosk Browser** (WebView/Chromium-based)
**Views:** three horizontally-paged screens — **Monthly** (with a daily agenda ribbon), **Weekly**, **Weather**
**Goal:** a premium, touch-native, home-screen-style paging experience that runs jank-free for weeks without a reload.

---

## 0. Design Principles

1. **Paging, not scrolling.** The three views behave like Android home screens: one full screen per page, hard snap, page-indicator dots. There is no "free scroll" between views.
2. **One axis owns each gesture.** Horizontal owns view paging. Vertical owns in-view content scroll (agenda, week grid). The two never fight; the dominant-axis lock is decided in the first ~10px of movement and held for the whole gesture.
3. **Direct manipulation.** The page tracks the finger 1:1 during drag. The transition the user feels on release is a *continuation* of their own motion (velocity-aware), not a canned animation that ignores how they let go.
4. **Transform/opacity only.** All motion uses `transform: translate3d()` and `opacity` so the compositor handles it. No animating `left`, `width`, `height`, or `margin` — those force layout and jank on a low-power tablet.
5. **Kiosk-safe.** Suppress every browser/OS gesture we don't own (pull-to-refresh, edge-back, overscroll glow, text selection, double-tap zoom) so the only gestures that fire are ours.
6. **Forgiving targets.** Everything tappable is large; this is a wall/desk kiosk poked at from arm's length, not a phone held close.

---

## 1. Gesture Model

### 1.1 Horizontal swipe — switch views (primary gesture)

- **Layout:** the three views live in one horizontal track, 300vw wide, each child 100vw. Active page is held at `translateX(-index * 100vw)`.
- **Track during drag:** as the finger moves horizontally, the track follows 1:1 (`translateX` offset = page base + dragDelta).
- **Snap on release:** the track animates (snaps) to the nearest committed page based on distance + velocity thresholds (§4).
- **Bounded ends:** Monthly is the left edge, Weather is the right edge. There is **no wrap-around** (no loop). Dragging past an edge applies **rubber-band resistance** (§3.4) and always snaps back.
- **Order (left → right):** `Monthly (0) → Weekly (1) → Weather (2)`.

### 1.2 Page indicator dots (always visible)

- Three dots, bottom-center, ~16–20px above the safe bottom edge.
- Active dot is filled/wider (pill); inactive dots are smaller/dimmer.
- The active dot **interpolates continuously during the drag** (position/opacity track the swipe progress, 0.0–1.0 between pages) so the indicator feels physically linked to the finger, not a discrete flip on commit.
- Dots are also **tap targets**: tapping a dot pages directly to that view with the standard transition (§5.2). Hit area ≥ 44×44px even though the visible dot is small.

### 1.3 Bottom tab bar (optional fallback)

- Optional persistent bar with three labeled icons: **Month · Week · Weather**.
- Rationale: discoverability for non-technical household users and a no-swipe path if a future glove/screen-protector setup degrades touch sensitivity.
- Tapping a tab pages to that view (same transition as a swipe commit).
- If shown, the tab bar replaces or coexists with dots; **do not stack two competing indicators** — recommended: **dots by default**, tab bar as a config flag. If tab bar is enabled, drop the dots and let the active tab serve as the indicator.
- Tab bar height ≥ 56px; each tab ≥ 88px wide (full-width / 3 on a 9" screen easily satisfies this).

### 1.4 Vertical scroll within a view (must not hijack horizontal paging)

- **Monthly agenda ribbon** and **Weekly grid** can exceed screen height and scroll vertically.
- The vertical scroller is a normal native scroll container (`overflow-y: auto`) **inside** the paged child.
- **Axis arbitration (the critical rule):**
  - On `pointerdown`, record start point; lock = `undecided`.
  - On first `pointermove`, compute `|dx|` vs `|dy|`.
    - If `|dx| > |dy|` and `|dx| > 8px` → lock = `horizontal` → we own it, page drag begins, and we `preventDefault` to stop native scroll.
    - If `|dy| >= |dx|` and `|dy| > 8px` → lock = `vertical` → release to native scroll; paging ignores this gesture entirely.
  - Once locked, the lock holds until `pointerup` — no mid-gesture axis switching.
- **CSS backstop:** the paged track gets `touch-action: pan-y` so the browser still permits native vertical scroll, while we manually drive horizontal via pointer events. The inner scrollers get `touch-action: pan-y; overscroll-behavior: contain` so a vertical fling that hits the top/bottom does **not** bubble into pull-to-refresh or page-back.

### 1.5 Tap behaviors

| Target | Tap action |
|---|---|
| Day cell (Monthly) | Select that day → agenda ribbon updates to that day; subtle highlight on the cell |
| Event in agenda / week | Open a lightweight event detail (sheet or inline expand) — read-only is fine for v1 |
| Page dot | Page directly to that view |
| Tab (if enabled) | Page directly to that view |
| Empty area | No-op (do **not** treat as "close"/navigate) |

- Use a **tap vs. drag discriminator**: a pointer sequence is a *tap* only if total movement < 10px AND duration < 300ms. Anything else is a drag/scroll and must not fire tap handlers.
- **Suppress the 300ms click delay**: `touch-action` set as above plus a fast-tap path (pointerup-driven) eliminates it; do not rely on legacy `click`.

### 1.6 Long-press

- **Long-press ≥ 500ms** on a day cell or event → contextual affordance. For a calendar kiosk, recommended uses (pick per product scope):
  - Day cell: "jump to this day in Weekly" or a quick peek popover.
  - Reserve long-press for low-frequency actions only; primary navigation is always tap/swipe.
- Long-press must **cancel** if the finger moves > 10px (it becomes a drag) or lifts early.
- Provide a small haptic/visual confirmation at the 500ms threshold (scale-down 0.97 + subtle shadow) so the user knows it registered.

### 1.7 Pull-to-refresh (deliberate, opt-in — not the browser's)

- The **browser's native pull-to-refresh is disabled** (§2). We provide our **own** if data freshness matters (weather, calendar sync):
  - Available only at the **top** of a vertically-scrollable view, only when scrollTop === 0, and only on a vertical-locked gesture.
  - Custom spinner that follows the finger down past a threshold (~64–80px) with rubber-band resistance; release past threshold → trigger refresh; release short → snap back.
  - **Recommendation for a wall kiosk:** prefer **automatic background refresh on a timer** (e.g. weather every 10–15 min, calendar every few min) and treat manual pull-to-refresh as optional. A kiosk that refreshes itself is more "premium" than one that needs poking.

---

## 2. Gesture Conflict Handling (Fully Kiosk Browser + Chromium)

Fully Kiosk and the underlying WebView inject their own gestures; these MUST be neutralized so only our gestures fire.

### 2.1 Fully Kiosk settings (device-side configuration — document for the installer)

- **Disable "Swipe to Navigate" (PLUS)** — otherwise left/right swipes drive browser history forward/back and collide head-on with our paging.
- **Disable "Swipe to Change Tabs" (PLUS)** — same collision risk.
- **Disable "Pull to Refresh" / "Swipe down to refresh"** in Fully's Web Content settings — prevents reload on a downward agenda scroll.
- **Disable Android gesture-nav interference:** if Android 10+ gesture navigation is active, edge swipes can be intercepted by the OS. Run Fully in full kiosk/lock-task mode and, where possible, prefer **3-button nav** on the device or rely on Fully's lock-task to swallow edge gestures.
- **Disable "Swipe right to go back"** in kiosk mode.
- Set the app as the kiosk home / launcher so OS home-swipe doesn't escape the app.

> These are device configuration steps, not code — but the web app must not *assume* they're set. The CSS/JS backstops below make the app robust even if a setting is missed.

### 2.2 Web-side backstops (in our control, always applied)

```css
html, body {
  margin: 0;
  height: 100%;
  overflow: hidden;                 /* the document never scrolls; only inner panes do */
  overscroll-behavior: none;        /* kill pull-to-refresh + overscroll-nav glow */
  -webkit-user-select: none;        /* no text selection on long press */
  user-select: none;
  -webkit-touch-callout: none;      /* no iOS-style callout (harmless on Android) */
  touch-action: none;               /* document owns nothing by default */
}

.pager-track   { touch-action: pan-y; }            /* we drive X, browser may pan Y */
.scroll-pane   { touch-action: pan-y; overscroll-behavior: contain; }
* { -webkit-tap-highlight-color: transparent; }     /* no grey tap flash */
```

- **Disable double-tap-to-zoom and pinch-zoom** (kiosk should be fixed scale): `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">` plus `touch-action` excluding `pinch-zoom`.
- **Use Pointer Events**, not Touch Events, for our gesture engine — unified mouse/touch/stylus, cleaner capture (`setPointerCapture`), and consistent on Chromium WebView.
- **Passive vs. active listeners:** the horizontal-drag handler must be a **non-passive** `pointermove`/`touchmove` listener so it can `preventDefault()` once the horizontal lock engages; keep vertical scroll passive for performance. (Engine handles this by only preventing default after the axis lock resolves to horizontal.)

### 2.3 Conflict resolution priority

```
OS/Fully edge gestures   → suppressed at device + lock-task layer
Browser pull-to-refresh  → suppressed via overscroll-behavior:none
Our horizontal paging    → wins when first move is horizontal-dominant (>8px, |dx|>|dy|)
Native vertical scroll   → wins when first move is vertical-dominant
Tap / long-press         → win only when movement stays < 10px
```

---

## 3. Animation & Transition Specs

All transforms on the GPU. Target 60fps; budget every frame < 16ms.

### 3.1 During drag (finger down)

- **No transition** on the track (`transition: none`) while dragging — it must be 1:1 with the finger, driven by `transform: translate3d(x, 0, 0)` updated in a `requestAnimationFrame` loop fed by the latest pointer position.
- **Continuous indicator:** dots/parallax read `progress = -trackX / pageWidth` (a float) every frame.

### 3.2 On commit (release → settle to a page)

- **Property:** `transform: translate3d()` only.
- **Duration:** **300ms** base for a tap-driven or low-velocity commit. For a fast flick, **shorten to ~200–250ms** and scale by remaining distance so a near-complete swipe finishes quickly (perceived as "it just went there").
- **Easing (commit / settle):** ease-out, decelerating into place — `cubic-bezier(0.22, 1, 0.36, 1)` ("ease-out-quint"-ish) for a soft, premium landing. Avoid a linear or symmetric ease for committed paging; ease-out reads as "responding to me."
- **Velocity hand-off:** when a flick is committed, the start of the settle animation should roughly match the finger's exit velocity (so there's no visible speed discontinuity). A spring/inertia model does this natively; with CSS, approximate by shortening duration as velocity rises.

### 3.3 On cancel (release short of threshold → snap back)

- Snap back to the current page, **same easing**, slightly shorter **~250ms** (collapsing/return motions should be a touch faster than entrances).

### 3.4 Rubber-band at the ends (overscroll)

- Past the first/last page, applied drag is **damped**: `appliedDelta = rawDelta * 0.35` (diminishing). On release it always snaps back (250ms, ease-out). This gives the "nothing beyond here" feel without a hard wall.

### 3.5 Parallax / depth (the "premium" layer)

Subtle, optional, cheap. Two recommended treatments — pick one, don't overdo:

- **Slide + slight fade:** outgoing page translates at 1.0× and fades to ~0.6 opacity; incoming page translates in at 1.0× from full opacity. Gives gentle depth without a second moving layer.
- **Content parallax:** the page background/header moves at ~0.85× the track speed while the foreground content moves at 1.0×, creating layered depth like home-screen wallpaper parallax. Keep the parallax factor between **0.8–0.9**; more looks gimmicky and costs a second animated layer.
- **Per-view flourish (optional, on settle only, ≤ 200ms):** e.g. Weather icons do a tiny fade/scale-in (0.96→1.0) when their page lands. Never animate these *during* the drag (too busy) — only as a settle accent.

### 3.6 Reduced motion

- Honor `prefers-reduced-motion: reduce`: drop parallax and per-view flourishes, keep a fast (≤150ms) crossfade/translate so paging is still legible. (Kiosk likely won't set this, but it's cheap correctness.)

---

## 4. Inertia / Velocity Thresholds (commit logic)

On `pointerup`, decide the target page from **distance OR velocity**:

| Signal | Threshold | Result |
|---|---|---|
| **Distance** | dragged ≥ **40% of page width** (~0.4 × 100vw) | commit to the next page in drag direction |
| **Velocity (flick)** | exit velocity ≥ **0.5 px/ms** (≈ 500 px/s) in the drag direction | commit to next page **regardless of distance** (even a short, fast flick pages over) |
| Neither met | — | **cancel** → snap back to current page |

- **Velocity measurement:** track the last ~3 pointer samples (or a 60–100ms window) and compute `Δposition / Δtime`; don't use only the final two events (noisy). Reset/ignore stale samples if the pointer paused.
- **Single-page-per-fling clamp:** one flick advances **at most one page** (no skip-2). This matches home-screen paging and prevents accidental over-shoot to the wrong view. (Tapping a dot/tab is the way to jump non-adjacent.)
- **Direction lock:** the committed direction is the *net* direction of the gesture; a back-and-forth wiggle that ends near origin and below thresholds → cancel.

Reference defaults (tune on-device):
```
COMMIT_DISTANCE_RATIO = 0.40
COMMIT_VELOCITY       = 0.5   // px/ms
AXIS_LOCK_SLOP        = 8     // px to decide horizontal vs vertical
TAP_MOVE_TOLERANCE    = 10    // px
TAP_MAX_DURATION      = 300   // ms
LONGPRESS_DELAY       = 500   // ms
RUBBERBAND_FACTOR     = 0.35
```

---

## 5. Edge Cases

### 5.1 Mid-swipe cancel
- User drags 30% then reverses and lets go near origin → below distance AND below velocity → **snap back** to current page (250ms).

### 5.2 Dot/tab jump while a drag settle is mid-flight
- New target interrupts the in-flight animation; animate from the **current** transform value to the new page (no jump-cut). Recompute duration from remaining distance.

### 5.3 Fast double-flick
- Second flick arrives while first is still settling. Because of the single-page clamp, queue/coalesce: apply the second flick from current visual position → advances one more page. Never let two flicks overshoot past the last page.

### 5.4 Multi-touch / palm
- Use only the **primary pointer** (first `pointerId`). Ignore secondary pointers mid-gesture. A second finger landing must not teleport the track. Pinch is disabled anyway.

### 5.5 Finger lifts off-screen / pointercancel
- Treat `pointercancel` (e.g. Fully steals the gesture, system interruption) like a release with last-known velocity → commit or snap back; never leave the track stranded between pages.

### 5.6 Vertical fling reaches list end
- `overscroll-behavior: contain` absorbs it — no pull-to-refresh, no page-back, no rubber-band leaking to the document.

### 5.7 Resize / rotation
- On `resize`/orientation change, recompute page width and re-pin `translateX = -index * newWidth` **without animation** so the active page stays correct. Debounce resize (~150ms).

### 5.8 Long-running stability (weeks without reload)
- Drive drag with a **single rAF loop**, not per-event style writes; cancel the rAF on idle.
- Reuse listener references; **never** attach anonymous listeners per gesture (leak risk). Use one delegated pointer handler set at mount.
- Avoid creating closures/objects per `pointermove`. Reuse a scratch object for velocity samples.
- No `setInterval` redraws for animation; timers only for data refresh.
- Periodically (config) the data layer may refresh, but the **DOM structure stays stable** — update in place, don't tear down/rebuild the pager.

---

## 6. Accessibility & Touch-Target Guidance

- **Minimum touch target: 48×48px** (Material) — we recommend **≥ 56px** for primary controls given arm's-length use and a 9" screen. Day cells should fill available grid space (well above minimum).
- **Spacing:** ≥ 8px between adjacent targets to avoid mis-taps.
- **Dots:** visible dot can be small, but the **invisible hit area ≥ 44–48px**.
- **Contrast:** text ≥ 4.5:1; the kiosk may be viewed in varied room light — favor high contrast and large type.
- **Labels:** if a tab bar is used, pair icon + text label (don't rely on icon alone).
- **Focus/feedback:** every tap has immediate visual feedback (< 100ms) — press state on day cells/events — so the user knows the kiosk "heard" them even before the detail loads.
- **No timed-out-only interactions:** never require precise timing as the *only* way to do something; long-press always has a tap/visible alternative.
- **Screen reader:** mark pages with `role="group"`/`aria-roledescription="slide"` and the indicator with current-page state, even if unlikely to be used — cheap and correct.

---

## 7. Recommended Implementation Approach & Library Tradeoffs

### 7.1 Options considered

| Approach | Bundle | Pros | Cons | Fit for this kiosk |
|---|---|---|---|---|
| **CSS Scroll-Snap** (`scroll-snap-type: x mandatory`) | 0 KB | Native momentum, native a11y, zero JS for the scroll, very low jank, hard to leak | Less control over velocity-aware commit, parallax and continuous-dot interpolation are awkward; programmatic "go to page N" via `scrollIntoView` is okay but custom easing is limited; some WebViews snap abruptly | **Strong baseline.** Great if we accept native feel and build dots/parallax on top via scroll-position listener. |
| **Embla Carousel** | ~3–7 KB core | Pointer-events based; **velocity-based momentum & smooth deceleration** built in; headless (we own all UI/styling → matches custom calendar look); small, well-maintained; easy access to scroll progress for continuous dots/parallax; `containScroll`/no-loop for bounded ends | Headless means we build dots/tabs/parallax ourselves (we want that anyway) | **Recommended primary.** Best balance of native-feel physics + tiny footprint + full design control for a long-running kiosk. |
| **Swiper.js** | ~25–47 KB gzip | Batteries-included: pagination, parallax, effects, resistance tuning, threshold/long-swipe config out of the box; mature | Much larger; more surface area / more to keep stable for weeks; CSS-effect modes can be heavier on a low-power tablet | Viable if we want pagination + parallax with near-zero custom code, but heavier than needed. Good **fallback**. |
| **Framer Motion / Motion** (React) | ~30–50 KB | Spring physics gives the most natural velocity hand-off; `drag` + `dragConstraints` + `onDragEnd` velocity is excellent; great for the premium settle feel | React-only; larger; need to hand-roll the axis-lock + bounded paging; springs need care to keep deterministic on weak hardware | Good if the app is React **and** we want spring-based premium feel and are willing to own the paging logic. |
| **Hand-rolled Pointer Events + rAF + transforms** | 0 KB (your code) | Total control over every threshold in §4; no dependency to age out; smallest possible runtime | We must get axis-lock, velocity sampling, rubber-band, pointercancel, resize all correct (this doc is the spec to do it) | Solid choice for a team that wants no deps; more upfront work and test burden. |

### 7.2 Recommendation

**Primary: Embla Carousel** for the three-view pager.
- Tiny (~3–7KB), pointer-event based, with velocity momentum and smooth deceleration that delivers the home-screen feel with minimal jank — ideal for a device that must run for weeks.
- Headless fits the bespoke calendar design; we render dots/tab bar/parallax from Embla's scroll-progress API (gives us the **continuous** indicator in §1.2 and parallax in §3.5).
- Configure: `loop: false`, contained scroll (bounded ends → our rubber-band), `dragFree: false` (we want snap), `skipSnaps: false` (enforce single-page-per-fling), and tune drag threshold to our velocity/distance rules.

**Fallback A (no-dependency):** CSS Scroll-Snap baseline + a thin scroll-position listener for dots/parallax. Choose this if we want zero JS dependency and accept native snap feel.

**Fallback B (React + max premium feel):** Framer Motion with `drag="x"`, velocity-aware `onDragEnd`, and spring settle — if the app is React and spring physics is wanted.

**Avoid as primary:** Swiper.js — capable but the heaviest option for what is a 3-page bounded pager; keep it only if we end up wanting its built-in parallax/pagination to save custom code.

**Inner scrollers:** always **native `overflow-y: auto`** (not a JS scroller) — native scrolling is the most jank-free and battery-friendly choice for the agenda/week, and it composes cleanly with the axis-lock backstop.

---

## 8. State Diagram — View Paging (text/ASCII)

### 8.1 Page state machine (which view is active)

```
        swipe-left / dot=1 / tab=Week                 swipe-left / dot=2 / tab=Weather
   ┌───────────────────────────────────┐        ┌─────────────────────────────────────┐
   │                                   ▼        │                                     ▼
┌──────────┐                       ┌──────────┐                                  ┌──────────┐
│ MONTHLY  │                       │  WEEKLY  │                                  │ WEATHER  │
│  (idx 0) │                       │ (idx 1)  │                                  │ (idx 2)  │
│  [edge L]│                       │          │                                  │ [edge R] │
└──────────┘ ◄─────────────────── └──────────┘ ◄─────────────────────────────── └──────────┘
        swipe-right / dot=0 / tab=Month               swipe-right / dot=1 / tab=Week

 Left edge:  swipe-right at MONTHLY  → rubber-band → snap back to MONTHLY (no wrap)
 Right edge: swipe-left  at WEATHER  → rubber-band → snap back to WEATHER (no wrap)
 Dot/Tab tap: jump directly to any index (non-adjacent allowed via tap, not fling)
```

### 8.2 Gesture lifecycle (per pointer interaction)

```
                         ┌─────────┐
                         │  IDLE   │
                         └────┬────┘
                      pointerdown (primary)
                              │  record start (x,y,t); lock=UNDECIDED
                              ▼
                      ┌───────────────┐
                      │   PRESSING    │──── 500ms, moved<10px ───► LONG_PRESS ──► action ──► IDLE
                      └──────┬────────┘
                  first move > 8px slop
                              │
              ┌───────────────┴────────────────┐
        |dx|>|dy| (horizontal)            |dy|>=|dx| (vertical)
              │                                 │
              ▼                                 ▼
      ┌───────────────┐                 ┌───────────────────┐
      │  DRAGGING-X   │                 │  NATIVE-SCROLL-Y  │
      │ track follows │                 │ (browser owns it; │
      │ finger 1:1,   │                 │  paging inert)    │
      │ preventDefault│                 └─────────┬─────────┘
      │ dots/parallax │                       pointerup
      │ interpolate   │                           │
      └──────┬────────┘                           ▼
        pointerup / pointercancel               IDLE
              │  measure distance + velocity (last ~3 samples)
              ▼
      ┌─────────────────────────────────────────────┐
      │            COMMIT DECISION                    │
      │  dist ≥ 40%w  OR  |v| ≥ 0.5px/ms ?           │
      └───────┬───────────────────────────┬─────────┘
            yes                           no
              │                            │
              ▼                            ▼
      ┌───────────────┐            ┌────────────────┐
      │  SETTLING →    │            │  SETTLING →    │
      │  next page     │            │  snap back     │
      │  200–300ms     │            │  ~250ms        │
      │  ease-out      │            │  ease-out      │
      │  (clamp ±1 pg, │            └───────┬────────┘
      │   clamp edges) │                    │
      └───────┬────────┘                    │
              │   on animation end          │
              └───────────┬─────────────────┘
                          ▼
                       ┌──────┐
                       │ IDLE │  (active index updated; dots/tab synced)
                       └──────┘

 Interrupt: a dot/tab tap or new pointerdown during SETTLING → re-target from
 current transform value (no jump-cut), recompute duration, continue.
 pointercancel during DRAGGING-X → treat as pointerup with last-known velocity.
```

### 8.3 Tap vs drag vs long-press discrimination

```
pointerdown ──► start timer(500ms), record (x0,y0,t0)
   │
   ├── move > 10px before 500ms ───────► it's a DRAG/SCROLL (cancel long-press, cancel tap)
   ├── 500ms elapsed, move ≤ 10px ─────► LONG_PRESS fires
   └── pointerup, move ≤ 10px, dt<300ms ► TAP fires (run tap handler)
       pointerup otherwise ────────────► neither (was a drag) → settle logic
```

---

## 9. Acceptance Criteria

**Paging & feel**
1. Swiping horizontally moves between the three views in order Monthly↔Weekly↔Weather; the track tracks the finger 1:1 with no perceptible lag during drag.
2. Releasing after dragging ≥ 40% of page width commits to the next view; releasing under that snaps back.
3. A fast flick (≥ ~0.5px/ms) commits to the next view even if dragged < 40%, advancing **exactly one** page.
4. There is no wrap-around: swiping right on Monthly and left on Weather rubber-bands and snaps back.
5. Page dots are always visible, the active dot interpolates continuously during a drag, and tapping a dot jumps to that view.
6. Settle animations use transform-only motion, complete in ≤ 300ms (≤ 250ms for flicks/snap-back), with an ease-out landing and no visible speed discontinuity from the finger's release.
7. Sustained 60fps (no frame > 16ms) during drag and settle on the target tablet, verified via devtools/perf trace.

**Axis arbitration & scroll**
8. Vertical scrolling inside the Monthly agenda and Weekly grid works natively and **never** triggers a horizontal page change.
9. A primarily-vertical gesture never moves the pager; a primarily-horizontal gesture never scrolls the list. The axis lock is decided within the first 8px and held for the gesture.
10. Vertical fling reaching the top/bottom of a list does **not** trigger pull-to-refresh, page-back, or document overscroll (verified with `overscroll-behavior` and Fully settings).

**Conflicts & kiosk**
11. With Fully Kiosk swipe-navigate / swipe-tabs / pull-to-refresh disabled, no browser history navigation or reload ever occurs from app gestures.
12. Browser pull-to-refresh, double-tap-zoom, pinch-zoom, text selection, and tap-highlight are all suppressed.
13. App runs continuously for ≥ 7 days without reload with no memory growth attributable to gesture handling and no degradation in swipe smoothness (heap stable across a profiling window).

**Taps, long-press, targets**
14. A tap (movement < 10px, < 300ms) on a day cell updates the agenda ribbon; a tap on an event opens its detail.
15. Long-press (≥ 500ms, < 10px move) fires its action and cancels if the finger moves or lifts early; it always has a tap-based alternative.
16. All primary touch targets are ≥ 48px (recommended ≥ 56px) with ≥ 8px spacing; dot hit areas ≥ 44px.
17. Every tap produces visual feedback within 100ms.

**Edge cases**
18. Mid-swipe reverse-and-release snaps back without flicker.
19. Dot/tab tap during an in-flight settle re-targets smoothly from the current position (no jump-cut).
20. `pointercancel` and off-screen finger-lift never strand the track between pages.
21. Rotation/resize re-pins the active page without animation and recomputes thresholds correctly.

---

## 10. Open Questions / Decisions for Product

1. **Tab bar:** ship dots-only, or dots + bottom tab bar? (Recommendation: dots default, tab bar as a config flag for discoverability.)
2. **Pull-to-refresh:** custom pull-to-refresh, or rely solely on timed background refresh? (Recommendation: background timer; pull-to-refresh optional.)
3. **Long-press:** is there a real use for it in v1, or defer? (Navigation works fully via tap/swipe without it.)
4. **Framework:** is the app React (enables Framer Motion fallback) or vanilla/other (favors Embla or hand-rolled)?
5. **Per-view settle flourishes:** how much "delight" vs. calm? (Recommend restrained — one subtle accent per view, settle-only.)

---

## Sources

- [Swiper vs Embla Carousel — swiperjs.com](https://swiperjs.com/compare/swiper-vs-embla-carousel)
- [SwiperJS vs Embla — Capaxe Labs](https://www.capaxe.com/blog/swiperjs-vs-embla-carousel)
- [Embla vs Swiper vs Splide 2026 — PkgPulse](https://www.pkgpulse.com/guides/embla-carousel-vs-swiper-vs-splide-2026)
- [Fully Kiosk Browser — official](https://www.fully-kiosk.com/en/)
- [Microsoft Edge KioskSwipeGesturesEnabled policy](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-browser-policies/kioskswipegesturesenabled)
- [Disable Swipe Gestures in KIOSK Mode — electron/electron #38217](https://github.com/electron/electron/issues/38217)
- [Speed — Material Design (durations)](https://m2.material.io/design/motion/speed.html)
- [transition-timing-function — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/transition-timing-function)
- [An Interactive Guide to CSS Transitions — Josh W. Comeau](https://www.joshwcomeau.com/animation/css-transitions/)
- [Take control of your scroll (overscroll-behavior, pull-to-refresh) — Chrome for Developers](https://developer.chrome.com/blog/overscroll-behavior)
- [overscroll-behavior — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overscroll-behavior)
- [touch-action — CSS-Tricks](https://css-tricks.com/almanac/properties/t/touch-action/)
