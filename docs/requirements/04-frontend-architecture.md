# 04 — Technical Architecture & Tech-Stack Requirements

**Project:** Calendar Kiosk Web App
**Target device:** ~9–11" Android tablet running Fully Kiosk Browser, 24/7, unattended for months
**Author role:** Principal Frontend / Full-stack Architect
**Status:** Recommendation / Decision document
**Last updated:** 2026-06-18

---

## 0. Executive summary (TL;DR)

Build a **Svelte 5 + Vite** single-page PWA for the tablet, served as static files, talking to a **single Cloudflare Worker** that holds the Google OAuth refresh token (in Workers KV / encrypted secret) and proxies/normalizes the Google Calendar and weather APIs. The tablet **never sees the refresh token** and only ever receives already-fetched, shaped JSON — this is the single most important architectural decision: **token custody lives server-side, the kiosk is a dumb-but-resilient renderer.**

Why this shape wins for this specific problem:

- **Long-running stability:** Svelte compiles away the framework, has a flat memory profile under sustained operation, and a tiny bundle — exactly what a device that must run for months without a reload needs.
- **Auth that survives 3+ months:** The 7-day refresh-token death only applies to "Testing" OAuth apps. We publish to **Production** and store the refresh token on the Worker. The kiosk being offline/asleep can never expire the token because the *server* keeps it warm.
- **Easy to iterate locally:** Plain Vite + npm + Wrangler. Edit a file, hot-reload, `git commit`, `wrangler deploy` / push. This directly fixes the prior pain point — the old version was built in Google AI Studio and was hard to iterate on. Everything here is standard, boring, local tooling.

---

## 1. Goals, constraints, and non-goals

### 1.1 Functional requirements
- Read-only Google Calendar (one or more calendars).
- Three views: **Month + Agenda**, **Week**, **Weather**.
- **Swipe navigation** between views and between time periods (prev/next month/week).
- Runs full-screen in Fully Kiosk Browser on an Android tablet.

### 1.2 Operational requirements (the hard part)
- **24/7 for months** with no manual reload, no memory growth, no auth re-prompt.
- **OAuth alive for 3+ months** without human intervention.
- **Survives network blips** — calendar must keep rendering from cache if Wi-Fi drops.
- **Remotely observable** — the owner should learn the device is dead *before* walking up to a black screen.
- **Cheap** — ideally $0/month, at most a few dollars.

### 1.3 Non-goals
- No write access to the calendar (no event creation/editing) in v1.
- No multi-tenant / multi-user accounts — this is a single household device.
- No native Android app — Fully Kiosk Browser + PWA is the delivery vehicle.

---

## 2. Overall architecture

### 2.1 The core decision: thin client, server-side token custody

There are two viable shapes:

| Option | Token location | Verdict |
|---|---|---|
| **A. Pure SPA, no backend** — tablet does OAuth directly, holds refresh token in localStorage | On the tablet | **Rejected.** Browser-side OAuth for installed/SPA apps cannot safely hold a long-lived refresh token; Google's web flow + token storage on an unattended public-ish device is a security and longevity liability. If the tablet clears storage or the token expires while the device is asleep, auth is dead and someone must physically re-auth. |
| **B. SPA + lightweight backend** — backend holds refresh token, mints access tokens, proxies Calendar | On the server (Worker secret/KV) | **Chosen.** The token is custodied in one controlled place, kept warm by the server regardless of tablet state, and the tablet only ever receives shaped, read-only JSON. |

**We choose B.** The backend is deliberately tiny: it is a *token custodian + API proxy + response normalizer*, not an application server. It has no database of user data, no sessions, no business logic beyond "fetch calendar/weather, shape it, cache it, return it."

This also decouples Google API churn from the kiosk: if Google changes a field or rate-limits, we fix it in the Worker and redeploy — the kiosk code never changes.

### 2.2 Reference architecture (ASCII)

