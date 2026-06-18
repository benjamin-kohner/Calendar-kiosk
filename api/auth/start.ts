import type { VercelRequest, VercelResponse } from '@vercel/node';
import { redirectUri, SCOPE } from '../_google.js';

// Kicks off the one-time Google authorization. access_type=offline +
// prompt=consent guarantees Google returns a long-lived refresh token.
export default function handler(req: VercelRequest, res: VercelResponse) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(500).send('GOOGLE_CLIENT_ID is not configured.');
    return;
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(req),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true'
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
