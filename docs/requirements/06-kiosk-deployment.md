# 06 — Kiosk Deployment & Device Operations Requirements

**Component:** Calendar Kiosk (Android tablet, Fully Kiosk Browser, 24/7, private home)
**Author:** Kiosk Deployment & Device Operations
**Status:** Draft for implementation
**Scope:** Fully Kiosk Browser configuration (lockdown, autostart, screen/day-night scheduling, motion wake, scheduled reboot, remote admin/REST API, PLUS features, cache, JS injection, allowed URLs, gesture/swipe handling, immersive fullscreen), 24/7 power & battery safety, burn-in mitigation, scheduled app reload, Wi-Fi reconnection, OS update management, hardware specs, a step-by-step setup checklist, and an operational runbook.

---

## 1. Deployment summary and goals

The product is a single web app (household calendar + weather) running on a wall-mounted ~9–11" Android tablet, powered on continuously in a home. The device must:

- Boot directly into our web app with **no visible browser chrome, no system bars, no launcher access**, and survive power loss / reboots unattended.
- Stay **awake and legible during the day**, **dim or sleep at night**, and **wake on motion** so it isn't a glowing rectangle at 3 a.m.
- **Recover itself** from the common failure modes of an always-on web kiosk — memory leaks, dropped Wi-Fi, a hung WebView, an OS that decided to nap — without anyone touching the wall.
- Be **remotely recoverable** from a phone or laptop on the home LAN when self-recovery isn't enough.

The chosen software is **Fully Kiosk Browser** (`de.ozerov.fully`) with a **Fully PLUS** license. PLUS is effectively mandatory here — the day/night scheduler, motion wake, JavaScript injection, screen-off timer, scheduled restart, and remote admin/REST API are all PLUS-gated (see §3). PLUS is a **one-time ~€7.90 per device** perpetual license; there is no recurring fee for a single self-hosted device. (Fully Cloud is a separate optional subscription for fleet management and is **not required** for one home tablet.)

> Note on values: every numeric value below (timeouts, brightness 0–255, schedules) is a **recommended starting point**. Tune against the specific panel and room. Brightness in Fully is on a **0–255** scale, not 0–100.

