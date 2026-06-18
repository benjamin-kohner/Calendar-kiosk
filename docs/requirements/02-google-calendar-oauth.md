# 02 — Google Calendar API & OAuth 2.0 Integration Requirements

**Project:** Calendar Kiosk (web app running 24/7 in Fully Kiosk Browser on an Android tablet)
**Goal:** Read a single **consumer** Google account's calendar(s) and maintain **unattended** access for **at least 3 months** without the user re-authenticating.
**Predecessor:** `Calendar-kiosk_old` (built in Google AI Studio) — broke roughly every **7 days**, requiring re-linking.
**Status of this doc:** Authoritative. Facts verified against Google's official documentation, June 2026. Sources listed at the end.

---

## 0. Executive summary (read this first)

- **Root cause of the 7-day breakage:** The old app's Google Cloud project had its OAuth consent screen in **"Testing"** publishing status. Google **deliberately expires refresh tokens after 7 days** for any consent screen that is `External` + `Testing` (unless the only scopes are basic profile/email). Every refresh token the kiosk obtained was dead within a week, forcing re-linking. This is documented Google behavior, **not a bug** in the old app's code.
- **The fix (token lifetime):** Move the OAuth consent screen to **"In production"** publishing status. Refresh tokens issued under production status do **not** have the 7-day cap and are effectively long-lived.
- **The fix (architecture):** Do **not** hold tokens in the browser (SPA/implicit/PKCE-in-browser). Use a **small always-on backend** (server or serverless) that holds the **refresh token**, mints short-lived **access tokens** on demand, and serves calendar data (or fresh access tokens) to the kiosk. This is the robust unattended pattern for a single consumer account.
- **Verification:** For a **single-user** consumer kiosk you can stay **In production but unverified** and remain under Google's **100-user cap**, which is fine for one user. You get long-lived refresh tokens **without** completing brand/scope verification. You will click past a one-time "Google hasn't verified this app" warning during the initial link. (Full verification is only needed if you ever distribute to many users.)

---

## 1. Root cause of the ~7-day token expiry

### 1.1 The exact mechanism

Google's official OAuth 2.0 documentation states verbatim:

> "A Google Cloud Platform project with an OAuth consent screen configured for an **external** user type and a publishing status of **'Testing'** is issued a refresh token **expiring in 7 days**, unless the only OAuth scopes requested are a subset of name, email address, and user profile."

The kiosk requests a **calendar** scope (sensitive), which is **not** in that basic subset. Therefore, while the project sits in **Testing**, every refresh token Google issues is hard-coded to die in 7 days. When the refresh token dies, the next token refresh fails with `invalid_grant`, the kiosk can no longer mint access tokens, and the only recovery is the user re-doing the OAuth consent ("re-linking"). This matches the observed ~7-day cadence exactly.

**This is the definitive cause.** It is independent of how the code stores or refreshes tokens — no code change alone fixes it. The publishing status must change.

### 1.2 The fix: publish to "In production"

Changing the OAuth consent screen's **Publishing status** from **Testing** to **In production** removes the 7-day cap. Refresh tokens issued under production status persist until something explicitly invalidates them (see §1.4). For a kiosk used daily, none of those invalidation conditions normally trigger, so the token survives well beyond 3 months.

### 1.3 Does publishing to production require verification? (Important nuance)

Two things are commonly conflated. They are **separate**:

| Concept | What it controls | Needed for our kiosk? |
|---|---|---|
| **Publishing status** = *In production* | Removes the 7-day refresh-token expiry | **YES — this is the fix** |
| **OAuth app verification** (brand + sensitive-scope review) | Removes the "unverified app" warning screen and the 100-new-user cap | **NO — not required for a single user** |

Key facts (verified):

- A calendar scope (`.../auth/calendar.readonly`) is a **sensitive** scope. Apps that request sensitive scopes and are **not verified** show a one-time **"Google hasn't verified this app"** warning before the consent screen, and are **capped at 100 new users** over the project's lifetime.
- That **100-user cap is irrelevant for a kiosk used by one person.** You consent **once** with your own account, click "Advanced → Go to *(app)* (unsafe)" past the warning, grant calendar read access, and you're done. You have consumed 1 of 100 user slots.
- Crucially, **you can be "In production" and still unverified.** Production status (which gives long-lived tokens) does **not** require passing verification. Verification only removes the warning screen and the user cap — neither of which blocks a single-user setup.