```
                          ┌──────────────────────────────────────────────┐
                          │                 GOOGLE                         │
                          │   OAuth 2.0  +  Calendar API (read-only)        │
                          └───────────────▲───────────────┬───────────────┘
                                          │ refresh→access│ events
                                          │   token       │
                                          │               ▼
   ┌───────────────────────────────────────────────────────────────────────┐
   │                       CLOUDFLARE WORKER  (the only backend)             │
   │                                                                         │
   │   GET /api/calendar?range=...   ─┐                                      │
   │   GET /api/weather?loc=...      ─┤  Endpoints (read-only to client)     │
   │   GET /api/health               ─┘                                      │
   │                                                                         │
   │   ┌─────────────┐   ┌──────────────────┐   ┌────────────────────────┐  │
   │   │ Token mgr   │   │ Calendar proxy & │   │ Edge cache (KV / Cache  │  │
   │   │ refresh→    │──▶│ normalizer       │──▶│ API) 60–120s TTL        │  │
   │   │ access tok  │   │ (shape JSON)     │   │ + weather 10–15min TTL  │  │
   │   └─────┬───────┘   └──────────────────┘   └────────────────────────┘  │
   │         │                                                               │
   │   ┌─────▼───────────────────────────┐   ┌───────────────────────────┐  │
   │   │ Workers KV / encrypted secret:  │   │ Heartbeat ping out to      │  │
   │   │   GOOGLE_REFRESH_TOKEN          │   │   healthchecks.io (cron)   │  │
   │   │   GOOGLE_CLIENT_ID / SECRET     │   └───────────────────────────┘  │
   │   │   WEATHER_API_KEY               │                                  │
   │   └─────────────────────────────────┘                                  │
   └───────────────────────▲─────────────────────────────┬─────────────────┘
                            │  shaped JSON (HTTPS)        │ heartbeat (cron)
                            │                             ▼
                            │                   ┌───────────────────────┐
                            │                   │   healthchecks.io      │
                            │                   │  (dead-man's switch →   │
                            │                   │   email/Slack alert)    │
                            │                   └───────────────────────┘
   ┌────────────────────────┴──────────────────────────────────────────────┐
   │            ANDROID TABLET  —  Fully Kiosk Browser (full screen)         │
   │                                                                         │
   │   ┌──────────────────── Svelte 5 SPA (PWA) ───────────────────────┐    │
   │   │  Router/View switcher (Month+Agenda | Week | Weather)          │    │
   │   │  Embla swipe engine  •  TanStack-Query-style cache (or Svelte  │    │
   │   │  stores + svelte-query)  •  date-fns/Temporal  •  watchdog     │    │
   │   └────────────────────────────────────────────────────────────────┘   │
   │   ┌──────────────── Service Worker (Workbox) ─────────────────────┐    │
   │   │  app shell: precache  •  /api/calendar: stale-while-revalidate │    │
   │   │  /api/weather: SWR  •  offline fallback render                  │    │
   │   └────────────────────────────────────────────────────────────────┘   │
   │   Fully Kiosk: daily scheduled reboot • screensaver off • auto-relaunch │
   └─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Request lifecycle

1. Tablet SPA polls `GET /api/calendar?range=<visible window>` every N minutes (and on view change).
2. Service Worker answers from cache **immediately** (stale-while-revalidate), then updates in the background.
3. Worker checks its edge cache; on miss it uses the refresh token to mint a short-lived access token, calls Google Calendar, **normalizes** the response into a compact view-model, caches it (60–120 s), returns it.
4. Weather follows the same path with a longer TTL (10–15 min).
5. A Worker **cron trigger** independently refreshes the token and pings healthchecks.io so the token stays warm and the owner is alerted if the system goes dark.

---

## 3. Frontend framework choice

### Recommendation: **Svelte 5 + Vite** (SPA, no SSR — SvelteKit in `static`/SPA mode optional)

**Why Svelte over React for *this* device:**

- **Memory profile is the deciding factor.** Independent 2026 benchmarks consistently show Svelte holding **flat memory under sustained operation** while React shows gradual memory creep over long continuous runs, and roughly **~50% lower memory usage** overall. On a device that must run for months without a reload, a framework that doesn't accumulate retained objects on every re-render is worth more than ecosystem size.
- **Compile-time, tiny runtime.** Svelte's core is ~1–2 KB gzipped vs ~42–45 KB for React+ReactDOM. Smaller bundle = faster cold start after the nightly reboot and less to keep resident.
- **No virtual-DOM churn.** A clock/agenda that updates every minute for months benefits from surgical, compiled DOM updates rather than reconciliation pressure.
- **Iteration ergonomics.** Svelte components are close to plain HTML/CSS/JS — easy for the owner to read and modify locally, directly addressing the "Google AI Studio was hard to iterate" complaint.

**Why not vanilla JS:** A long-lived, multi-view, swipe-driven app with caching and reactivity is exactly where hand-rolled state management starts leaking and rotting. A disciplined framework with a real reactivity model *reduces* leak risk vs ad-hoc DOM code. Vanilla is rejected.

**Why not React:** Viable and well-supported, but the memory-creep characteristic and larger runtime are net negatives for an unattended long-runner. If the owner already knew React deeply, the calculus could flip — but the brief favors maintainability + longevity, which points to Svelte.

**Build tool: Vite** (Svelte uses it natively). Fast HMR, trivial static build, first-class PWA plugin (`vite-plugin-pwa` wraps Workbox).

**SSR?** No. This is a single always-on client; SSR adds a server render path we don't need. Build to **static assets** and serve them (from the same Cloudflare account via Pages, or even from the tablet — see §5).

---

## 4. State management, data fetching & caching strategy

### 4.1 Three layers of cache (defense in depth against network blips)

```
Layer 1: In-memory query cache   (TanStack Query / @tanstack/svelte-query)
            ↓ miss / stale