**Sources:** [Fully Kiosk help](https://www.fully-kiosk.com/en/) · [PLUS single license](https://license.fully-kiosk.com/license/single) · [Fully Cloud REST API (PDF)](https://www.fully-kiosk.com/files/2024/09/Fully-Cloud-API-1.5.pdf)

---

## 2. Hardware requirements and recommendation

A consumer tablet runs fine as a home calendar kiosk; you do not need rugged/commercial hardware. But three traits matter disproportionately for an *always-on, wall-mounted* device.

### 2.1 Minimum spec (hard requirements)

| Attribute | Minimum | Why |
|---|---|---|
| Screen size | 9–11" | Legibility across a room; matches the brief. |
| Resolution | **1920×1200 (FHD+) or better** | Below ~1080p, calendar text is fuzzy at viewing distance. Don't drop below 1080p. |
| RAM | **4 GB minimum, 6–8 GB preferred** | A long-lived WebView leaks memory over days; headroom delays OOM kills and reloads. |
| Brightness | **≥ 400 nits** | Daytime legibility on a wall, often near a window. |
| Android version | **Android 11+ (ideally 12/13+)** | Needed for current Fully lockdown features and ongoing security patches. |
| Charging | USB-C, standard (not fast-charge dependent) | See §6 — slow charging is *better* here. |
| Front camera | Yes | Required for **visual** motion detection (microphone covers acoustic). |

### 2.2 Recommended models

- **Lenovo Tab M-series (M10/M11, P11/P12)** — the de-facto home-kiosk default: cheap, FHD, decent RAM options, large install base, well-documented with Fully. The P-series gets you 6–8 GB RAM and a brighter panel.
- **Samsung Galaxy Tab A9+ / Tab S-series** — better panels and longer OS support; Tab S adds AMOLED (great contrast, **but see burn-in §7 — prefer LCD/IPS for always-on**).
- **Amazon Fire tablets** — cheapest path, *but* FireOS requires sideloading Fully, lacks Google services, and has aggressive ad/OS behavior. **Not recommended** for a Google-Calendar-backed app; the integration friction isn't worth the savings.

**Recommendation for this deployment:** a **Lenovo Tab P11 (Gen 2) or P12 class device, 6 GB RAM, FHD+ IPS LCD, ~400 nits, Android 12/13.** IPS over AMOLED specifically to avoid static-UI burn-in (§7).

**Sources:** [Hexnode — choosing a kiosk tablet](https://www.hexnode.com/blogs/how-to-choose-the-best-android-tablet-for-kiosks/) · [Esper — best kiosk tablet](https://www.esper.io/blog/how-to-choose-the-best-android-tablet-for-business)

---

## 3. PLUS license & feature dependency map

Confirm before buying that the features the design depends on are PLUS-only. They are:

| Feature we rely on | PLUS-gated? | Setting name in Fully |
|---|---|---|
| Day/night sleep & wake schedule | **Yes** | *Schedule Wakeup/Sleep* (per-day-of-week) |
| Screen-off after inactivity | **Yes** | *Screen Off Timer* |
| Visual motion detection (camera) | **Yes** | *Visual Motion Detection* |
| Daily scheduled restart | **Yes** | *Daily Device Restart / Restart App* |
| Remote Admin + REST API | **Yes** | *Enable Remote Administration* |
| Inject JavaScript per page | **Yes** | *Inject JavaScript* |
| JavaScript Interface (`fully.*`) | **Yes** | *Enable JavaScript Interface* |
| Screensaver (media/website/dim) | **Yes** | *Screensaver* settings |
| Kiosk lockdown, autostart, keep-screen-on, immersive fullscreen, URL whitelist, auto-reload, cache control, disable gestures | No (free) | various |

**Decision: purchase one Fully PLUS single license (~€7.90) per device.** It is a perpetual, one-time cost. Activate it early so trial watermarks don't appear on the screensaver/injection features.

---

## 4. Fully Kiosk Browser configuration (in depth)

Settings are grouped by Fully's own menu structure. Names match the in-app labels (Fully renames occasionally between versions; the grouping is stable).

### 4.1 Web Content & Startup
- **Start URL:** the calendar app URL (e.g. `https://kiosk.local/` or the hosted URL). This is what loads on launch and on reload.
- **Wait for internet connection on start:** **ON** — avoids a flash of error page on boot before Wi-Fi associates.
- **Error/offline URL (PLUS):** point at a local "reconnecting…" page or `fully://color#000000`, so a transient outage shows a calm screen, not a Chrome error.

### 4.2 Kiosk lockdown (Kiosk Mode menu)
- **Enable Kiosk Mode:** **ON**. Set a **strong Kiosk Exit PIN** (not 1234). Record it in the runbook (§12), not on the device.
- **Disable Status Bar / Disable Status Bar Pulldown:** **ON** — blocks the notification shade.
- **Disable Home/Recents/Back where offered:** **ON** for Home and Recents. Decide Back per app behavior; for a single-page calendar, disable Back too.
- **Disable Power Button / Volume Buttons:** **ON** (power button best-effort on non-rooted devices).
- **URL Whitelist:** add **only** the calendar app origin(s) and any auth/redirect origins it genuinely needs (e.g. Google OAuth domains during sign-in). Everything else is blocked. Keep this list as tight as the auth flow allows.
- **Single App Mode / Lock to app:** if the OS supports screen pinning, enable for an extra lockdown layer.
- **Kiosk Exit Gesture:** default is *swipe from left edge* + PIN. Keep it but train the household — see §4.7 for the swipe conflict.

### 4.3 Autostart on boot
- **Launch on Boot:** **ON**.
- **Keep launching after crash / Watchdog:** enable Fully's *Force Restart App on Idle* / crash-relaunch options so a WebView crash self-heals.
- Set Fully as **default launcher / home app** (`Disable Home Button` + assign Fully as Home) so even an unexpected exit lands back in Fully, not the Android launcher.
- Disable Android's **battery optimization** for Fully (Settings → Apps → Fully → Battery → *Unrestricted*) so the OS never freezes it. This is the single most common cause of "it just stopped overnight."

### 4.4 Keep awake, brightness & day/night scheduling
- **Keep Screen On:** **ON** (prevents OS sleep while active).
- **Screen Brightness:** set a daytime value, e.g. **~180/255 (~70%)**. Avoid 255 — it adds heat and burn-in risk (§6, §7).
- **Screen Off Timer (PLUS):** seconds of inactivity before the screen turns off (or screensaver/dim engages). For a wall calendar you usually want it **always on during the day** (set 0/disabled) and let the **night schedule** handle off-hours.
- **Schedule Wakeup/Sleep (PLUS):** per-day-of-week. Example: **screen OFF 23:00, screen ON 06:30**. This is the primary day/night control.
- **Screensaver (PLUS) as a dimming layer:** instead of full-off at night, you can run the screensaver at a **low brightness** (e.g. brightness 5–20/255) showing `fully://color#000000` so the panel is effectively dark but motion can still wake it. Choose **one** night strategy — full screen-off (saves most power/burn-in) **or** dim screensaver (instant, silent wake). For a bedroom-adjacent wall, full-off is usually better.

### 4.5 Motion-detection wake (front camera)
- **Visual Motion Detection (PLUS):** **ON**, using the front camera.
- **Turn Screen On on Motion:** **ON** — walking up to the tablet wakes it from the night screen-off/screensaver.
- **Motion Sensitivity / detection threshold:** tune to avoid false wakes from curtains/pets but reliably trigger on a person approaching. Start mid-range and adjust.
- **Acoustic motion detection** (microphone) is an alternative/supplement that works in complete darkness — useful if the camera view is dark at night. Privacy note: camera/mic are processed **on-device** by Fully; document this for household consent (cross-ref security doc 09).
- Interaction with schedule: motion wake should bring the screen up *temporarily*; the wake/sleep schedule re-asserts the night-off state after the inactivity timer. Verify this hand-off during commissioning.

### 4.6 Immersive fullscreen / hiding system bars
- **Fullscreen Mode (immersive sticky):** **ON** — hides status and navigation bars for a true edge-to-edge calendar.
- **Hide/Remove Navigation Bar:** **ON** where offered.
- **Disable Notifications / Status Bar Pulldown:** **ON** (also under lockdown).
- Confirm there is **no visible browser URL bar, no Fully toolbar** (disable the action bar / motion menu) in normal operation.

### 4.7 Swipe / gesture handling — avoiding interception of our app's swipes

This is the subtle one. Our calendar app likely uses its own swipes (e.g. swipe between days/weeks). Fully and Android both want those swipes.

Configure to **let the web app own touch**:
- **Disable Fully's gesture features that consume swipes:** turn **OFF** *Swipe to Navigate* (history back/forward) and *Swipe to Change Tabs* (both PLUS conveniences we don't want). These would otherwise eat horizontal swipes meant for the calendar.
- **Enable Pull-to-Refresh:** **OFF** — a downward swipe inside the app should scroll/act in-app, not trigger Fully's reload. (We have scheduled auto-reload instead, §4.9.)
- **Enable Dragging:** **ON** (default). *Do not* disable it — disabling kills WebView scrolling/dragging (v1.40+), which would break a scrollable agenda.
- **Disable Long Clicks / context menu:** **ON** — kills the long-press selection/context menu without affecting normal swipes.
- **Kiosk exit gesture vs. left-edge app swipes:** the default exit is *swipe from the left edge*. If the calendar uses left-edge swipes, **change the exit gesture** (e.g. to a corner tap pattern or a multi-finger gesture) so admin exit and app navigation don't collide. On Android 10+ with gesture nav, the user must *hold briefly* at the edge before the exit menu appears — document this for whoever does maintenance.
- **System gesture-nav conflict:** prefer setting Android to **3-button nav** (then hide the bar via immersive mode) over gesture-nav, to remove the OS-level edge-swipe competition entirely.

Net rule: **Fully should pass touches straight through to the WebView; only the deliberate, reconfigured exit gesture is reserved for admin.**

### 4.8 JavaScript injection & interface
- **Inject JavaScript (PLUS):** runs our snippet after every page load. Use sparingly — e.g. to force a CSS tweak, suppress text selection, or call into the app. Keep injected code in version control alongside the app, not only on the device.
- **Enable JavaScript Interface (PLUS):** exposes the `fully.*` JS API to the page (battery level, screen control, reload, device info, screenshot trigger, etc.). Useful if the app wants to display device/battery status or trigger a controlled reload. **Only enable if the start URL is trusted** — it grants the page device control. Since the URL whitelist is locked to our own origin, this is acceptable here.

### 4.9 Auto-reload, cache, and memory hygiene
- **Auto Reload on Idle:** reload the start URL after **N seconds of inactivity** — e.g. **900 s (15 min)**. This quietly returns the app to a known-good state and trims WebView memory between interactions.
- **Reload on Screen On:** **ON** — fresh data whenever someone wakes the device.
- **Auto Reload on Network Reconnect:** **ON** — recover content after a Wi-Fi blip (pairs with §8).
- **Delete WebView Cache on Reload / Clear Cache:** enable periodic cache clearing to bound storage growth; do **not** clear cache so aggressively that you wipe service-worker/offline data the app relies on (cross-ref offline doc 08). Prefer *cache* clearing over *web storage* clearing.
- **Scheduled app/device restart (PLUS):** schedule a **daily restart during the night-off window (e.g. 04:00)** — full process restart clears leaked memory the soft reload can't. Choose **restart app** (lighter) and additionally a **weekly full device reboot** for OS-level cleanup. See §9 for OS reboot vs. app restart trade-off.

### 4.10 Remote administration & REST API
- **Enable Remote Administration (PLUS):** **ON**, with a **strong Remote Admin password** (distinct from the kiosk exit PIN).
- Access: `http://<tablet-ip>:2323` from any browser on the home LAN. Reserve a **static/DHCP-reserved IP** for the tablet so the address is stable.
- **Security:** keep remote admin **LAN-only** — do **not** port-forward 2323 to the internet. For off-LAN access use a VPN into the home network (cross-ref security doc 09). Use HTTPS/local-only as available.
- **REST API:** every setting and action is scriptable via `http://<ip>:2323/?cmd=<command>&password=<pass>`. Key commands for our runbook:
  - `screenOn` / `screenOff` / `forceSleep` — screen control.
  - `loadStartURL` / `loadURL?url=…` — reload or navigate.
  - `restartApp` — relaunch Fully (soft recovery).
  - `rebootDevice` — full reboot (needs device admin/root for unattended; otherwise prompts).
  - `clearCache` / `clearWebstorage` — storage hygiene.
  - `setBooleanSetting` / `setStringSetting` — change any config remotely (e.g. brightness, motion sensitivity) without walking to the wall.
  - `getDeviceInfo` — battery %, IP, screen state, for health checks.
  - `screenshot` / `getCamshot` — confirm what's actually on screen during remote troubleshooting.
  - Full reference: **https://www.fully-kiosk.com/#rest**.

**Sources:** [Fully Cloud/REST API (PDF)](https://www.fully-kiosk.com/files/2024/09/Fully-Cloud-API-1.5.pdf) · [Fully REST integration walkthrough](https://kleypot.com/fully-kiosk-rest-api-integration-in-home-assistant/)

---

## 5. Configuration management

- **Export settings to JSON** once the device is dialed in (Fully → Settings → Export). Store this JSON in the project repo next to this doc. It is the canonical device config and the fast path to re-provision a replacement tablet.
- Treat injected JS, the start URL, and the settings JSON as **version-controlled artifacts**, not device-only state.
- Document all secrets (kiosk PIN, remote-admin password, Wi-Fi creds) in the team's secret store, **never on the tablet** (cross-ref security doc 09).

---

## 6. 24/7 power & battery safety

A tablet plugged in 24/7 sits at 100% charge continuously, which generates heat and accelerates lithium-ion degradation and **battery bloat** — the most common hardware failure of always-on kiosks.

**Requirements:**
1. **Use a slow/standard charger, not a fast charger.** The device is always plugged in; it never needs to charge quickly. Slow charging runs cooler. (Avoid OEM fast-charge bricks here.)
2. **Lower brightness reduces heat and battery strain.** ~70% (180/255) daytime, dimmed/off at night (§4.4). This is a power *and* longevity *and* burn-in win simultaneously.
3. **Ventilation:** the wall mount/enclosure must not block the tablet's vents or camera; leave airflow gaps. Trapped heat is what bloats batteries.
4. **Battery-level charge control (best option if available):** if the tablet or a charge controller supports it, **cap charging at ~80%** or cycle charge between ~40–80% (some kiosk power adapters / USB charge limiters do this; a few OEMs have a "battery protection / 85% limit" setting). This is the single best longevity measure.
5. **Inspect periodically:** a swelling battery lifts the screen or back panel — replace immediately (safety hazard). Budget for battery replacement as a consumable on a multi-year deployment.
6. **Surge protection:** put the charger on a surge-protected outlet; consider a small UPS so brown-outs don't constantly hard-cut the device.

**Sources:** [Lava — avoiding battery bloat](https://lavalink.com/lavablog/articles/is-your-tablets-battery-bloating-4-tips-to-avoid-this-issue/) · [SmartThings — 24/7 tablet charging](https://community.smartthings.com/t/fire-tablet-kiosk-charging-24-7-okay/182227)

---

## 7. Screen burn-in mitigation (always-on static UI)

A calendar is a static layout — grid lines, header, weather widget in the same pixels for years. That is the worst case for burn-in/image retention, especially on OLED/AMOLED.

**Requirements:**
1. **Prefer IPS LCD over AMOLED** for this static-content kiosk (drives the hardware pick in §2.2). LCD is far more burn-in resistant.
2. **Night screen-off** via the wake/sleep schedule (§4.4) — the panel is off ~7 h/day, the biggest single mitigation.
3. **Moderate brightness** (§6) — burn-in scales with luminance.
4. **Periodic full reload / restart** (§4.9) — pair with subtle app-side rotation if feasible (e.g. small periodic 1px shifts, alternating accent, or a clock that moves), so no pixel holds a fixed bright element indefinitely. *(App-side concern — flag to the app team; not a Fully setting.)*
5. **Screensaver as pixel-shifter:** if not doing full night-off, a moving/dark screensaver during idle reduces static dwell time.
6. Avoid pure-white backgrounds and static high-contrast bright elements in the app design where possible.

---

## 8. Wi-Fi reconnection

A home AP reboots, the ISP blips, the channel changes — the kiosk must recover unattended.

- **Wait for internet on start** (§4.1) so boot doesn't race the network.
- **Auto Reload on Network Reconnect** (§4.9) — re-fetch content the moment Wi-Fi is back.
- **Custom offline/error URL** (§4.1) — show a calm "reconnecting…" screen instead of a Chrome dinosaur during the gap.
- **WiFi handling (PLUS):** enable Fully's *Force WiFi on* / *Reset WiFi on disconnection* so it re-enables and re-associates after a drop.
- **Disable Android Wi-Fi power saving** for the kiosk (keep Wi-Fi on during sleep: *Always*), and disable battery optimization (§4.3), so the radio doesn't get parked overnight.
- **Static DHCP reservation** for the tablet (§4.10) keeps remote admin reachable across reconnects.
- **AP placement:** ensure strong signal at the wall location; a marginal link is the root cause of most "calendar is stale" complaints.

---

## 9. OS update management

- **Disable automatic, unattended OS updates** that can reboot at random and land on a launcher or update prompt instead of the app. Set system updates to **manual/notify-only**.
- **Apply OS security patches on a deliberate schedule** (e.g. quarterly), during a maintenance window, with someone watching the device come back up and re-enter kiosk mode. Cross-ref security doc 09 — patching is a real obligation for an internet-connected, token-holding device.
- **Pin the Fully app version**: update Fully intentionally, not via background auto-update, and re-verify the config after each Fully update (settings labels and behavior occasionally shift).
- After **any** OS or Fully update: confirm autostart, immersive mode, motion wake, schedule, and remote admin all still work (run the §11 checklist's verification steps).
- **App restart (daily, §4.9) vs. device reboot (weekly):** the daily Fully restart clears WebView memory; a **weekly scheduled full device reboot** (e.g. Sunday 04:00 via `rebootDevice` or Fully's daily-restart-as-reboot) clears OS-level cruft and re-establishes Wi-Fi/connections cleanly. Unattended `rebootDevice` typically needs device-owner/admin privileges; grant Fully device admin during provisioning.

---

## 10. Day/night behavior — worked example

A concrete, copy-able profile to start from (tune to the household):

| Time | State | Mechanism |
|---|---|---|
| 06:30–23:00 | Full brightness-on calendar, ~70% brightness, always awake | Keep Screen On + Wake schedule |
| 23:00–06:30 | Screen OFF | Sleep schedule |
| Any time, motion detected | Screen wakes for the inactivity window, then returns to scheduled state | Visual/acoustic motion + Turn Screen On on Motion |
| Every 15 min idle | Soft reload of start URL | Auto Reload on Idle |
| On Wi-Fi reconnect / screen-on | Reload start URL | Reload on reconnect / screen-on |
| 04:00 daily | App restart (clears memory) | Daily restart (PLUS) |
| Sunday 04:00 | Full device reboot | rebootDevice / weekly schedule |

---

## 11. Step-by-step Fully Kiosk setup checklist

Do these in order on a freshly set-up tablet.

**A. OS prep (before Fully)**
1. Complete Android setup; connect Wi-Fi; sign into the Google account the app needs.
2. Set **screen lock to None** (it's a kiosk) — accept this is a physical-security trade-off (see doc 09).
3. Display: set **3-button navigation** (not gesture nav). Set **auto-rotate OFF**, orientation as mounted.
4. Battery: **disable adaptive battery / battery saver**; later set Fully to *Unrestricted*.
5. System updates: set to **manual/notify-only**.
6. If supported, enable **battery charge limit (~80–85%)**.
7. Apply current OS security patches now, before locking down.

**B. Install & license**
8. Install **Fully Kiosk Browser** from Play Store.
9. Open Fully, purchase/activate **Fully PLUS** (~€7.90) and apply the license key.
10. Grant Fully all permissions it requests: camera (motion), microphone (acoustic motion, optional), and **device admin** (for reboot/lock).
11. Set Fully → Battery → **Unrestricted** (no OS optimization).

**C. Core web + lockdown**
12. Set **Start URL** to the calendar app.
13. Enable **Kiosk Mode**; set a strong **exit PIN** (record off-device).
14. Add **URL Whitelist** = app origin + required auth origins only.
15. Disable **status bar, pulldown, home, recents, back (per app), power & volume buttons**.
16. Enable **Fullscreen (immersive sticky)** and **hide navigation bar**.

**D. Startup & resilience**
17. Enable **Launch on Boot**; set Fully as **Home/default launcher**.
18. Enable **crash relaunch / watchdog**.
19. Enable **Wait for internet on start**; set **offline/error URL**.

**E. Screen, schedule, motion**
20. **Keep Screen On: ON**; brightness **~180/255**.
21. **Schedule Wakeup/Sleep:** OFF 23:00 / ON 06:30 (all days).
22. **Visual Motion Detection: ON**; **Turn Screen On on Motion: ON**; tune sensitivity.
23. (Optional) acoustic motion for dark-room wake.
24. Decide night strategy: **full screen-off** (recommended) or dim screensaver.

**F. Touch / gesture (critical for our app)**
25. **Swipe to Navigate: OFF**, **Swipe to Change Tabs: OFF**, **Pull-to-Refresh: OFF**.
26. **Enable Dragging: ON** (leave default). **Disable Long Clicks: ON**.
27. If app uses left-edge swipes, **change the kiosk exit gesture** off the left edge.

**G. Memory & cache hygiene**
28. **Auto Reload on Idle:** 900 s. **Reload on Screen On: ON.** **Reload on Network Reconnect: ON.**
29. **Periodic cache clear** on reload (preserve offline/service-worker storage — cross-ref doc 08).
30. **Daily app restart 04:00**; **weekly device reboot Sun 04:00**.

**H. Wi-Fi**
31. Wi-Fi: **keep on during sleep = Always**; enable Fully *Reset WiFi on disconnection*.
32. Router: assign a **DHCP reservation / static IP** to the tablet.

**I. Remote admin**
33. Enable **Remote Administration**; set a **strong password** (≠ exit PIN).
34. Confirm `http://<tablet-ip>:2323` loads from your phone/laptop on the LAN.
35. **Do not** port-forward 2323; use VPN for off-LAN.

**J. JS (if used)**
36. Add **Inject JavaScript** snippet (from repo) if needed.
37. Enable **JavaScript Interface** only if the app uses `fully.*` (safe here — whitelisted origin).

**K. Finalize**
38. **Export settings to JSON**; commit to repo.
39. Reboot the tablet and verify it cold-boots straight into the locked, fullscreen app.
40. Mount, dress cables, confirm vents clear, run §10 behaviors over 24 h.

---

## 12. Operational runbook

Record on the maintenance card (kept off the device): **tablet IP, remote-admin URL `http://<ip>:2323`, remote-admin password, kiosk exit PIN, Wi-Fi SSID.**

### 12.1 Tiered recovery — try cheapest first

| Symptom | Tier 1 (remote, soft) | Tier 2 (remote, hard) | Tier 3 (physical) |
|---|---|---|---|
| **Stale data / blank content** | `…/?cmd=loadStartURL&password=…` | `…/?cmd=clearCache…` then `loadStartURL` | At device: exit kiosk (gesture+PIN), reload |
| **App frozen / unresponsive touch** | `…/?cmd=restartApp&password=…` | `…/?cmd=rebootDevice&password=…` | Hold power → restart; or pull/replug power |
| **Black screen, won't wake** | `…/?cmd=screenOn&password=…` | `…/?cmd=rebootDevice…` | Tap screen (motion wake) → replug power |
| **Off the network (no remote)** | — | — | Check AP/router; verify Wi-Fi joined; reboot device |
| **Exited to Android launcher** | `…/?cmd=loadStartURL…` may not help | reconfigure autostart/Home | Re-open Fully; re-set as Home/launcher |
| **Battery swelling / panel lifting** | — | — | **Power down, stop using, replace battery/tablet** |

Use `…/?cmd=getDeviceInfo&password=…` to read battery %, screen state, and IP, and `…/?cmd=screenshot…` to see what's actually displayed before deciding.

### 12.2 "It froze" decision flow
1. Can you reach `:2323`? → **Yes:** `getDeviceInfo` → `restartApp` → if still bad `rebootDevice`. **No:** go to step 3.
2. After `restartApp`, confirm with `screenshot`. Resolved? Done.
3. Not reachable → network problem. Check router/AP up, tablet still on Wi-Fi (it may have dropped). Reboot the AP if needed; the tablet should auto-reconnect and auto-reload.
4. Still dead → physical: tap to wake, replug power, hold power to reboot. If it boots but doesn't enter the app → autostart/Home config regressed (re-do §11 D).
5. Recurring freezes → suspect memory leak (shorten reload/restart interval, add RAM/replace tablet) or a failing battery (§6).

### 12.3 Routine maintenance
- **Weekly:** glance at the device; confirm time/data are current; check `getDeviceInfo` battery/health.
- **Monthly:** verify schedule, motion wake, and remote admin still work; check for battery swelling; confirm vents clear.
- **Quarterly:** apply OS security patches in a watched maintenance window (§9); re-verify full config; re-export settings JSON if changed.
- **After any OS/Fully update:** run §11 verification (autostart, immersive, motion, schedule, remote admin).

### 12.4 Replacement / re-provision
A spare tablet pre-loaded from the exported settings JSON (§5) is the fastest recovery from a dead device: install Fully → apply PLUS → import settings JSON → set Start URL/secrets → sign into Google → mount. Keep one cold spare for a calendar that the household depends on.

---

## 13. Open items / cross-references

- **App-side burn-in mitigation** (pixel-shift / non-static layout) — flag to app team (§7.4).
- **Cache-clear vs. offline storage** — coordinate with **doc 08 (data sync / offline)** so hygiene doesn't wipe needed offline state.
- **Camera/mic consent, remote-admin exposure, no-lockscreen trade-off, secrets storage** — governed by **doc 09 (security & privacy)**.
- **Exact start URL, auth/redirect origins for the whitelist** — depends on final app + auth design (doc 00 / auth docs).

---

## Sources

- [Fully Kiosk Browser — official help/feature reference](https://www.fully-kiosk.com/en/)
- [Fully PLUS single license & pricing](https://license.fully-kiosk.com/license/single)
- [Fully Cloud / REST API reference (PDF)](https://www.fully-kiosk.com/files/2024/09/Fully-Cloud-API-1.5.pdf)
- [Fully REST API integration walkthrough (kleypot)](https://kleypot.com/fully-kiosk-rest-api-integration-in-home-assistant/)
- [Hexnode — choosing an Android kiosk tablet](https://www.hexnode.com/blogs/how-to-choose-the-best-android-tablet-for-kiosks/)
- [Esper — best Android kiosk tablet](https://www.esper.io/blog/how-to-choose-the-best-android-tablet-for-business)
- [Lava — avoiding tablet battery bloat](https://lavalink.com/lavablog/articles/is-your-tablets-battery-bloating-4-tips-to-avoid-this-issue/)
- [SmartThings community — 24/7 tablet charging](https://community.smartthings.com/t/fire-tablet-kiosk-charging-24-7-okay/182227)