**Conclusion:** Publish to production. Do **not** bother with full verification unless you later distribute the kiosk to >100 people. Verification (if ever needed) requires: brand verification, domain ownership, a privacy policy URL, a homepage, an in-scope justification, and a **demonstration video** showing the consent flow and how each sensitive scope is used; review typically takes a few business days (longer for restricted scopes — but calendar read is *sensitive*, not *restricted*, which is the lighter track).

### 1.4 What still invalidates a production refresh token (design around these)

Even under production status, a refresh token stops working if:

1. **The user revokes app access** (via the Google Account "Third-party access" page).
2. **The refresh token is unused for 6 months.** (A daily kiosk never hits this.)
3. **The 100-refresh-tokens-per-account-per-client limit is exceeded.** Creating a 101st token silently invalidates the oldest. *Mitigation:* don't re-run the consent flow repeatedly; reuse the stored token. The kiosk should consent **once** and then only refresh, never re-authorize, so it holds exactly **one** live token.
4. **The user changes their Google password** — this only invalidates **Gmail-scoped** tokens. Calendar-only scopes are **not** affected by password changes. (Another reason to request *only* calendar scopes.)
5. Account/admin policy changes (not applicable to a personal gmail.com account).

**Design implication:** Request only calendar read scopes, store and reuse a single refresh token, and refresh daily. Under those conditions the token comfortably survives 3+ months — in practice indefinitely.

---

## 2. The right OAuth flow for an unattended kiosk

### 2.1 Why "token in the browser" is the wrong pattern

The old app effectively kept Google credentials in the browser context. That is unsuitable for unattended long-lived access for several reasons:

- **Implicit flow** (legacy SPA flow) returns only a **short-lived access token (≈1 hour)** and **no refresh token at all**. The kiosk would lose access every hour and there is nothing to refresh with. Google has also deprecated the implicit flow.
- **Browser PKCE flow** (Authorization Code + PKCE with no client secret) *can* return a refresh token, but:
  - Tokens issued to a public browser client are shorter-lived / more aggressively rotated, and storing a refresh token in browser storage (localStorage/IndexedDB) is a **security exposure** — anyone with access to the kiosk tablet or any XSS can exfiltrate it.
  - A kiosk browser session can be cleared (cache wipe, app update, Fully Kiosk restart, OS update) which destroys browser-held tokens and forces re-linking.
  - Token refresh from the browser requires the browser to be awake and online at the right moment; a backend can refresh reliably on a schedule.
- **The refresh token is the long-lived secret that must survive 3 months.** It belongs in durable server-side storage, never shipped to a kiosk display device.

### 2.2 The robust pattern: a small backend holds the refresh token

```
                  one-time consent (you, in a normal browser)
   You ──────────────────────────────────────────────► Google OAuth
                                                            │ returns auth code
                                                            ▼
                                              ┌──────────────────────────┐
                                              │   Backend (server or     │
   Kiosk tablet  ◄── calendar JSON ──────────│   serverless function)   │
   (Fully Kiosk) ── HTTPS request ──────────►│  • stores REFRESH TOKEN  │
                                              │  • mints access tokens   │
                                              │  • calls Calendar API    │
                                              └──────────────────────────┘
                                                            │ access token (~1h)
                                                            ▼
                                                   Google Calendar API
```

- The **backend** completes the Authorization Code flow once, receives and **persists the refresh token**, and from then on exchanges it for fresh ~1-hour access tokens whenever needed.
- The **kiosk** never sees the refresh token. It either (a) requests calendar data from your backend (preferred — backend does the Calendar API call and returns clean JSON), or (b) requests a short-lived access token from the backend and calls the Calendar API directly. Option (a) is cleaner and keeps all Google credentials server-side.
- This decouples token lifetime from the fragile browser environment. A tablet wipe, kiosk-browser update, or OS reboot does **not** require re-linking, because the refresh token lives on the backend.

### 2.3 Comparison of options

| Option | How it works | Works with consumer gmail.com? | Unattended 3-month viability | Verdict |
|---|---|---|---|---|
| **(a) Backend holds refresh token** (Authorization Code, "Web application" client, `access_type=offline`, production status) | One-time consent → backend stores refresh token → mints access tokens forever | **Yes** | **Yes** — survives indefinitely once production status removes the 7-day cap | ✅ **RECOMMENDED** |
| **(b) Service Account + domain-wide delegation** | Service account impersonates a user; no interactive consent | **No.** DWD impersonation only works for users in a **Google Workspace domain**. A personal @gmail.com address cannot be impersonated (returns an error). | N/A for consumer accounts | ❌ Not usable — consumer account |
| **(c) Device Authorization flow** ("TV & limited-input device" client) | Device shows a code; user enters it on a phone; device gets tokens incl. refresh token | **Yes** | **Yes** — also yields a refreshable token under production status | ⚠️ Viable but unnecessary; you have a full browser for the one-time consent. Use (a). |
| Browser implicit flow | Access token only, ~1h, no refresh token | Yes | **No** — dies hourly | ❌ |
| Browser PKCE (token in browser) | Refresh token stored in browser | Yes | Fragile — security + session-wipe risk | ❌ Avoid |