Layer 2: Service Worker cache    (Workbox, stale-while-revalidate, persists to disk)
            ↓ miss
Layer 3: Worker edge cache       (Cloudflare KV / Cache API, 60–120s)
            ↓ miss
        Google Calendar API
```

### 4.2 Data fetching: `@tanstack/svelte-query`

- Handles **polling** (`refetchInterval`), **stale-time**, **retry with backoff**, and **dedup** out of the box.
- Critically: `staleTime` + `gcTime` are tunable so the kiosk shows last-known-good data and *never blanks* on a failed fetch. Keep prior data on error (`placeholderData: keepPreviousData`).
- Avoids the classic kiosk failure mode where a transient fetch error wipes the screen.

### 4.3 App state: native Svelte 5 runes / stores

- View-switching state, current date window, and UI preferences live in lightweight Svelte stores (`$state`/`$derived` runes in Svelte 5). No Redux-class library needed — it would be over-engineering for ~3 views.

### 4.4 Polling cadence (battery/heat aware)
- Calendar: refetch every **2–5 min** while screen is on; back off when Fully Kiosk reports the screen is off/idle.
- Weather: every **10–15 min**.
- Use the Page Visibility API to pause polling when the screen sleeps, preventing pointless heat/battery/CPU and accumulated timers.

### 4.5 Time/date handling
- Use **date-fns** (tree-shakeable, light) or **Temporal** (polyfilled) — never Moment.js. Pin the IANA timezone explicitly; do not rely on the tablet's locale drifting.

---

## 5. Backend / hosting choice

### Recommendation: **Cloudflare Workers** for the API/token custodian; static frontend on **Cloudflare Pages** (same account).

### 5.1 Cloud vs local-network hosting — the key tradeoff for a home kiosk

| Dimension | **Cloud (Cloudflare Worker)** ✅ chosen | **Local (Raspberry Pi / home server on LAN)** |
|---|---|---|
| Token survives router reboot / power blip | Yes — independent of the home | No — Pi down = no calendar |
| Reachable for OTA frontend updates | Yes, anywhere | Only on LAN / via VPN |
| Maintenance burden | Near-zero (serverless) | OS patching, SD-card wear, you own uptime |
| Cost | $0 on free tier (100k req/day) | Pi hardware + power, but no SaaS fee |
| Works if home internet is down | No (but SW cache covers the tablet) | LAN-only works, but the *Google* calls still need WAN |
| Cron to keep token warm | Built-in Cron Triggers | Need own cron + always-on Pi |
| Latency | Edge, <5 ms isolate startup | LAN is fast but irrelevant at our request volume |

**Verdict:** Cloud wins decisively for an *unattended* device. The whole point is "runs for months without me touching it." A Raspberry Pi adds a second piece of unattended hardware that *also* needs to never die — doubling the failure surface to save a few dollars that the free tier already covers. The Service Worker cache (§7) handles the "home internet blipped" case on the client side, which is the only real advantage local hosting would buy.

> Local hosting is a reasonable fallback **only** if the owner refuses any cloud dependency. In that case: a Pi running a tiny Node/Hono service + PM2 + a cron to refresh the token, frontend served from the same Pi. Document it but don't recommend it.

### 5.2 Why Cloudflare Workers over Vercel/Netlify functions

- **Free tier fits comfortably:** 100,000 requests/day, no credit card required — our traffic is one household device polling every few minutes (~hundreds of requests/day).
- **Sub-5 ms isolate startup** — no meaningful cold-start jank vs 200–800 ms for some Node serverless functions.
- **Storage on the same account:** Workers KV for the refresh token / cached responses; no second vendor. Vercel/Netlify storage are partner wrappers.
- **Cron Triggers** built in for the keep-warm/heartbeat job.
- **Zero egress charges** — irrelevant at our scale but indicative of the cost ceiling being effectively $0.

> **Runtime note:** Workers run on the V8-isolate runtime (Web APIs, `fetch`), not full Node. Use **Hono** as the routing framework — tiny, Workers-native, also runs on Node/Bun, so if we ever move to a Pi the same code runs there. This portability is a deliberate hedge.

### 5.3 Where the refresh token lives — precisely

1. **One-time setup (manual, done once by the owner):** run a small local script (or a `/admin/oauth` route protected by a setup secret) that performs the Google OAuth **authorization-code** flow with `access_type=offline` and `prompt=consent`, capturing the **refresh token**.
2. Store that refresh token in **Workers KV** (encrypted at rest) — or as a Worker **secret** via `wrangler secret put` if it never rotates. KV is preferred because Google *can* rotate the refresh token, and we want to write the new one back.
3. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `WEATHER_API_KEY` are **Wrangler secrets** — never in the repo, never shipped to the tablet.
4. The tablet receives **only** shaped calendar/weather JSON. It has no Google credentials of any kind.

### 5.4 Keeping OAuth alive for 3+ months — the rules we must obey
- **Publish the OAuth consent screen to "Production"** (not "Testing"). Testing-mode refresh tokens expire in **7 days** — this alone would kill the project. Production tokens do not have that limit.
- **Use the token at least every 6 months** — easy, we use it every few minutes; a refresh token unused for 6 consecutive months is auto-invalidated.
- **Stay under 100 live refresh tokens per client** — trivially satisfied (we hold exactly one); just don't re-run the consent flow in a loop.
- A Worker **cron trigger** does a token refresh on a schedule even if the tablet is off, so the credential is always warm and we detect breakage early via the heartbeat.
- On `invalid_grant`, surface a loud, distinct error to the health endpoint so the owner knows a one-time re-consent is needed.

---

## 6. Gesture / swipe library

### Recommendation: **Embla Carousel** (headless, pointer-events based)

- **~7 KB gzipped, zero dependencies** — keeps the bundle and resident memory small.
- Uses **Pointer Events**, not deprecated touch events — consistent behavior across the tablet touchscreen.
- **Headless:** it gives us snap physics and drag handling but no imposed UI, so the Month/Week/Weather panes are our own components. Has a first-class Svelte/vanilla API.
- Maps cleanly to two gesture axes: **horizontal swipe = change view** (or change period), with momentum/snap that feels native.

**Alternatives considered:**
- **Swiper.js** (~47 KB): feature-rich (effects, autoplay) but heavier than we need; rejected on bundle/memory grounds.
- **@use-gesture** (+ a spring lib): great low-level gesture detection, but then we hand-roll snap/momentum — more code to maintain. Reasonable if we want a very custom feel; Embla gets us there faster.
- Hand-rolled `pointerdown/move/up`: rejected — it's the classic source of subtle touch bugs and event-listener leaks over a months-long run.

> **Leak watch:** whichever library, ensure listeners are torn down on component destroy. Embla's `.destroy()` and Svelte's `onDestroy` make this clean.

---

## 7. PWA considerations & offline caching

### 7.1 Why a PWA here
- Installs full-screen, controllable launch behavior with Fully Kiosk.
- The Service Worker is our **offline insurance**: the calendar keeps rendering when Wi-Fi blips.

### 7.2 Service Worker strategy (Workbox via `vite-plugin-pwa`)

| Asset class | Strategy | Rationale |
|---|---|---|
| App shell (JS/CSS/HTML/fonts) | **Precache** (cache-first, versioned) | Instant boot after nightly reboot; survives offline |
| `GET /api/calendar` | **StaleWhileRevalidate** | Show last-known events instantly, refresh in background; never blanks |
| `GET /api/weather` | **StaleWhileRevalidate** (longer expiry) | Weather tolerates staleness |
| Navigation requests | App-shell fallback | Always boots to the SPA even offline |

- Add `workbox-expiration` so caches are bounded (max entries + max age) — **prevents the cache itself from growing unbounded over months**, which is a real disk/memory concern on a long-runner.
- **Update flow:** because this is a kiosk (no user to click "reload to update"), set the SW to `skipWaiting` + `clientsClaim` and let the **nightly Fully Kiosk reboot** pick up new versions cleanly. Avoid surprise mid-day swaps.

### 7.3 Offline render contract
- The SPA must always render *something* useful: last cached calendar + a small, unobtrusive "data as of HH:MM" staleness indicator when the network is down. **Never a blank screen, never a full-page error.**

---

## 8. Memory-leak avoidance & periodic auto-refresh (the months-unattended problem)

This is treated as a first-class requirement, not an afterthought. Defense in depth across three levels:

### 8.1 Application level (write code that doesn't leak)
- **Tear down everything in `onDestroy`:** `setInterval`/`setTimeout`, event listeners, Embla instances, query subscriptions.
- **No unbounded arrays/logs in memory.** Cap any in-app event buffer; rely on caches with expiration, not growing JS objects.
- **Pause timers when screen is off** (Page Visibility API) — stops accumulating timer drift and work.
- **Re-key views deliberately** so Svelte tears down and rebuilds DOM rather than mutating stale nodes forever.
- **Use `@tanstack/svelte-query`'s `gcTime`** so dropped query data is actually garbage-collected.

### 8.2 In-app soft watchdog (recover without a full reboot)
- A lightweight watchdog: every N hours, if the app has been continuously running, **re-mount the root view tree** (cheap "soft refresh") to drop accumulated DOM/listeners.
- Optional: a `window.location.reload()` on a 24h timer at a quiet hour as a heavier reset — but prefer the OS-level reboot below so the SW/cache are cleanly reinitialized too.

### 8.3 OS / browser level (the real safety net)
- **Fully Kiosk "Daily System Restart"** at e.g. 03:30 — a full device reboot clears *all* accumulated browser/native memory regardless of any app bug. This is the backstop that makes "runs for months" achievable even if a subtle leak slips through.
- Configure Fully Kiosk to **auto-relaunch** the URL after reboot, disable screensaver/sleep (or use motion/screen scheduling), and **auto-restart Fully Kiosk if it crashes**.
- Enable Fully Kiosk's "Clear WebView cache/cookies on schedule" *carefully* — do **not** clear if it would wipe the SW precache unnecessarily; the nightly reboot is usually enough.

> **Principle:** the app should *try* never to leak, but the architecture assumes it eventually might — so a daily clean-slate reboot guarantees correctness over a multi-month horizon.

---

## 9. Logging & remote health monitoring of an unattended device

The owner must learn the device is dead **before** they walk past a black screen.

### 9.1 Heartbeat / dead-man's switch — **healthchecks.io** (free tier)
- The **Worker cron trigger** pings a healthchecks.io URL on every successful token-refresh + calendar fetch cycle.
- Additionally, the **tablet** pings a *separate* healthchecks.io check on each successful render loop (so we distinguish "backend down" from "tablet down/offline").
- If either heartbeat stops within its grace window, healthchecks.io emails/Slacks the owner. This is the single highest-leverage piece of monitoring.

### 9.2 Backend logging
- Cloudflare **Workers Logs / Tail** for live debugging; structured `console.log` with levels.
- On `invalid_grant` (token died) or repeated Google 4xx/5xx, emit a **distinct alert** (Worker → healthchecks.io failure ping or a webhook) so credential problems are unmistakable.

### 9.3 Tablet logging
- Fully Kiosk exposes **Remote Admin** (web dashboard) and a REST API — use it to see device state, memory, restart remotely, and reload the URL **without physically touching the tablet**.
- The SPA can `POST` lightweight client errors (window.onerror / unhandledrejection) to a `/api/log` Worker endpoint, rate-limited, so client-side crashes are visible remotely. Keep this minimal to avoid creating its own traffic/leak.

### 9.4 Health endpoint
- `GET /api/health` returns `{ tokenOk, lastCalendarFetch, lastWeatherFetch, version }` so a quick browser hit (or an uptime monitor) reveals system state at a glance.

---

## 10. Build / deploy pipeline

Deliberately boring and local-first to fix the "hard to iterate" complaint.

### 10.1 Local dev
```
npm install
npm run dev          # Vite + HMR for the SPA
wrangler dev         # Worker locally (or `npm run dev:all` to run both)
```
- A Vite dev proxy points `/api/*` at the local Worker so the SPA and backend feel like one app in dev.

### 10.2 Deploy
- **Frontend:** `vite build` → static assets → **Cloudflare Pages** (auto-deploy on `git push` to `main`, or `wrangler pages deploy`).
- **Backend:** `wrangler deploy` (or wired into the same CI).
- **CI (optional, GitHub Actions):** on push to `main` → lint + typecheck + build + deploy Pages and Worker. A `staging` branch → preview deployment so changes are validated before they hit the device.
- **OTA updates to the kiosk:** push code → Pages redeploys → SW updates on next nightly reboot. No physical access ever needed for code changes.

### 10.3 Tooling baseline
- **TypeScript** end to end (shared types between Worker response and SPA view-model — define the calendar view-model once, import on both sides).
- **ESLint + Prettier**, **Vitest** for unit tests, optional **Playwright** for a smoke test of the three views + swipe.

---

## 11. Configuration & secrets management

| Item | Where | Notes |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Wrangler secret | Never in repo / never to tablet |
| `GOOGLE_CLIENT_SECRET` | Wrangler secret | Never in repo / never to tablet |
| `GOOGLE_REFRESH_TOKEN` | **Workers KV** (rotatable) | Written by one-time setup; updated if Google rotates it |
| `WEATHER_API_KEY` | Wrangler secret | Server-side only — proxy weather so the key never ships |
| Calendar IDs, timezone, location, polling intervals, colors | `config.json` / Worker env vars (non-secret) | Checked into repo; safe, user-tunable |
| `HEALTHCHECK_URL`(s) | Wrangler secret / env | |

- **Nothing secret ever reaches the browser.** All third-party API keys are proxied through the Worker.
- `.dev.vars` for local Worker secrets, **git-ignored**. `.env.example` documents required vars.
- A short **`SETUP.md`** documents the one-time OAuth consent + token capture procedure.

---

## 12. Component breakdown

### 12.1 Frontend components
- `App` — root; mounts router, watchdog, global stores.
- `ViewSwitcher` — Embla-driven horizontal pager across the three top-level views.
- `MonthAgendaView` — month grid + side/below agenda list; swipe = prev/next month.
- `WeekView` — 7-day time-grid; swipe = prev/next week.
- `WeatherView` — current + forecast.
- `EventCard` / `AgendaList` / `DayCell` — presentational.
- `StalenessBadge` — "data as of HH:MM" when offline.
- `Clock` — minute-tick, timer torn down on destroy.
- **Stores:** `calendarStore` (svelte-query), `weatherStore`, `uiStore` (active view, date window), `connectivityStore`.
- **Lib:** `api.ts` (typed fetch to Worker), `time.ts` (date-fns/Temporal helpers), `watchdog.ts`.
- **Service Worker:** generated by `vite-plugin-pwa` with custom runtime caching rules.

### 12.2 Backend (Worker) modules
- `router` (Hono) — `/api/calendar`, `/api/weather`, `/api/health`, `/api/log`, `/admin/oauth` (setup).
- `token.ts` — refresh→access token, KV read/write, rotation handling.
- `google.ts` — Calendar API client + **normalizer** to the shared view-model.
- `weather.ts` — weather provider client + normalizer.
- `cache.ts` — KV/Cache API wrapper with TTLs.
- `cron.ts` — scheduled keep-warm + heartbeat ping.
- `shared/types.ts` — view-model types imported by both SPA and Worker.

---

## 13. Proposed repository structure

Monorepo (npm workspaces) so the SPA, the Worker, and shared types live and version together — one `git clone`, normal tooling.

```
new-calendar-app/
├─ README.md
├─ SETUP.md                      # one-time Google OAuth / token capture
├─ package.json                  # workspaces: apps/*, packages/*
├─ tsconfig.base.json
├─ .editorconfig  .eslintrc  .prettierrc
├─ .env.example
├─ docs/
│  └─ requirements/
│     └─ 04-frontend-architecture.md   # (this file)
│
├─ apps/
│  ├─ kiosk/                     # Svelte 5 + Vite PWA (the tablet app)
│  │  ├─ index.html
│  │  ├─ vite.config.ts          # + vite-plugin-pwa (Workbox)
│  │  ├─ src/
│  │  │  ├─ main.ts
│  │  │  ├─ App.svelte
│  │  │  ├─ views/
│  │  │  │  ├─ MonthAgendaView.svelte
│  │  │  │  ├─ WeekView.svelte
│  │  │  │  └─ WeatherView.svelte
│  │  │  ├─ components/          # EventCard, DayCell, Clock, StalenessBadge...
│  │  │  ├─ lib/                 # api.ts, time.ts, watchdog.ts, embla setup
│  │  │  ├─ stores/              # calendar, weather, ui, connectivity
│  │  │  └─ sw/                  # custom service-worker rules
│  │  └─ public/                 # manifest.webmanifest, icons
│  │
│  └─ worker/                    # Cloudflare Worker (Hono) — token + proxy
│     ├─ wrangler.toml           # KV bindings, cron triggers, routes
│     ├─ .dev.vars               # (git-ignored) local secrets
│     └─ src/
│        ├─ index.ts             # Hono app + scheduled() handler
│        ├─ token.ts  google.ts  weather.ts  cache.ts  cron.ts
│        └─ routes/              # calendar, weather, health, log, admin-oauth
│
├─ packages/
│  └─ shared/                    # shared TS types / view-model + tz config
│     └─ src/types.ts
│
└─ .github/
   └─ workflows/
      └─ deploy.yml              # build + deploy Pages & Worker
```

---

## 14. Key risks & mitigations

| Risk | Mitigation |
|---|---|
| OAuth token dies at 7 days | Publish consent screen to **Production**; cron keep-warm; alert on `invalid_grant` |
| Slow memory leak over months | Daily Fully Kiosk reboot + in-app watchdog + disciplined teardown + bounded caches |
| Wi-Fi blip blanks the screen | SW stale-while-revalidate + svelte-query `keepPreviousData` + staleness badge |
| Device dies silently | Dual healthchecks.io heartbeats (tablet + Worker) → email/Slack |
| Can't update without touching tablet | Cloudflare Pages OTA + SW update on nightly reboot + Fully Kiosk remote reload |
| Cloud provider outage | SW cache keeps last-known calendar visible; degraded-not-dead |
| Hard to iterate (prior pain) | Plain Vite/npm/Wrangler, monorepo, HMR, git — no proprietary studio |

---

## 15. Recommended stack at a glance

| Concern | Choice |
|---|---|
| Frontend framework | **Svelte 5** |
| Build tool | **Vite** + `vite-plugin-pwa` (Workbox) |
| Data fetching/cache | **@tanstack/svelte-query** + Svelte 5 runes/stores |
| Swipe/gesture | **Embla Carousel** (headless, pointer events) |
| Dates | **date-fns** (or Temporal polyfill) |
| Backend | **Cloudflare Worker** + **Hono**, **Workers KV** for token |
| Frontend hosting | **Cloudflare Pages** (static) |
| Token custody | Refresh token in **Workers KV**, all keys server-side only |
| OAuth longevity | Consent screen **Production** + cron keep-warm |
| Monitoring | **healthchecks.io** dual heartbeats + Fully Kiosk Remote Admin |
| Device runtime | **Fully Kiosk Browser** — daily reboot, auto-relaunch, no sleep |
| Language/tooling | **TypeScript**, ESLint/Prettier, Vitest, npm workspaces monorepo |

---

## Sources

- [Fully Kiosk Browser](https://www.fully-kiosk.com/en/) — daily restart, auto-relaunch, remote admin, idle/cache clearing features
- [Home Assistant frontend memory-leak issue #16952](https://github.com/home-assistant/frontend/issues/16952) — real-world kiosk memory growth, restart as mitigation
- [Google: Using OAuth 2.0 to Access Google APIs](https://developers.google.com/identity/protocols/oauth2) — refresh-token expiry rules (testing vs production, 6-month idle, 100-token limit)
- [Refresh token expires in 7 days when consent screen is Testing](https://forums.homeseer.com/forum/internet-or-network-related-plug-ins/internet-or-network-discussion/ak-google-calendar-alexbk66/1545936-refresh-token-expires-in-7-days-if-oauth-consent-screen-publishing-status-is-testing)
- [Nango: Google OAuth invalid_grant — causes & fixes](https://nango.dev/blog/google-oauth-invalid-grant-token-has-been-expired-or-revoked/)
- [Svelte vs React 2026 — performance & DX](https://strapi.io/blog/svelte-vs-react-comparison)
- [React 19 vs Svelte 5 vs Vue 4 — benchmarks, memory, bundle size](https://jsgurujobs.com/blog/svelte-5-vs-react-19-vs-vue-4-the-2025-framework-war-nobody-expected-performance-benchmarks)
- [Svelte vs React on performance — Request Metrics](https://requestmetrics.com/blog/community/svelte-vs-react-on-performance/)
- [Cloudflare Workers vs Vercel 2026 — pricing, cold starts, limits](https://www.morphllm.com/comparisons/cloudflare-workers-vs-vercel)
- [Cloudflare Workers vs Vercel Functions 2026](https://www.kunalganglani.com/blog/cloudflare-workers-vs-vercel-2026)
- [Embla Carousel vs Swiper vs Splide 2026](https://www.pkgpulse.com/guides/embla-carousel-vs-swiper-vs-splide-2026)
- [Swiper vs Embla Carousel — official comparison](https://swiperjs.com/compare/swiper-vs-embla-carousel)
- [Workbox — web.dev](https://web.dev/learn/pwa/workbox) and [stale-while-revalidate strategies](https://www.magicbell.com/blog/offline-first-pwas-service-worker-caching-strategies)
- [Healthchecks.io — dead-man's-switch / heartbeat monitoring](https://healthchecks.io/docs/faq/)
