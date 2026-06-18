# 05 — Weather Integration Requirements

**Project:** Home Calendar Kiosk (wall-mounted ~9" Android tablet, 24/7, fixed home location)
**Scope:** Dedicated Weather view (one of three swipeable views) + small weather glance on calendar views
**Status:** Draft for review
**Last updated:** 2026-06-18

---

## 1. Context & Goals

The kiosk runs continuously at a single, fixed home location. It is a personal/family device with no advertising, no subscriptions, and no commercial purpose. This profile makes weather integration unusually forgiving: we need exactly **one location**, refreshed at a modest cadence, and we never approach the volumes that drive cost on any major provider.

Design priorities, in order:

1. **Glanceability** — readable across a room, at a glance, by all family members including kids.
2. **Reliability over 24/7 operation** — the view must never show a stale/blank state without indication; rate limits must never be hit.
3. **Zero or near-zero cost** — free tiers only; no credit card on file if avoidable.
4. **Low maintenance** — minimal key rotation, no surprise tier changes that break the kiosk.

---

## 2. Weather API Comparison (2025–2026 tiers)

All limits below are for the **free** tier unless noted. Daily call math assumes the kiosk polls **one location**.

### 2.1 Open-Meteo

| Attribute | Detail |
|---|---|
| **Key required** | No API key |
| **Free-tier limits** | < 10,000 calls/day, 5,000/hour, 600/minute (non-commercial) |
| **Current / hourly / 7-day** | Yes / Yes (up to 16 days hourly) / Yes (daily up to 16 days) |
| **Data fields** | temp, apparent (feels-like) temp, precip + precip probability, wind speed/gusts/direction, humidity, UV index, sunrise/sunset, weather code, cloud cover, pressure, visibility |
| **Severe-weather alerts** | **No native alerts endpoint** (gap — see §3) |
| **Conditions mapping** | WMO weather codes (0–99) — well-documented, easy to map to custom icons |
| **Geocoding** | Free companion Geocoding API (name → lat/lon), no key |
| **Licensing/attribution** | Data under CC BY 4.0. Must display "Weather data by Open-Meteo.com" with a link. Free API for non-commercial use only (personal home automation explicitly qualifies). |

### 2.2 OpenWeatherMap

| Attribute | Detail |
|---|---|
| **Key required** | Yes |
| **Free-tier limits** | Two paths: **(a)** "Free Access" APIs (current weather + 5-day/3-hour forecast): 60 calls/min, 1,000,000/month, **no credit card**. **(b)** One Call API 3.0: 1,000 calls/day free but **requires a credit card on file** ("One Call by Call" subscription). |
| **Current / hourly / 7-day** | Free Access tier gives current + 5-day/3-hour forecast only. True hourly + 8-day daily requires One Call 3.0 (card required). |
| **Data fields** | temp, feels-like, precip prob, wind, humidity, UV (One Call), sunrise/sunset; alerts only on One Call 3.0 |
| **Severe-weather alerts** | Government alerts via One Call 3.0 (card required) |
| **Conditions mapping** | Numeric condition codes + provided icon set |
| **Geocoding** | Built-in Geocoding API |
| **Licensing/attribution** | Free tier requires attribution to OpenWeather. Note: 2025–2026 rate limiting tightened — burst requests more likely to 429. |

### 2.3 WeatherAPI.com

| Attribute | Detail |
|---|---|
| **Key required** | Yes |
| **Free-tier limits** | 1,000,000 calls/month, **no credit card** |
| **Current / hourly / 7-day** | Yes / Yes / Yes (free tier capped ~3 days forecast; up to 14 days on paid). **Free forecast horizon is the main limitation.** |
| **Data fields** | temp, feels-like, precip + precip prob, wind, humidity, UV, sunrise/sunset, air quality |
| **Severe-weather alerts** | Weather alerts available (alerts param) |
| **Conditions mapping** | Condition codes + provided day/night icon set (downloadable) |
| **Geocoding** | Built-in search/autocomplete endpoint |
| **Licensing/attribution** | Attribution required on free tier. |

### 2.4 Tomorrow.io

| Attribute | Detail |
|---|---|
| **Key required** | Yes |
| **Free-tier limits** | **500 calls/day**, 25/hour, 3/second — the most restrictive of the set |
| **Current / hourly / 7-day** | Yes / Yes / Yes |
| **Data fields** | Very rich (temp, feels-like, precip prob, wind, humidity, UV, plus many specialized layers) |
| **Severe-weather alerts** | Available (some alert features gated to higher tiers) |
| **Conditions mapping** | Numeric weather codes + icon set |
| **Geocoding** | Accepts lat/lon directly |
| **Licensing/attribution** | Attribution required on free tier. 25/hour limit means polling must be carefully throttled — fine for one location at 15-min cadence (~96/day) but no headroom for retries/bursts. |

### 2.5 Apple WeatherKit

| Attribute | Detail |
|---|---|
| **Key required** | Yes — requires **paid Apple Developer Program ($99/yr)**; REST API uses JWT signed with a developer key |
| **Free-tier limits** | 500,000 calls/month included with Developer Program membership |
| **Current / hourly / 7-day** | Yes / Yes (next ~240h) / Yes (10-day) |
| **Data fields** | Comprehensive: temp, feels-like, precip prob, wind, humidity, UV, sunrise/sunset, severe weather alerts |
| **Severe-weather alerts** | Yes (government alerts where available) |
| **Conditions mapping** | Apple condition codes (SF Symbols mapping in-app; custom mapping for Android) |
| **Geocoding** | Lat/lon input |
| **Licensing/attribution** | **Mandatory** legal attribution: a "Weather" link to Apple's legal attribution page + data-source attribution must be displayed. Token signing (ES256 JWT) adds non-trivial implementation overhead on Android. |

### 2.6 NWS / weather.gov (US only)

| Attribute | Detail |
|---|---|
| **Key required** | No key; requires a descriptive `User-Agent` header |
| **Free-tier limits** | Free, US government data. No published hard numeric limit; fair-use, 429 on abuse. |
| **Current / hourly / 7-day** | Observations (nearest station) / Yes (`forecastHourly`) / Yes (7-day `forecast`) |
| **Data fields** | temp, wind, humidity, precip probability, short forecast text; **no UV, no native feels-like in all products, no sunrise/sunset** |
| **Severe-weather alerts** | **Excellent** — `/alerts/active` is authoritative US watches/warnings/advisories with severity, urgency, headline |
| **Conditions mapping** | Icon URLs + text descriptions (legacy icon set) |
| **Geocoding** | lat/lon → `/points/{lat},{lon}` → grid endpoints (two-hop) |
| **Licensing/attribution** | US public domain — no attribution legally required (courtesy attribution encouraged). US locations only. |

---

## 3. Recommendation

### Primary: **Open-Meteo**

Rationale:

- **No API key, no account, no credit card, no expiry to manage** — eliminates the single biggest 24/7 maintenance/breakage risk (key rotation, tier changes, accidental billing).
- Provides **every core field we need** for a glanceable family display: current, hourly, 7-day daily, feels-like, precip probability, wind, humidity, UV, sunrise/sunset.
- Generous limits (10k/day) that we will never approach at one location.
- Clean **WMO weather codes** map directly to a custom icon set we control (no dependency on a provider's proprietary icon assets).
- Free companion **Geocoding API** for the one-time home-location setup.
- Explicitly **permits personal home-automation use**; attribution is a single small line of text.

Its one gap is **no severe-weather alerts endpoint**, which matters for a wall display where a tornado/flood warning should be impossible to miss.

### Fallback / alerts source: **NWS / weather.gov** (US deployments)

- Use **NWS `/alerts/active`** as the authoritative severe-weather alert source layered on top of Open-Meteo's forecast. This is the highest-quality alert data available and it is free with no key.
- NWS also serves as the **forecast failover**: if Open-Meteo is unreachable, fall back to NWS hourly + 7-day forecast (US only).

### For non-US deployments (or if a single-vendor solution is preferred)

- Use **WeatherAPI.com** as fallback: generous free tier (1M/month, no card), includes alerts and all core fields, global coverage. The free-tier short forecast horizon (~3 days) is the trade-off — acceptable as a degraded fallback.

### Rejected for primary

- **OpenWeatherMap** — best data (One Call 3.0) requires a credit card on file; the no-card Free Access tier lacks true hourly + alerts.
- **Tomorrow.io** — 25 calls/hour leaves no headroom for retries; over-restrictive for an always-on device.
- **Apple WeatherKit** — requires $99/yr Developer Program and ES256 JWT signing; over-engineered for this use case on Android.

### Architecture summary

```
Open-Meteo (forecast + current + hourly + daily)  ─┐
                                                   ├─► Kiosk Weather Service ─► UI
NWS /alerts/active (US severe-weather banner)     ─┘
        (Fallbacks: NWS forecast, then WeatherAPI.com)
```

---

## 4. Polling, Caching & Rate-Limit Strategy (24/7)

The kiosk is on continuously; the goal is fresh-enough data with bulletproof rate-limit safety.

- **Forecast poll cadence:** every **15 minutes** for current + hourly + daily (~96 calls/day — trivial against a 10k/day limit). Open-Meteo updates models a few times per day, so this is generous freshness.
- **Alerts poll cadence:** every **5 minutes** for NWS `/alerts/active` (alerts are time-critical; ~288 calls/day, well within fair use).
- **Single in-memory + on-disk cache** of the last successful response, timestamped. UI always renders from cache; the poller updates the cache.
- **Stale-data handling:** if the last successful fetch is older than **45 minutes** (3 missed forecast polls), show a subtle "last updated HH:MM" indicator; do not blank the view.
- **Backoff:** on error or HTTP 429, exponential backoff (e.g., 1m → 2m → 5m → 15m cap). Never tighten cadence on failure.
- **Jitter:** add small random jitter (±30s) to poll timing to avoid synchronized bursts after a network blip.
- **No per-view polling:** swiping between views must read cache only — never trigger a network call.
- **Day-boundary refresh:** force a refresh shortly after local midnight so "today" rolls over correctly.
- **Network-aware:** pause polling when offline; resume + immediate fetch on reconnect.

---

## 5. Weather VIEW Requirements

### 5.1 Layout (full dedicated view, glanceable across a room)

**A. Now (hero block)**
- Large current temperature (primary, largest element on screen).
- Condition icon (large) + short condition text (e.g., "Partly Cloudy").
- "Feels like" temperature.
- Location name (small, confirms which location).

**B. Today summary**
- Today's **high / low**.
- **Precipitation probability** for today (with a clear % or label).
- Sunrise / sunset times.
- Wind, humidity, UV index as a secondary metric row (smaller).

**C. Hourly strip (horizontal)**
- Next **12 hours** (configurable up to 24).
- Per hour: time, condition icon, temp, and precip probability when > a threshold (e.g., ≥ 20%).
- Compact, evenly spaced, readable at distance.

**D. Multi-day forecast**
- **7-day** outlook.
- Per day: weekday label, condition icon, high/low, precip probability.
- A simple high/low bar/range visual is nice-to-have for at-a-glance comparison.

**E. Severe-weather alert (when active)**
- Prominent **banner at top** of the weather view: headline + severity color (e.g., red/orange/yellow by severity).
- Tappable to expand full alert text (event, area, effective/expires, instructions).
- When no alert is active, the banner is hidden entirely (no empty space).

### 5.2 Refresh cadence (UI)
- View re-renders from cache on every poller update (≤ 15 min for forecast, ≤ 5 min for alerts).
- Visible "Updated HH:MM" timestamp (small, low-emphasis).

### 5.3 Units configuration
- Single toggle: **°F / °C** (default configurable at setup; persists).
- Unit setting also governs wind (mph/km/h) and follows a sensible regional default tied to the unit choice.
- Time format follows device/locale (12h/24h).

### 5.4 Icon set & conditions mapping
- Use a **custom/owned icon set** mapped from Open-Meteo WMO codes (and from NWS/WeatherAPI codes when those sources are used), with **distinct day vs. night variants** keyed off sunrise/sunset.
- A single mapping table is the source of truth so all providers funnel into the same icons.

---

## 6. Weather on the Calendar Views (glance)

The two calendar views can be enriched with lightweight weather without becoming cluttered:

- **Per-day mini-forecast:** on month/week views, show a small condition icon + high/low (and precip % if significant) on each day **within the 7-day forecast window**. Days beyond the forecast horizon show no weather.
- **Today glance:** a small persistent corner element on calendar views showing current temp + condition icon, sourced from the same cache (no extra API calls).
- **Precip emphasis:** highlight days with high precip probability (e.g., a subtle raindrop indicator) so the family can plan around rain at a glance.
- **Data source:** strictly the shared cache — calendar views must never trigger their own weather fetches.

---

## 7. Acceptance Criteria

**API & data**
1. The kiosk fetches weather from Open-Meteo with **no API key** and renders current, hourly, and 7-day data for the configured home location.
2. Home location is set **once** (via geocoding or lat/lon entry) and persists across reboots.
3. Severe-weather alerts are sourced from NWS `/alerts/active` (US) and appear within **≤ 5 minutes** of becoming active.
4. If Open-Meteo is unreachable, the kiosk falls back (NWS forecast for US; WeatherAPI.com otherwise) without user intervention and logs the switch.

**Rate limits & 24/7**
5. Over any 24-hour period the kiosk makes **well under** every provider's free-tier limit (forecast ≤ ~100 calls/day; alerts ≤ ~300 calls/day).
6. On HTTP 429 or network error, the kiosk applies exponential backoff and **never** increases polling frequency.
7. Swiping between the three views triggers **zero** network requests; all views render from the shared cache.
8. After a network outage and reconnect, fresh data appears within one poll cycle (≤ 15 min forecast / ≤ 5 min alerts).

**Weather view UI**
9. Current temperature is the largest element and legible from across a room (~3 m).
10. The view shows: now (temp, condition, feels-like), today hi/lo + precip + sunrise/sunset, a ≥12-hour hourly strip, and a 7-day forecast — all simultaneously without scrolling on the 9" display.
11. An active severe-weather alert appears as a color-coded banner at the top and is expandable; when none is active the banner occupies no space.
12. Day vs. night icon variants render correctly relative to local sunrise/sunset.

**Units & config**
13. Toggling °F/°C updates all temperatures (and associated wind units) immediately and persists across reboots.
14. A low-emphasis "Updated HH:MM" timestamp is visible; if data is older than 45 minutes it is visually flagged.

**Calendar enrichment**
15. Days within the 7-day window show a mini icon + high/low on calendar views; days beyond the window show no weather and no broken/empty placeholder.
16. The calendar today-glance and per-day weather use the shared cache exclusively (verified by zero additional API calls when switching to calendar views).

**Attribution**
17. "Weather data by Open-Meteo.com" attribution (with link) is displayed on the weather view, plus appropriate attribution for any active fallback/alert source per its license.

---

## 8. Open Questions / Follow-ups
- Confirm deployment is US-based (determines whether NWS is available as alert/fallback source vs. defaulting to WeatherAPI.com).
- Decide hourly-strip length default (12 vs. 24 hours) based on the chosen tablet's horizontal resolution.
- Choose/produce the custom icon set and finalize the WMO → icon mapping table.

---

## Sources
- [Open-Meteo Pricing](https://open-meteo.com/en/pricing) · [Docs](https://open-meteo.com/en/docs) · [Licence](https://open-meteo.com/en/licence) · [Terms](https://open-meteo.com/en/terms) · [Geocoding API](https://github.com/open-meteo/geocoding-api)
- [OpenWeatherMap One Call API 3.0](https://openweathermap.org/api/one-call-3) · [Pricing](https://openweathermap.org/price) · [OpenWeatherMap Free Tier Limits 2026 (APIScout)](https://apiscout.dev/guides/openweathermap-free-tier-limits-2026)
- [WeatherAPI.com Pricing](https://www.weatherapi.com/pricing.aspx)
- [Tomorrow.io Free API Plan Rate Limits](https://support.tomorrow.io/hc/en-us/articles/20273728362644-Free-API-Plan-Rate-Limits) · [Pricing Overview](https://support.tomorrow.io/hc/en-us/articles/23554984091156-Tomorrow-io-Pricing-Overview)
- [Apple WeatherKit](https://developer.apple.com/weatherkit/) · [WeatherKit subscriptions](https://developer.apple.com/news/?id=wsx8rd26)
- [api.weather.gov General FAQs](https://weather-gov.github.io/api/general-faqs) · [NWS Web Services Documentation](https://www.weather.gov/documentation)