**Recommendation for a single consumer Google account: Option (a).** A lightweight backend (a tiny Node/Python service, or a serverless function on Cloud Run / Cloud Functions / Vercel / a small VPS) that holds the refresh token and serves calendar data to the kiosk. Use the **"Web application"** OAuth client type with `access_type=offline` and `prompt=consent` on the initial authorization to guarantee a refresh token is issued.

> Note on Service Accounts: They are the "no user interaction" dream, but **domain-wide delegation is a Workspace-only feature** — a service account cannot read a consumer @gmail.com calendar by impersonation. The only consumer workaround would be to make calendars public and share them to the service account, which is brittle and loses private event details. **Do not use a service account for this project.**

---

## 3. Calendar API usage details

### 3.1 Scopes (request the minimum)

Use **read-only** scopes only. Requesting only calendar read scopes also means a Google **password change won't invalidate** the token (§1.4).

| Scope | Grants | Use |
|---|---|---|
| `https://www.googleapis.com/auth/calendar.readonly` | Read access to calendars **and** events on them | **Recommended** — lets you list the user's calendars and read events |
| `https://www.googleapis.com/auth/calendar.events.readonly` | Read access to events only | Narrower; use if you hard-code which calendars to read |

Recommendation: **`calendar.readonly`** so the kiosk can enumerate the user's calendar list and colors. Both are **sensitive** scopes (trigger the unverified-app warning, but not restricted-scope review).

### 3.2 Reading events: recurring expansion, time window, time zones

Use `events.list` with these parameters:

- **`singleEvents=true`** — expands recurring events into individual instances. Without this you get the recurring *rule*, not the occurrences, which is useless for a day/week display.
- **`orderBy=startTime`** — only valid when `singleEvents=true`; gives chronological order.
- **`timeMin` / `timeMax`** — bound the window (e.g., now → now+30 days). **Always set these** for a kiosk; never fetch unbounded.
- **`timeZone`** — pass the kiosk's display time zone (IANA, e.g., `America/New_York`) so all-day vs timed events render correctly. Be deliberate: all-day events use `start.date`; timed events use `start.dateTime` with an offset. Render in the tablet's local zone.
- **`maxResults`** + **`pageToken`** — page through results; the API caps page size.
- **`fields`** — request only the fields you render (e.g., `items(summary,start,end,colorId,location),nextPageToken,nextSyncToken`) to cut payload and quota.

**Consistency rule:** whatever you pass for `singleEvents` on the **initial full sync**, you must pass the **same value** on every incremental sync, or the API returns **400 Bad Request**.

### 3.3 Incremental sync with `syncToken` (efficient + low quota)

1. **Initial full sync:** call `events.list` with your parameters (no `syncToken`), paging with `pageToken` until exhausted. The **final page** returns a **`nextSyncToken`** — **persist it**.
2. **Incremental sync:** call `events.list` again passing **`syncToken`** (and the *same* `singleEvents` etc., but **not** `timeMin`/`timeMax` together with `syncToken` — those are incompatible; the token already encodes the window). You receive only changes since last sync, including deletions (`status: "cancelled"`). Store the new `nextSyncToken`.
3. **Handle `410 GONE`:** a sync token can be invalidated by the server (token aging, ACL changes, rotation). When `events.list` returns **HTTP 410** with reason **`fullSyncRequired`**, you must: **discard the stored sync token, clear the local event cache, and perform a fresh full sync** to obtain a new `nextSyncToken`. Build this recovery path in from day one — it *will* fire occasionally and is normal.

### 3.4 Watch / push notifications vs polling

- **Polling** (call incremental sync on a timer) is the **simplest and recommended** approach for a kiosk. With a `syncToken`, each poll is cheap. A poll interval of **1–5 minutes** is plenty fresh for a wall calendar and trivially within quota.
- **Push notifications (`events.watch`)** require a **public HTTPS webhook endpoint** with a valid certificate, channels **expire and must be renewed**, and `/watch` calls themselves count against quota. They give near-instant updates but add real infrastructure complexity.
- **Recommendation:** **Poll with `syncToken` every ~2 minutes.** Only add push later if instant updates matter. (If you do both, keep a periodic poll as a safety net to catch any missed notifications.)

