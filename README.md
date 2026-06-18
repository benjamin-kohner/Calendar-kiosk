# Calendar Kiosk

A wall-mounted Google Calendar kiosk for a ~9–11" Android tablet running Fully Kiosk
Browser. Three swipeable views — **Month** (with a daily agenda ribbon), **Week**, and
**Weather** — with custom theming, night dimming, offline caching, and **durable Google
auth that does not expire every 7 days**.

Built as a Vite + Svelte 5 single-page app with Vercel serverless functions that custody
the Google OAuth refresh token server-side (the token never touches the tablet).

> Full design rationale lives in [`docs/requirements/`](docs/requirements/) (12 specialist
> requirement docs). Start with `00-PRD-master.md` and `02-google-calendar-oauth.md`.

---

## The 7-day problem (read this first)

The previous version forced re-authentication every ~7 days. **Root cause:** the Google
Cloud OAuth consent screen was in **Testing** mode, where Google deliberately expires
refresh tokens after 7 days for calendar scopes. **No code can fix that** — it's a Cloud
Console setting.

**The fix (do both):**

1. Publish the OAuth consent screen to **In production** (Step 1 below). This removes the
   7-day cap and gives you a long-lived refresh token. No formal Google verification is
   required for a single-user app under 100 users — you just click past a one-time
   "unverified app" warning.
2. Keep the refresh token **server-side** in Vercel (Step 4). This app already does that.

---

## Architecture

```
 Android tablet (Fully Kiosk Browser)
        │  opens https://your-app.vercel.app
        ▼
 ┌──────────────────────────────┐         ┌─────────────────────┐
 │  Svelte SPA (static, on CDN) │──fetch─▶ │ Vercel functions    │
 │  Month / Week / Weather      │ /api/*  │  /api/calendar      │──▶ Google Calendar API
 │  caches last sync locally    │◀────────│  /api/weather       │──▶ Open-Meteo
 └──────────────────────────────┘         │  /api/auth/*        │
                                          │  GOOGLE_REFRESH_TOKEN (env, server-only)
                                          └─────────────────────┘
```

---

## Setup

### Step 1 — Google Cloud (one time)

1. Go to <https://console.cloud.google.com/> → create a project (e.g. "Calendar Kiosk").
2. **APIs & Services → Library →** enable **Google Calendar API**.
3. **APIs & Services → OAuth consent screen:**
   - User type: **External**.
   - Fill app name / your email.
   - Add scope `.../auth/calendar.readonly`.
   - Add your own Google account as a **Test user**.
   - **Publish app → move to "In production".** (This is the fix. You can ignore the
     verification prompt; choose to stay unverified — fine for personal use.)
4. **APIs & Services → Credentials → Create credentials → OAuth client ID:**
   - Application type: **Web application**.
   - Authorized redirect URI: `https://YOUR-APP.vercel.app/api/auth/callback`
     (you'll get the exact domain after Step 3; you can come back and add it).
   - Save the **Client ID** and **Client secret**.

### Step 2 — Local dev (optional but recommended)

```bash
npm install
cp .env.example .env      # fill in GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
npm run dev               # UI only at http://localhost:5173
# For the full stack (UI + /api functions) locally:
npx vercel dev
```

### Step 3 — Deploy to Vercel

```bash
npx vercel            # link/create the project (first run)
npx vercel --prod     # deploy to production -> gives you your-app.vercel.app
```

In the Vercel dashboard → **Project → Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | from Step 1 |
| `GOOGLE_CLIENT_SECRET` | from Step 1 |
| `WEATHER_LAT` / `WEATHER_LON` / `WEATHER_LABEL` | your home location (optional; also settable in-app) |

Now add the real redirect URI (`https://your-app.vercel.app/api/auth/callback`) back into
the Google OAuth client from Step 1.4, and redeploy.

### Step 4 — Authorize once (captures the long-lived token)

1. Visit **`https://your-app.vercel.app/api/auth/start`** in any browser.
2. Sign in with your Google account, grant calendar read access.
3. The callback page shows a **refresh token**. Copy it.
4. In Vercel → Settings → Environment Variables, set `GOOGLE_REFRESH_TOKEN` to that value.
5. Redeploy (`npx vercel --prod`). Done — the kiosk now stays authorized for months.

> If the token is ever revoked, the app shows a red "reconnect" banner; just repeat Step 4.

### Step 5 — On the tablet (Fully Kiosk Browser)

- Set **Start URL** to `https://your-app.vercel.app`.
- Enable: Kiosk mode, Keep screen on, Auto-reload on idle, Scheduled reboot (nightly).
- **Disable Fully's own gestures** (swipe navigation, swipe tabs, pull-to-refresh) so the
  app's swipes work. Move the kiosk-exit gesture off the left edge.
- Enable immersive fullscreen (hide status/nav bars).
- (PLUS license) Set a **day/night brightness schedule** for backlight dimming.

See [`docs/requirements/06-kiosk-deployment.md`](docs/requirements/06-kiosk-deployment.md)
for the full Fully Kiosk checklist.

---

## Project layout

```
api/                Vercel serverless functions (token custody + proxies)
  _google.ts        OAuth refresh + Calendar API helpers
  calendar.ts       GET /api/calendar  -> normalized events JSON
  weather.ts        GET /api/weather   -> Open-Meteo proxy
  health.ts         GET /api/health    -> uptime/heartbeat
  auth/start.ts     OAuth kickoff
  auth/callback.ts  OAuth callback (one-time token capture)
src/
  App.svelte        shell: swipe pager, header, dots
  components/       MonthView, WeekView, WeatherView, DayRibbon, SettingsPanel, ...
  lib/              data fetching/caching, settings, clock, date utils, themes
docs/requirements/  the 12 specialist requirement docs / PRD
```

## Scripts

| Command | What |
|---|---|
| `npm run dev` | Vite dev server (UI only) |
| `npx vercel dev` | Full stack locally (UI + API) |
| `npm run check` | Svelte + TypeScript type-check |
| `npm run build` | Production build to `dist/` |

## Scope (MVP)

Read-only Google Calendar. Features: 3 swipeable views, multi-calendar color coding, daily
agenda ribbon, today/now highlighting, weather, custom themes + layouts, night dimming,
offline cache, midnight rollover. Deliberately **excluded**: photos, chores, rewards,
to-dos, groceries, meal planning, AI import, voice control.
