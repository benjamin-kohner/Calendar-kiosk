import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAccessToken, AuthError } from './_google.js';

// Lightweight health/heartbeat endpoint. Point an uptime monitor at this.
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const hasRefresh = Boolean(process.env.GOOGLE_REFRESH_TOKEN);
  const hasClient = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  let auth: 'ok' | 'needs-auth' | 'unconfigured' = 'unconfigured';

  if (hasClient && hasRefresh) {
    try {
      await getAccessToken();
      auth = 'ok';
    } catch (err) {
      auth = err instanceof AuthError ? 'needs-auth' : 'ok';
    }
  } else if (hasClient) {
    auth = 'needs-auth';
  }

  res.setHeader('Cache-Control', 'no-store');
  res.status(auth === 'ok' ? 200 : 503).json({
    status: auth === 'ok' ? 'ok' : 'degraded',
    auth,
    time: new Date().toISOString()
  });
}