### 3.5 Quotas & rate limits

Current Calendar API limits (per Cloud project):

- **1,000,000 queries per day per project**
- **10,000 requests per minute per project**
- **600 requests per minute per user per project** (sliding window)

A single kiosk polling every 2 minutes uses ~720 calls/day — about **0.07%** of the daily quota. Quota is a non-issue at this scale. (Note: Google announced a quota-framework update effective **May 1, 2026**; projects that used the API between Nov 2025–Apr 2026 keep their prior quotas. Billing for overages was flagged as "coming later in 2026 with 90 days' notice" — monitor, but our volume is negligible.) Always handle **403 `rateLimitExceeded` / 429** with **exponential backoff + jitter** regardless.

### 3.6 Multiple calendars and colors

- List the user's calendars with **`calendarList.list`**; each entry has an `id`, a `summary`, and color fields (`backgroundColor`/`foregroundColor`, or a `colorId` into the palette from **`colors.get`**).
- Fetch events **per calendar** (`events.list` is per-`calendarId`; use `"primary"` for the main one). Maintain a **separate `syncToken` per calendar**.
- Map each event's `colorId` (or fall back to the calendar's color) through `colors.get` to render Google-consistent colors on the kiosk.

---

## 4. Token storage, security, refresh logic, and graceful re-auth

### 4.1 Storage & security

- Store the **refresh token** server-side only, **encrypted at rest** (e.g., a secrets manager, an encrypted env/secret, or an encrypted DB column). Never log it. Never send it to the kiosk.
- Store the **client secret** server-side only.
- The kiosk holds **no** Google credentials. It authenticates to *your backend* (e.g., a simple shared token / device key over HTTPS) and receives calendar JSON.
- Serve everything over **HTTPS**. Lock the Fully Kiosk Browser to your app URL.

### 4.2 Refresh logic

- Keep the current **access token + its expiry** in memory/cache on the backend. Before each Calendar API call, if the access token is missing or expires within ~60 seconds, **refresh it** by POSTing the refresh token to Google's token endpoint (`grant_type=refresh_token`).
- Treat access tokens as disposable (~1 hour). Treat the refresh token as the durable secret.
- Refresh **lazily on demand** (or on a schedule). Because the kiosk polls regularly, the refresh token is exercised daily, so it never hits the 6-month-inactivity rule.

### 4.3 If the refresh token is revoked / dies

A refresh exchange that returns **`invalid_grant`** means the refresh token is dead (revoked by user, expired, or evicted by the 100-token limit). When this happens:

1. **Detect it:** catch `invalid_grant` from the token endpoint specifically (distinguish from transient network/5xx errors, which should be retried).
2. **Surface it gracefully on the kiosk:** the backend exposes an "auth healthy?" status. When the refresh token is dead, the kiosk shows a clear, non-cryptic banner — e.g., *"Calendar disconnected — re-link required"* — instead of silently showing stale events or a blank screen. Show the **last successful sync time** so a stale display is obvious.
3. **Provide a one-click re-link:** a simple URL/QR on the backend that restarts the Authorization Code consent flow. Re-linking should take seconds, not require rebuilding anything.
4. **Keep serving the last-known-good cached events** (clearly marked stale) so the wall display degrades gracefully rather than going blank.

> With production publishing status, request-only-calendar scopes, and single-token reuse, `invalid_grant` should essentially **never** occur except via deliberate user revocation. The graceful-reauth path exists as a safety net, not an expected weekly event.

---

## 5. Google Cloud Console setup checklist (do this exactly)

> Do this with the **same consumer Google account** whose calendar the kiosk will display.

1. **Create a project**
   - Go to <https://console.cloud.google.com/> → project picker → **New Project** → name it (e.g., `calendar-kiosk`) → Create.

2. **Enable the Calendar API**
   - APIs & Services → **Library** → search **"Google Calendar API"** → **Enable**.

3. **Configure the OAuth consent screen**
   - APIs & Services → **OAuth consent screen** (now under "Branding"/"Audience" in the newer Console layout).
   - **User type: External** (consumer gmail.com accounts must use External; "Internal" only exists for Workspace orgs).
   - Fill **App name**, **User support email**, and **Developer contact email**. (A homepage/privacy-policy URL is only strictly required for *verification*, not to function unverified — but fill them if you have them.)

