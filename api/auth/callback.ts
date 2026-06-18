import type { VercelRequest, VercelResponse } from '@vercel/node';
import { exchangeCode, redirectUri } from '../_google';

// Google redirects here with ?code=... We exchange it for a refresh token and
// show it once so the owner can paste it into the GOOGLE_REFRESH_TOKEN env var.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = req.query.code as string | undefined;
  const error = req.query.error as string | undefined;
  if (error) {
    res.status(400).send(page(`<p class="err">Authorization failed: ${escapeHtml(error)}</p>`));
    return;
  }
  if (!code) {
    res.status(400).send(page('<p class="err">Missing authorization code.</p>'));
    return;
  }

  try {
    const tokens = await exchangeCode(code, redirectUri(req));
    if (!tokens.refresh_token) {
      res
        .status(200)
        .send(
          page(`<p class="err">No refresh token was returned.</p>
          <p>This usually means this Google account was already authorized. Revoke this app's
          access at <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>
          and try again, or ensure the consent screen prompted you fresh.</p>`)
        );
      return;
    }
    const safe = escapeHtml(tokens.refresh_token);
    res.status(200).send(
      page(`
        <p class="ok">✓ Connected. Copy this refresh token:</p>
        <textarea readonly onclick="this.select()">${safe}</textarea>
        <ol>
          <li>In your Vercel project → <b>Settings → Environment Variables</b>, set
            <code>GOOGLE_REFRESH_TOKEN</code> to the value above.</li>
          <li>Redeploy (or it applies on next deploy).</li>
          <li>For local dev, paste it into <code>.env</code> as well.</li>
        </ol>
        <p class="note">This token is long-lived because your OAuth consent screen is published to
        <b>Production</b>. Keep it secret — it grants read access to your calendar.</p>
        <p><a href="/">← Back to calendar</a></p>
      `)
    );
  } catch (err) {
    res.status(502).send(page(`<p class="err">Token exchange failed.</p><pre>${escapeHtml(String(err))}</pre>`));
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );
}

function page(body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Calendar — Authorization</title>
  <style>
    body{font-family:-apple-system,system-ui,sans-serif;background:#0d1117;color:#e6edf3;
      max-width:620px;margin:0 auto;padding:32px 22px;line-height:1.5}
    h1{font-size:1.3rem}.ok{color:#3fb950;font-weight:600}.err{color:#f85149;font-weight:600}
    textarea{width:100%;height:90px;background:#161b22;color:#e6edf3;border:1px solid #283040;
      border-radius:10px;padding:10px;font-family:monospace;font-size:.8rem}
    code{background:#161b22;padding:2px 6px;border-radius:5px}
    a{color:#58a6ff}.note{color:#9aa7b5;font-size:.85rem}
    pre{background:#161b22;padding:12px;border-radius:8px;overflow:auto}
  </style></head><body><h1>Calendar Kiosk — Google Authorization</h1>${body}</body></html>`;
}
