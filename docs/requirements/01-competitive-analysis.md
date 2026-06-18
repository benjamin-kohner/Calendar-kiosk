# Competitive Analysis: Digital Family / Smart Calendar Products

**Document:** 01 — Competitive Feature Teardown
**Date:** 2026-06-18
**Context:** We are building a home calendar kiosk web app for a wall-mounted ~9–11" Android tablet (running [Fully Kiosk Browser](https://www.fully-kiosk.com/en/)) that shows the user's Google Calendar 24/7 with monthly+agenda, weekly, and weather views and swipe navigation. This teardown identifies which "premium" features to match or beat.

> **Key framing:** Our product is a *single-user / single-household, Google-Calendar-backed web kiosk*. The competitors below are mostly **vertically integrated hardware + subscription** businesses ($150–$700 device + $40–$86/yr). Our advantage is zero hardware cost (BYO tablet), zero subscription, and full design control. Our disadvantage is no native app, no AI import pipeline, and no built-in two-way edit unless we build it. This shapes which features are worth copying.

---

## 1. Product-by-Product Teardown

### 1.1 Skylight Calendar (market leader)

The category-defining product. Touchscreen wall calendar focused on busy families.

- **Hardware / screens:** Three sizes — **10"**, **15"**, and **27" Calendar Max** (shadow-box style). WiFi-connected, must be plugged into wall power (a common complaint — limits placement, cable management needed). ([myskylight.com](https://myskylight.com/products/skylight-calendar/), [slashgear.com](https://www.slashgear.com/1806004/skylight-digital-calendar-tested-pros-cons/))
- **Core calendar:** Day, Week, Month, and **Schedule (agenda)** views. Syncs Google, Apple, Outlook, Cozi, Yahoo — but **only Google has full two-way sync**; others are "clunky." Per-person filter to show only one person's calendar. ([Skylight Support – views](https://skylight.zendesk.com/hc/en-us/articles/360033104791-How-do-I-change-the-view-of-my-calendar), [cybernews.com](https://cybernews.com/reviews/skylight-calendar-review/))
- **Agenda / ribbon design:** "Schedule" view shows an at-a-glance list of upcoming events; configurable number of days. ([Skylight Support – schedule view](https://skylight.zendesk.com/hc/en-us/articles/360059869651-How-do-I-view-more-days-on-the-Schedule-view-on-my-Skylight-Calendar))
- **Chores / tasks / lists:** "Tasks Manager" with daily routines and chores to build kid independence; custom lists for to-dos and groceries; **Chore Rewards** (Plus). ([myskylight.com – Plus](https://myskylight.com/products/calendar-skylight-plus))
- **Multi-person color coding:** Yes — each family member assigned a color. ([Skylight Support – Calendar tab](https://skylight.zendesk.com/hc/en-us/articles/36625171368987-Using-the-Calendar-Tab))
- **Photo / screensaver:** Photo/Video Screensaver — **Plus only**. ([myskylight.com – Plus](https://myskylight.com/products/calendar-skylight-plus))
- **Weather:** Weather forecasting tied to events / day view.
- **Meal planning:** Yes — **Plus only**.
- **AI / import:** **Sidekick** AI assistant + **Magic Import** — forward emails/PDFs or photograph a flyer/list and it auto-creates events. QR code activates Sidekick on the mobile app. This is Skylight's standout differentiator. ([Skylight Support – Calendar](https://skylight.zendesk.com/hc/en-us/articles/44738510847259-Calendar))
- **Reminders:** Event-based; companion mobile app.
- **Pricing / paywall:** Device $149.99 (10") / $279.99 (15") / $599.99 (27" Max), each bundled with Plus. **Skylight Plus = $79/year** and gates Photo/Video Screensaver, Meal Planning, Chore Rewards, Magic Import, Sidekick. ([myskylight.com – Plus](https://myskylight.com/products/calendar-skylight-plus), [Skylight Support – cost](https://skylight.zendesk.com/hc/en-us/articles/35984779668379))
- **Notable UX:** **Swipe left/right** to move through dates, **swipe up/down** to scroll times in day/week. Filter to a single person. No voice control. Useless without WiFi; fingerprints on screen are a noted annoyance. ([Skylight Support – views](https://skylight.zendesk.com/hc/en-us/articles/360033104791))

### 1.2 Hearth Display (premium challenger)

Positioned as the high-end, design-forward, "grows with your kids" competitor.

- **Hardware / screens:** **27"** interactive touchscreen, custom wall mount. **$699** device. ([hearthdisplay.com](https://hearthdisplay.com/products/hearth-display), [Amazon](https://www.amazon.com/Display-Calendar-Families-Interactive-Touchscreen/dp/B0DMFW4DR9))
- **Core calendar:** Shared calendar connecting Google, iCal, Outlook — **calendar sync is free** (the hook). ([hearthdisplay.com – features](https://hearthdisplay.com/pages/features))
- **Chores / routines / rewards:** Pre-designed routines authored by "parenting pros," plus custom routines (school-day mornings → weekend chores). **Star rewards** kids redeem for custom rewards (movie night, treat). ([thequalityedit.com](https://www.thequalityedit.com/articles/hearth-display-review-2025))
- **Multi-person color coding:** Yes.
- **AI:** **Hearth Helper / Sidekick** — AI-powered family assistant (Family Membership).
- **Meal planning, to-dos, photo screensaver:** All gated behind **Family Membership**.
- **Pricing / paywall:** Device **$699**; **Family Membership $9/mo or $86.40/yr** (30-day trial included). Free tier = basic calendar only. ([thequalityedit.com](https://www.thequalityedit.com/articles/hearth-display-review-2025))
- **Notable UX:** Most premium/aesthetic hardware in the category; heaviest lean on kid routines + gamified rewards.

### 1.3 Dragon Touch Digital Calendar (the "no subscription" value play)

Direct hardware competitor to Skylight/Hearth, explicitly marketed on **no subscription fees**.

- **Hardware / screens:** Many sizes — **15.6", 21.5", 24", 27", 32"**. 1080p FHD touchscreen. Wall- or desk-mountable (horizontal or vertical holes + stand). 21.5" ≈ **$349.99**. ([dragontouch.com](https://dragontouch.com/products/dragon-touch-digital-calendar), [the-gadgeteer.com](https://the-gadgeteer.com/2025/09/15/dragon-touch-digital-calendar-review/))
- **Core calendar:** Integrates multiple personal calendars (iOS, Google, etc.) into one unified view; per-member colors and tasks.
- **Chores / lists:** Chore chart + task/reward features; meal planning; grocery & to-do lists. ([Amazon](https://www.amazon.com/Dragon-Touch-dragontouch-Digital-Picture/dp/B0DHRVN6WY))
- **Photo:** Doubles as a full-HD **digital photo frame** when idle.
- **Pricing / paywall:** **No subscription** — all features included with the device. This is its entire positioning and the most direct threat to subscription incumbents. ([dragontouch.com – no subscription](https://dragontouch.com/products/dragon-touch-digital-calendar))
- **Notable UX:** Value-tier hardware; reviews note it's functional but less polished than Skylight/Hearth.

### 1.4 Cozi (software-only family organizer)

App-only (iOS/Android/web), no hardware. The default "family organizer" app.

- **Hardware:** None — phone/tablet/web. (Can be the *content source* shown on a kiosk, but not a kiosk product itself.)
- **Core calendar:** Shared, **color-coded per-person** family calendar; email agenda reminders. ([cozi.com – features](https://www.cozi.com/feature-overview/))
- **Lists:** Real-time shared shopping & to-do lists (unlimited lists). **Shopping Mode** (Gold) = no-dim full-screen, checked items sink, others' additions highlighted. ([cozi.com – Gold](https://www.cozi.com/cozi-gold-features/))
- **Meal planning:** Recipe box + meal planner; ingredients auto-add to shopping list.
- **Pricing / paywall:** Free tier with **ads**; **Cozi Gold ≈ $39/year** removes ads, adds enhanced reminders, mobile month view, calendar search, contacts, birthday tracker, themes, change notifications. ([ourcal.com](https://ourcal.com/blog/cozi-app-review-2025), [usecalendara.com](https://www.usecalendara.com/blog/cozi-review-2026))
- **Notable UX:** Cheapest premium tier in the set; relevant mainly for list/meal-planning UX patterns and as a calendar source. Recent reviews note a harder paywall on previously-free features.

### 1.5 DAKboard (configurable dashboard, BYO-display — closest to us)

A configurable web dashboard that runs on any screen (or their own hardware). **This is the most architecturally similar product to what we're building.**

- **Hardware / screens:** Software runs on any browser/Raspberry Pi/tablet; also sells **Wall Display** units incl. **Touch 22" / 24"**. ([shop.dakboard.com](https://shop.dakboard.com/products/dakboard-wall-display-touch))
- **Core calendar:** ~100 native integrations. Calendar block supports Google, Outlook/O365, iCloud, plus task apps (Todoist, Trello, Asana, MS To-Do, Google Tasks). Free = up to 2 calendars; Essential = up to 5; **Plus = unlimited calendars per block**. ([dakboard support](https://dakboard.freshdesk.com/support/solutions/articles/35000253343))
- **Photo:** Core feature — events/weather overlaid on photos from Flickr, Dropbox, Instagram, Google Photos, etc.
- **Weather, news/RSS:** Built-in blocks.
- **Layout / UX:** **Block-based custom layouts**, screen templates, **custom CSS**, screen loops & scheduling, instant refresh (higher tiers). Highly DIY/configurable rather than family-routine-focused.
- **Pricing / paywall:** **Free** (1 screen, 2 calendars, branding); **Essential $6/mo ($5/mo annual)** — custom screens, 5 calendars, all integrations, custom CSS; **Plus $10/mo ($8/mo annual)** — unlimited calendars, 500 MB media, screen loops/scheduling, fastest refresh. 30-day Plus trial. ([dakboard.com/pricing](https://dakboard.com/pricing))
- **Notable UX:** Strength = flexible dashboard composition + photo overlays. Weakness = no chores/rewards/meal-planning, less "family" warmth, more setup effort.

### 1.6 MagicMirror² + Calendar modules (DIY / open-source baseline)

Open-source smart-mirror/dashboard framework. Sets the **free DIY baseline** we must clearly beat on polish and ease.

- **Hardware:** Any display (often Raspberry Pi behind a two-way mirror or a wall tablet).
- **Calendar:** Core `calendar` module + **MMM-CalendarExt3** (week/month views, weather integration, interactive popovers; requires the base calendar module). Also **MMM-CalendarExt3Agenda** for a daily agenda view. Pure JS/CSS. ([MagicMirror docs](https://docs.magicmirror.builders/modules/calendar.html), [MMM-CalendarExt3](https://github.com/MMRIZE/MMM-CalendarExt3), [MMM-CalendarExt3Agenda](https://github.com/MMRIZE/MMM-CalendarExt3Agenda))
- **Weather:** MMM-WeatherChart, MMM-OpenWeatherForecast.
- **Touch:** Community builds add/edit/delete events on-screen via custom CSS + transparent per-cell buttons; also photos and commute times. ([MagicMirror forum](https://forum.magicmirror.builders/topic/18011/touchscreen-family-dashboard))
- **Pricing:** Free / open-source.
- **Notable UX:** Infinitely customizable but requires technical setup; no cohesive family product. **Our app should feel like "MagicMirror polish without the assembly."**

### 1.7 "Calendar Plus" (Android) — clarifying note

There is no single dominant product cleanly named "Calendar Plus." The closest current Android offering is **Calendar Widgets Suite** (com.joshy21.vera.calendarplus.widgets) — homescreen widgets that render Google Calendar in day/week/month/list views with 50+ themes and configurable week-start. It is a *widget* product, not a kiosk, but its **theme system and dense month/agenda widget rendering** are useful reference for our compact tablet layout. ([Google Play](https://play.google.com/store/apps/details?id=com.joshy21.vera.calendarplus.widgets)) *(Note: "Calendar Plus" may also refer to Skylight's own "Calendar Plus" subscription tier — covered under §1.1.)*

---

## 2. Consolidated Feature Matrix

Legend: ● = yes/included · ◐ = paid add-on / premium tier · ○ = no / N/A

| Feature | Skylight | Hearth | Dragon Touch | Cozi (app) | DAKboard | MagicMirror | **Our Kiosk (target)** |
|---|---|---|---|---|---|---|---|
| Dedicated hardware | ● 10/15/27" | ● 27" | ● 15–32" | ○ app | ◐ optional 22/24" | ○ BYO | ○ BYO tablet 9–11" |
| One-time cost | $150–$600 | $699 | $350+ | free/ads | $0 (BYO) | $0 | **$0 (BYO)** |
| Subscription | ◐ $79/yr | ◐ $86/yr | ○ none | ◐ $39/yr | ◐ $60–120/yr | ○ none | **○ none (goal)** |
| Google Calendar sync | ● 2-way | ● | ● | ● | ● | ● | ● (read; write = stretch) |
| Multi-calendar / accounts | ● | ● | ● | ● | ● (∞ on Plus) | ● | ● |
| Month view | ● | ● | ● | ● | ● | ● | ● |
| Week view | ● | ● | ● | ● | ◐ | ● | ● |
| Day view | ● | ● | ● | ● | ◐ | ◐ | ◐ (optional) |
| Agenda / schedule ribbon | ● | ● | ● | ● | ● | ● (ext) | ● **(month + agenda combo)** |
| Swipe navigation | ● | ● | ● | ● | ○ | ◐ | ● |
| Per-person color coding | ● | ● | ● | ● | ● | ● | ● (per-calendar color) |
| Per-person filter | ● | ● | ◐ | ◐ | ◐ | ◐ | ◐ (nice-to-have) |
| Weather integration | ● | ● | ● | ○ | ● | ● | ● **(dedicated weather view)** |
| Chores / routines | ● | ● | ● | ◐ | ○ | ○ | ○ (out of scope v1) |
| Reward / star system | ◐ | ● | ● | ○ | ○ | ○ | ○ |
| To-do / task lists | ● | ◐ | ● | ● | ◐ | ◐ | ◐ (could map to a Tasks cal) |
| Grocery / shopping list | ● | ◐ | ● | ● | ○ | ○ | ○ |
| Meal planning | ◐ | ◐ | ● | ● | ○ | ○ | ○ |
| Photo / screensaver mode | ◐ | ◐ | ● | ○ | ● | ◐ | ◐ **(via Fully + photo screen)** |
| AI import (email/photo→event) | ● Sidekick | ● Helper | ○ | ○ | ○ | ○ | ○ (future differentiator) |
| On-screen event create/edit | ● | ● | ● | ● | ◐ | ◐ | ◐ (write-back = stretch) |
| Voice control | ○ | ○ | ○ | ○ | ○ | ◐ | ○ |
| Offline tolerance | ○ poor | ○ | ◐ | ◐ | ○ | ◐ | ● **(cache last sync — easy win)** |
| Custom theming / layout | ◐ | ○ | ◐ | ◐ | ● CSS | ● | ● **(we control fully)** |
| Auto dim / motion wake | ◐ | ◐ | ◐ | ○ | ◐ | ◐ | ● **(Fully Kiosk native)** |

---

## 3. Prioritized Feature Recommendations for Our Kiosk

Scope reminder: **single-user / single-household, Google-Calendar-backed, web app in Fully Kiosk on a 9–11" tablet.** Recommendations are filtered for that scope — not every family-org feature is worth chasing.

### 3.1 Table Stakes (must ship in v1 — every competitor has these)

1. **Month view with embedded agenda** — the signature "family wall calendar" look. Combine a month grid with a side/bottom agenda ribbon of upcoming events (Skylight's most-loved view). This is the product's primary screen.
2. **Week view** — second core view; vertical time grid for the current/next week.
3. **Dedicated weather view + inline weather** — show today's forecast on the calendar (Skylight/Hearth/DAKboard all do) *and* a fuller weather screen. Use the user's location; free via Open-Meteo or similar.
4. **Swipe navigation** — left/right = previous/next period; this is the universal touch interaction. Up/down to scroll time grids in week/day. Non-negotiable on a touch kiosk.
5. **Per-calendar color coding** — map each Google sub-calendar to a distinct color (our equivalent of per-person colors). Legend visible.
6. **Multi-calendar support** — pull and merge all of the user's Google calendars (and shared/family calendars they subscribe to).
7. **Always-on, glanceable, large-type layout** — readable from across the room at 9–11". Clear "today" highlight, current-time line, bold date header. This is what makes it a *kiosk* vs a phone app.
8. **Auto-refresh / live sync** — poll Google Calendar on an interval so the wall display is never stale; show a subtle "last updated" / sync indicator.

### 3.2 Strong Differentiators (high ROI; we can match or beat incumbents cheaply)

1. **No subscription, no hardware lock-in** — our core market position vs Skylight/Hearth/DAKboard. Lead with it (Dragon Touch proves the appeal). Lifetime cost ≈ $0 + a tablet the user already owns.
2. **Offline resilience** — cache the last successful sync and keep rendering when WiFi drops. Skylight is "useless without WiFi" (a top complaint); this is a cheap, concrete win.
3. **Photo screensaver / ambient mode** — Skylight & Hearth gate this behind paid tiers; Dragon Touch & DAKboard make it a headline feature. Implement a photo/clock/weather screensaver that Fully Kiosk shows on idle and **wakes on motion** (Fully Kiosk does motion-wake + auto-dim natively — lean on the platform). High perceived value, low cost.
4. **Full custom theming** — we control 100% of CSS/layout (DAKboard charges for custom CSS; Skylight/Hearth barely theme). Ship light/dark + a couple of clean themes; nail typography and contrast for wall viewing.
5. **Per-person/per-calendar filter** — tap a color chip to isolate one calendar. Cheap to build, matches Skylight's loved "filter to my calendar" behavior.
6. **Smart day-transition & "today" focus** — auto-scroll/auto-advance to the current day at midnight, surface "now/next" event prominently. Ambient intelligence without AI cost.

### 3.3 Premium / Stretch (defer past v1 — higher effort or out of core scope)

1. **On-screen event create/edit (two-way write-back)** — Google's only *full* two-way sync partner is the incumbents' strength. Adding tap-to-create/edit via Google Calendar API would put us at parity with Skylight on its best sync path. **High value but real auth/write complexity — phase 2.**
2. **To-do / task list view** — map to Google Tasks or a dedicated "Tasks" calendar rather than building a list engine. Only if there's demand; not core to a calendar kiosk.
3. **AI import (photo/email → event)** — Skylight's *Sidekick/Magic Import* and Hearth's *Helper* are the genuine premium differentiators in the category and the hardest for free competitors to copy. A future LLM-backed "snap a flyer → event" flow could be our standout, but it's clearly post-v1.
4. **Meal planning / grocery / chore-reward systems** — these are Cozi/Hearth/Skylight family-org features that are **out of scope** for a Google-Calendar-backed single-household kiosk. Skip unless the product pivots toward full family organizer. Listed only so we consciously *choose not* to chase them in v1.

### 3.4 Explicit non-goals for v1
Voice control (no competitor nails it anyway), chore/reward gamification, meal planning, recipe box, and dedicated shopping lists. These would dilute a focused, beautiful, free calendar kiosk.

---

## 4. Bottom-Line Strategic Read

- The paid incumbents (Skylight $150–600 + $79/yr; Hearth $699 + $86/yr) monetize **hardware + a subscription that gates screensaver, meal planning, chore rewards, and AI import**. Their genuinely hard-to-copy moat is **AI event import (Sidekick / Magic Import / Helper)** — everything else (views, colors, weather, swipe) is table stakes we can match for free.
- **Dragon Touch (no subscription)** and **DAKboard / MagicMirror (BYO-screen, configurable)** validate our exact wedge: people resent the recurring fee and the locked hardware. We win by being the **polished, zero-cost, BYO-tablet** option — MagicMirror's flexibility with Skylight's out-of-box polish.
- For v1, **out-execute on the basics that everyone has but few do beautifully on a small screen** (month+agenda, week, weather, swipe, per-calendar colors, big legible type), then **beat the incumbents on offline resilience and a free photo/ambient screensaver**, and reserve **two-way edit and AI import** as the phase-2 differentiators that close the gap with Skylight.