4. **Add scopes**
   - On the Scopes step, add **`.../auth/calendar.readonly`** (and `.../auth/calendar.events.readonly` if you prefer the narrower one). These are **sensitive** scopes; the Console will flag them as such. That's expected.

5. **(Optional) add yourself as a test user — then move past Testing**
   - You may add your account under **Test users** to validate the flow first. But the **critical step** is the next one.

6. **PUBLISH TO PRODUCTION (this is the fix for the 7-day problem)**
   - On the OAuth consent screen / **Audience** page, find **Publishing status** and click **"PUBLISH APP"** → confirm to move from **Testing** to **In production**.
   - You will likely see a prompt about verification. **You do not need to submit for verification** for single-user use. Production status alone removes the 7-day refresh-token cap. You'll remain "In production, unverified," which is fine under the 100-user cap.

7. **Create OAuth client credentials (correct type)**
   - APIs & Services → **Credentials** → **Create Credentials** → **OAuth client ID**.
   - **Application type: Web application** (this matches the backend-holds-refresh-token pattern in §2.2).
   - **Authorized redirect URIs:** add the exact redirect URI your backend uses for the consent callback, e.g.:
     - `http://localhost:PORT/oauth2callback` (for a local one-time link), and/or
     - `https://your-backend.example.com/oauth2callback` (production backend).
     - Must match **exactly** (scheme, host, port, path) — a mismatch causes `redirect_uri_mismatch`.
   - Save the **Client ID** and **Client Secret** → store the secret server-side only.

8. **Perform the one-time authorization**
   - From your backend (or a one-off local script), open the Google authorization URL with:
     - `scope=https://www.googleapis.com/auth/calendar.readonly`
     - **`access_type=offline`** (required to receive a refresh token)
     - **`prompt=consent`** (forces a refresh token to be returned even on re-consent)
   - In the browser, you'll see **"Google hasn't verified this app"** → **Advanced** → **Go to *(app name)* (unsafe)** → grant calendar access.
   - The backend's redirect handler receives the **authorization code**, exchanges it for an **access token + refresh token**, and **persists the refresh token** (encrypted).

9. **Verify long-lived behavior**
   - Confirm the backend can mint a fresh access token from the stored refresh token.
   - Confirm publishing status reads **"In production."** Note the date; the refresh token should now persist well past 7 days. Re-check after a couple of weeks to confirm it survives (it will, once out of Testing).

### Setup checklist (quick reference)

- [ ] Project created
- [ ] Calendar API enabled
- [ ] Consent screen: **External**, app name + support/dev emails set
- [ ] Scope `calendar.readonly` added
- [ ] **Publishing status = In production** ← the 7-day fix
- [ ] OAuth client = **Web application**, redirect URI added exactly
- [ ] Client ID + secret stored server-side (secret never in browser)
- [ ] One-time consent done with `access_type=offline` + `prompt=consent`
- [ ] Refresh token persisted (encrypted) on backend
- [ ] Verified token mints access tokens and survives >7 days

---

## 6. Sources (verified June 2026)

- Using OAuth 2.0 to Access Google APIs (refresh token 7-day Testing rule, 6-month inactivity, 100-token limit, invalidation conditions): <https://developers.google.com/identity/protocols/oauth2>
- Unverified apps / 100-new-user cap / unverified-app warning screen: <https://support.google.com/cloud/answer/7454865>
- Sensitive scope verification: <https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification>
- OAuth App Verification Help Center: <https://support.google.com/cloud/answer/13463073>
- Manage App Audience (publishing status / audience): <https://support.google.com/cloud/answer/15549945>
- OAuth 2.0 for TV and Limited-Input Devices (device flow): <https://developers.google.com/identity/protocols/oauth2/limited-input-device>
- OAuth 2.0 for iOS & Desktop / native apps: <https://developers.google.com/identity/protocols/oauth2/native-app>
- Control API access with domain-wide delegation (Workspace-only): <https://knowledge.workspace.google.com/admin/apps/control-api-access-with-domain-wide-delegation>
- Calendar API — Synchronize resources efficiently (syncToken, full vs incremental): <https://developers.google.com/workspace/calendar/api/guides/sync>
- Calendar API — Handle API errors (410 fullSyncRequired): <https://developers.google.com/workspace/calendar/api/guides/errors>
- Calendar API — Push notifications (watch/webhook): <https://developers.google.com/workspace/calendar/api/guides/push>
- Calendar API — Usage limits / quotas (incl. May 1 2026 change): <https://developers.google.com/workspace/calendar/api/guides/quota>
- Events: watch reference: <https://developers.google.com/workspace/calendar/api/v3/reference/events/watch>
