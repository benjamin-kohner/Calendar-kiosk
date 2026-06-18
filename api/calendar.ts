import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAccessToken, listCalendars, listEvents, AuthError, type CalEvent } from './_google';

// Rolling window: 1 month back, ~3.5 months forward (covers the 3-month requirement).
const BACK_DAYS = 31;
const FWD_DAYS = 104;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const token = await getAccessToken();
    const now = new Date();
    const timeMin = new Date(now.getTime() - BACK_DAYS * 86400000).toISOString();
    const timeMax = new Date(now.getTime() + FWD_DAYS * 86400000).toISOString();

    const calendars = await listCalendars(token);
    const all: CalEvent[] = [];
    // Fetch calendars in parallel.
    const results = await Promise.all(
      calendars.map((c) => listEvents(token, c, timeMin, timeMax))
    );
    for (const r of results) all.push(...r);

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      calendars,
      events: all,
      syncedAt: new Date().toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  } catch (err) {
    if (err instanceof AuthError) {
      // Signal the frontend to show the reconnect banner.
      res.status(401).json({ error: 'auth', message: 'Google authorization required' });
      return;
    }
    console.error('calendar error', err);
    res.status(502).json({ error: 'upstream', message: String(err) });
  }
}
