# 09 — Security & Privacy Requirements

**Component:** Calendar Kiosk (Android tablet, Fully Kiosk Browser, 24/7, private home)
**Author:** Application Security
**Status:** Draft for implementation
**Scope:** Custody of the Google OAuth refresh token, threat model for an always-unlocked wall tablet, secrets management, transport, caching, revocation, supply chain, and privacy.

---

## 1. System summary and trust assumptions

The product is a wall-mounted Android tablet running a single web app in Fully Kiosk Browser, displaying a shared household calendar (from the owner's personal Google Calendar) plus weather. It is powered on continuously and must hold a **long-lived Google OAuth refresh token** so it can mint short-lived access tokens for 3+ months without anyone re-authenticating.

Three facts drive every requirement below:

1. **The tablet is a hostile-by-default endpoint.** It is physically reachable by everyone in the home (family, kids, guests, cleaners, contractors), it is never locked, and its screen is in plain view. Anything stored on it or reachable from its browser is effectively public to anyone who can touch it.
2. **The refresh token is the crown jewel.** It is a bearer credential that grants ongoing access to the owner's calendar until explicitly revoked. It is far more sensitive than any single access token because it is long-lived and self-renewing.
3. **There must be a server.** A purely client-side app (the default shape of an AI Studio / single-page prototype) cannot safely hold the refresh token or the OAuth client secret. A small backend is a hard requirement, not an optimization.

**In scope:** the web app, its backend, token custody, secrets, transport on the home LAN, on-device caching, third-party data flows (Google, weather).
**Out of scope (assumed handled elsewhere):** the home Wi-Fi/router hardening, OS patching of the tablet, and physical mounting. These are noted where they affect the threat model but are the homeowner's responsibility.

---

## 2. Threat model

### 2.1 Assets

| Asset | Sensitivity | Why |
|---|---|---|
| Google OAuth **refresh token** | Critical | Long-lived bearer credential to the owner's calendar; self-renewing until revoked. |
| OAuth **access tokens** | High | Short-lived (≈1h) bearer credentials to the calendar. |
| OAuth **client secret** | Critical | Identifies the app to Google; with it + a refresh token an attacker can mint tokens at will. |
| **Weather API key(s)** | Medium | Abusable for quota/billing fraud; not personal data but real cost. |
| **Cached calendar data** | High | Event titles, times, attendees, locations, notes — reveals when the home is empty, who visits, medical/personal details. |
| Session/auth cookie to the backend | High | Grants the kiosk's level of access to the backend API. |

### 2.2 Adversaries and attack surfaces

| Adversary | Capability | Primary concern |
|---|---|---|
| **Anyone physically present** (guest, child, contractor) | Can tap the always-unlocked screen, browse, open settings/URL bar if exposed | Reading calendar, exfiltrating tokens via DevTools/`localStorage`, navigating away, abusing kiosk exit |
| **Shoulder-surfer / passer-by** | Can read the screen from across the room | Passive disclosure of schedule, locations, "house empty" windows |
| **Device thief** | Walks off with the physical tablet | Full offline access to anything persisted on the device (tokens, cache) |
| **LAN attacker** | Compromised IoT device, rogue guest on Wi-Fi, ARP/DNS spoofing | Intercepting plaintext HTTP between tablet and self-hosted backend; stealing tokens/cookies in transit |
| **Malicious/abandoned dependency** | Supply-chain compromise of an npm package or CDN script | Exfiltrating tokens and calendar data to attacker-controlled host |
| **Third-party services** | Analytics, ad SDKs, error trackers, weather API | Silently receiving calendar contents or tokens in payloads/URLs |
| **Remote web attacker** | Knows/guesses the backend URL | CSRF, open CORS, unauthenticated token endpoints |

### 2.3 Key threat-model conclusions

- **Treat the tablet as untrusted storage.** Do not store the refresh token, client secret, or any long-lived credential anywhere the tablet's browser/JS can read it (`localStorage`, `sessionStorage`, IndexedDB, JS variables, in-page config, query strings).
- **Minimize what the screen and cache reveal.** Even with perfect token custody, a stolen/over-shared device leaks schedule data. Cache the minimum and consider redaction.
- **Encrypt the LAN.** "It's only my home network" is false comfort: IoT devices and guests share that network and are a realistic pivot.

---

## 3. Token custody (the core requirement)

### 3.1 Why the refresh token must NOT live client-side

On a shared, unlocked wall tablet:

- `localStorage`/`sessionStorage`/IndexedDB/JS variables are readable by **anyone who opens DevTools**, by any injected/compromised script, and by anyone who physically takes the device.
- There is **no secure keystore available to a web page**. The browser sandbox offers no hardware-backed secret storage to JS. "Obfuscating" the token in client code is not security.
- A leaked refresh token gives an attacker **months of silent access** to the owner's calendar from anywhere, with no further interaction — and self-renews.

Therefore the refresh token, the OAuth client secret, and the token-exchange logic **must live only on the backend**. The tablet never sees the refresh token.

### 3.2 Backend-custody architecture (required pattern)

```
[ Tablet / Fully Kiosk ]  --HTTPS-->  [ Backend (token vault + API proxy) ]  --HTTPS-->  [ Google Calendar API ]
   - renders UI                          - holds refresh token (encrypted at rest)        [ Weather API ]
   - holds ONLY a short-lived,           - holds OAuth client secret + API keys
     httpOnly session cookie             - does OAuth code->token exchange + refresh
   - never sees refresh token            - calls Google/weather, returns sanitized data
     or client secret                    - enforces read-only scope, rate limits
```

- The OAuth **authorization-code flow with PKCE** runs server-side; the **redirect/callback lands on the backend**, which exchanges the code for tokens and stores the refresh token. The browser never receives the code-for-token exchange response.
- The tablet authenticates to the **backend** only, with an httpOnly, Secure, SameSite cookie (or equivalent). That cookie grants "ask the proxy for my calendar," **not** raw Google credentials.
- The backend acts as a **proxy**: it calls Google with a freshly refreshed access token and returns only the fields the UI needs.

### 3.3 Encryption at rest

- The refresh token, client secret, and API keys must be **encrypted at rest** (e.g., envelope encryption with a key from a secrets manager / OS keychain / KMS, or at minimum a key held in an env var on a locked-down host — never committed to the repo or the same store as the ciphertext).
- The decryption key must not be co-located with the ciphertext in a way that a single file read defeats both.
- Backend host disk should ideally be on encrypted storage; file permissions on any token store restricted to the service user (`600`/owner-only).

### 3.4 Acceptance criteria — token custody

- [ ] Grep of the shipped client bundle and runtime `localStorage`/`sessionStorage`/IndexedDB shows **no refresh token, no client secret, no API keys**.
- [ ] Refresh token exists only in backend storage, **encrypted at rest**; verified by inspecting the store.
- [ ] Tablet→backend auth uses an **httpOnly + Secure + SameSite** cookie; the cookie is not readable by JS (`document.cookie` does not expose it).
- [ ] All Google token exchange/refresh happens on the backend; network capture from the tablet shows calls only to the backend, never directly to `oauth2.googleapis.com` with secrets.
- [ ] Removing/rotating the backend secret immediately breaks token refresh (proves the secret is the real gate).

---

## 4. Least-privilege scopes

- Request **read-only** calendar access: `https://www.googleapis.com/auth/calendar.readonly` (or the narrower `calendar.events.readonly`). Never request write, full `calendar`, or unrelated scopes (Gmail, Drive, contacts).
- Configure the Google Cloud OAuth consent screen with the **minimum scopes**; if the app only reads one calendar, prefer the most specific scope available.
- Restrict the OAuth client's **authorized redirect URIs** to the exact backend callback URL; no wildcards.
- Lock the **weather API key** to the minimum: referrer/IP allowlist and read-only/free-tier endpoints where the provider supports it.

**Acceptance criteria**
- [ ] OAuth consent screen lists only read-only calendar scope(s).
- [ ] Attempting a write via the granted token fails (proves read-only).
- [ ] Redirect URI allowlist contains only the production backend callback.

---

## 5. Secrets management

- **Nothing secret ships in the client bundle.** Client secret, refresh token, and weather/API keys must never appear in JS, HTML, env files served to the browser, source maps, or git history.
- Backend secrets come from a **secrets manager or environment variables injected at runtime**, not from committed files.
- `.env`, key files, and token stores are in `.gitignore`; verify git history is clean (rotate anything ever committed).
- Provide a documented `.env.example` with **placeholders only**.
- Build pipeline must not bake `process.env.*` secrets into a frontend bundle (a classic Vite/Next "any var prefixed `VITE_`/`NEXT_PUBLIC_` is public" footgun).

**Acceptance criteria**
- [ ] `git log -p` / secret scanner (e.g., gitleaks/trufflehog) finds no secrets in history.
- [ ] Built frontend assets contain no secret values (grep the `dist/`/build output).
- [ ] All secrets resolve from runtime env/secrets manager; rotating one without a code change takes effect on restart.

---

## 6. Transport security (TLS everywhere, including the home LAN)

- **All** traffic — tablet↔backend, backend↔Google, backend↔weather — over HTTPS/TLS. No plaintext HTTP anywhere, including on the LAN.
- Self-hosting on the home network is the **higher-risk** case: other IoT devices and guests share the LAN and can sniff/spoof. Do not assume the LAN is private.
  - Use a real certificate: either a public hostname with Let's Encrypt (e.g., via a reverse proxy / split-horizon DNS) or an **internal CA** whose root is installed on the tablet. Avoid clicking-through self-signed cert warnings on a kiosk (trains users/devices to ignore warnings and enables MITM).
- Enforce **HSTS**, TLS 1.2+ (prefer 1.3), and disable legacy ciphers on the backend/reverse proxy.
- Set `Secure` on all cookies so they are never sent over plaintext.

**Acceptance criteria**
- [ ] Tablet→backend connection is HTTPS with a cert the tablet trusts (no warning, no manual override).
- [ ] HTTP requests to the backend are redirected to HTTPS or refused.
- [ ] TLS scan shows TLS 1.2+ only and no weak ciphers.

---

## 7. CORS and the backend-proxy pattern

- The browser **must not call Google or the weather API directly** — that would require shipping credentials client-side. All third-party calls go through the **backend proxy**.
- **CORS on the backend must be restrictive**: allow only the kiosk app's exact origin; **do not** use `Access-Control-Allow-Origin: *`, and never combine `*` with credentials.
- Backend endpoints that act on the session must enforce **CSRF protection** (SameSite cookies plus anti-CSRF token on state-changing requests) and reject requests with unexpected `Origin`/`Referer`.
- The proxy should **sanitize responses** to the fields the UI needs (don't blindly forward full Google API payloads, which may contain more than the kiosk should display).
- Apply **rate limiting** on proxy endpoints to bound abuse and protect upstream quota.

**Acceptance criteria**
- [ ] CORS allows only the kiosk origin; a request from any other origin is rejected.
- [ ] No third-party API is reachable directly from the browser (network capture confirms).
- [ ] State-changing endpoints reject cross-site/forged requests (CSRF test passes).

---

## 8. On-device caching and data sensitivity

The tablet will cache calendar data to render quickly and survive brief network drops. That cache is **sensitive personal data** on an unlocked, shared device.

- Cache the **minimum** needed to render the current view (e.g., a rolling window of upcoming events), not full calendar history.
- Prefer **in-memory / non-persistent** caching where feasible; if persistence is needed, scope it tightly and clear it on a schedule.
- Consider **redacting** sensitive fields on the always-on display: show "Busy" or titles only, and hide attendees/locations/notes/descriptions unless the household explicitly wants them shown. This directly mitigates shoulder-surfing and "house is empty" inference.
- Do **not** persist tokens or any credential on the device (see §3).
- Disable browser features that aid exfiltration on the kiosk: lock Fully Kiosk to the single app URL, disable the address bar, disable arbitrary navigation/downloads, and ideally block DevTools/remote debugging.

**Acceptance criteria**
- [ ] On-device storage contains only minimal calendar render data and no credentials.
- [ ] Sensitive fields are redacted/omitted on screen per the chosen policy (configurable).
- [ ] Kiosk is locked to the app origin; navigation away, address bar, and downloads are disabled.

---

## 9. Revocation and rotation

- Document and test a **one-step revocation**: the owner can revoke the kiosk's access at any time (Google Account → third-party access, and/or a backend "log out / wipe token" action that deletes the stored refresh token).
- Handle **token expiry/revocation gracefully**: if Google rejects the refresh token (revoked, expired, password change, scope removal), the kiosk shows a clear "reconnect required" state rather than failing silently or looping.
- Establish a **rotation procedure** for: the OAuth client secret, the weather API key, and the backend session-signing key — including how to roll without downtime and what to do after suspected compromise (revoke at Google, rotate secret, force re-auth).
- Keep refresh tokens **single-purpose per device/integration** so revoking one does not require re-authing everything else.

**Acceptance criteria**
- [ ] Revoking access at Google causes the kiosk to enter a clean "reconnect" state within one refresh cycle.
- [ ] A documented runbook exists for rotating the client secret and API keys.
- [ ] Deleting the backend's stored refresh token immediately stops calendar access.

---

## 10. Dependency and supply-chain hygiene

A single malicious dependency can exfiltrate the very tokens and calendar data this document protects.

- Keep the dependency surface **small**; prefer well-maintained libraries; avoid pulling large frameworks for trivial needs.
- **Pin** versions and commit a lockfile; review transitive additions.
- Run automated vulnerability scanning (`npm audit` / Dependabot / Renovate) and patch on a cadence.
- **Self-host or Subresource-Integrity-pin** any third-party scripts; avoid live `<script src=cdn>` includes that can change under you. No analytics/ad/tag-manager scripts on the kiosk (see §11).
- Apply a strict **Content-Security-Policy** that restricts script/connect sources to the backend origin only, blocking exfiltration to arbitrary hosts even if a dependency is compromised.
- Maintain an SBOM / dependency inventory for the backend and frontend.

**Acceptance criteria**
- [ ] Lockfile committed; CI fails on high/critical advisories.
- [ ] CSP present; `connect-src`/`script-src` restricted to the backend origin; no `unsafe-inline` for scripts where avoidable.
- [ ] No third-party CDN scripts without SRI; no analytics/ad SDKs present.

---

## 11. Privacy

- **Data minimization:** read only the calendar(s) needed; store and display the minimum; do not retain history beyond what the view requires.
- **No third-party analytics/telemetry that can see calendar contents.** Event titles, attendees, and locations must never be sent to analytics, error trackers, ad networks, or tag managers. If error logging is needed, scrub event payloads first.
- **No calendar data in URLs, query strings, or logs** (URLs leak to proxies, history, and referers; logs persist).
- **Owner consent and visibility:** the owner should know exactly what is accessed and be able to disconnect at any time (ties to §9 revocation).
- **Data locality:** prefer keeping calendar data within the owner's own backend; avoid sending it to additional third parties.
- Define a **retention policy** for backend logs and any cached data, and delete on a schedule.

**Acceptance criteria**
- [ ] No analytics/ad/telemetry network calls from the kiosk (network capture confirms).
- [ ] Backend logs contain no event titles/attendees/locations (log review/redaction test).
- [ ] Disconnect/wipe removes cached and stored calendar data.

---

## 12. Likely mistakes in a quick Google AI Studio / SPA prototype

These are the specific failures to assume exist in the prototype and must be fixed before deployment:

1. **Refresh token (and/or access token) stored in `localStorage`/JS** — readable by anyone at the tablet or any injected script. *(Critical — violates §3.)*
2. **OAuth client secret embedded in the client bundle or a `VITE_`/`NEXT_PUBLIC_` env var** — fully exposed to anyone who views source. *(Critical — §5.)*
3. **Weather/Google API keys hard-coded in frontend code** — exfiltratable and abusable for billing fraud. *(High — §5.)*
4. **Browser calls Google/weather APIs directly** (implicit flow or fetch-with-key), so there is no place to hide credentials. *(Critical — §3/§7.)*
5. **OAuth implicit flow instead of auth-code-with-PKCE on a backend** — tokens land in the browser/URL fragment. *(Critical — §3.2.)*
6. **No backend at all** — the whole design assumes the SPA holds the credentials. *(Critical — §3.)*
7. **Over-broad scopes** (full `calendar` or extra Google scopes) copied from a sample. *(High — §4.)*
8. **Plaintext HTTP on the LAN** or a self-signed cert the kiosk is told to ignore. *(High — §6.)*
9. **`Access-Control-Allow-Origin: *`** / permissive CORS, no CSRF protection. *(High — §7.)*
10. **Secrets committed to git** (including `.env` checked in). *(High — §5.)*
11. **Third-party analytics/CDN scripts** pulled in by the scaffold, with calendar data in scope. *(Medium/High — §10/§11.)*
12. **No revocation/rotation path**; token assumed permanent. *(Medium — §9.)*
13. **Full calendar payloads cached on device and rendered verbatim**, exposing attendees/locations to shoulder-surfers. *(Medium — §8.)*

---

## 13. Prioritized requirement summary

**P0 — must fix before any deployment**
1. Refresh token + client secret live **server-side only**, encrypted at rest; never in the client. (§3, §5)
2. Backend **proxy** for all Google/weather calls; browser never holds third-party credentials; OAuth **auth-code + PKCE** on the backend. (§3, §7)
3. **Read-only** calendar scope only. (§4)
4. **HTTPS/TLS everywhere**, including the home LAN, with a trusted cert. (§6)
5. No secrets in the client bundle or git history. (§5)

**P1 — required for production**
6. httpOnly/Secure/SameSite session cookie; restrictive CORS; CSRF protection. (§3.2, §7)
7. Strict CSP and no third-party analytics/ad/CDN scripts that can see calendar data. (§10, §11)
8. Revocation + rotation runbook; graceful "reconnect" handling. (§9)
9. Minimal, redactable on-device cache; kiosk locked down (no address bar/navigation/DevTools). (§8)

**P2 — hardening and hygiene**
10. Dependency pinning, vulnerability scanning, SBOM, SRI on any external scripts. (§10)
11. Log/data retention policy and PII scrubbing in logs. (§11)
12. Rate limiting and response sanitization on the proxy. (§7)

---

*End of document.*
