import type { VercelRequest } from '@vercel/node';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CAL_BASE = 'https://www.googleapis.com/calendar/v3';
export const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

export class AuthError extends Error {}

export function baseUrl(req: VercelRequest): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

export function redirectUri(req: VercelRequest): string {
  return process.env.OAUTH_REDIRECT_URI || `${baseUrl(req)}/api/auth/callback`;
}

interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

/** Exchange an authorization code for tokens (one-time, during setup). */
export async function exchangeCode(code: string, redirect: string): Promise<GoogleTokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: redirect,
      grant_type: 'authorization_code'
    })
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as GoogleTokens;
}

/** Mint a short-lived access token from the long-lived refresh token. */
export async function getAccessToken(): Promise<string> {
  const refresh = process.env.GOOGLE_REFRESH_TOKEN;
  if (!refresh) throw new AuthError('GOOGLE_REFRESH_TOKEN not set');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: refresh,
      grant_type: 'refresh_token'
    })
  });
  if (res.status === 400 || res.status === 401) {
    // invalid_grant => refresh token revoked/expired; surface as re-auth needed.
    throw new AuthError(`refresh failed: ${await res.text()}`);
  }
  if (!res.ok) throw new Error(`refresh failed: ${res.status}`);
  const data = (await res.json()) as GoogleTokens;
  return data.access_token;
}

export interface CalendarMeta {
  id: string;
  summary: string;
  color: string;
}

export async function listCalendars(token: string): Promise<CalendarMeta[]> {
  const res = await fetch(`${CAL_BASE}/users/me/calendarList?minAccessRole=reader`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`calendarList ${res.status}`);
  const data = (await res.json()) as {
    items?: { id: string; summary: string; backgroundColor?: string; selected?: boolean }[];
  };
  const filter = (process.env.GOOGLE_CALENDAR_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return (data.items ?? [])
    .filter((c) => (filter.length ? filter.includes(c.id) : true))
    .map((c) => ({ id: c.id, summary: c.summary, color: c.backgroundColor || '#7c8aa5' }));
}

export interface CalEvent {
  id: string;
  calendarId: string;
  calendarName?: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  description?: string;
  color: string;
}

interface GEvent {
  id: string;
  summary?: string;
  location?: string;
  description?: string;
  status?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

export async function listEvents(
  token: string,
  cal: CalendarMeta,
  timeMin: string,
  timeMax: string
): Promise<CalEvent[]> {
  const out: CalEvent[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      showDeleted: 'false',
      maxResults: '2500',
      timeMin,
      timeMax
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch(
      `${CAL_BASE}/calendars/${encodeURIComponent(cal.id)}/events?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) break; // skip calendars that error rather than failing the whole sync
    const data = (await res.json()) as { items?: GEvent[]; nextPageToken?: string };
    for (const e of data.items ?? []) {
      if (e.status === 'cancelled' || !e.start) continue;
      const allDay = Boolean(e.start.date);
      out.push({
        id: `${cal.id}::${e.id}`,
        calendarId: cal.id,
        calendarName: cal.summary,
        title: e.summary ?? '',
        start: e.start.dateTime ?? e.start.date ?? '',
        end: e.end?.dateTime ?? e.end?.date ?? e.start.dateTime ?? e.start.date ?? '',
        allDay,
        location: e.location,
        description: e.description,
        color: cal.color
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}
