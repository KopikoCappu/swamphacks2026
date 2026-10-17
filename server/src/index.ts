import './env.js';
import cors from 'cors';
import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { askClaude, askGemini } from './providers.js';
import type { AskRequest } from './schema.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' })); // base64 page renders are big

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    claude: Boolean(process.env.ANTHROPIC_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
  });
});

app.post('/ask', async (req, res) => {
  const body = req.body as AskRequest;
  if (!body?.messages?.length) {
    res.status(400).json({ error: 'messages required' });
    return;
  }
  const started = Date.now();
  try {
    const result = body.provider === 'gemini' ? await askGemini(body) : await askClaude(body);
    console.log(`[ask] ${body.provider}/${body.mode} ${Date.now() - started}ms, ${result.annotations.length} annotations`);
    res.json(result);
  } catch (err) {
    console.error('[ask] failed', err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Create an account that is confirmed up front (no confirmation email — Supabase's free tier only sends a
// few per hour). Uses the service-role key, which never leaves the server. The app then signs in normally.
app.post('/auth/signup', async (req, res) => {
  const { email, password } = (req.body ?? {}) as { email?: unknown; password?: unknown };
  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
    res.status(400).json({ error: 'Enter a valid email address.' });
    return;
  }
  if (typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    res.status(500).json({ error: 'Accounts are not configured on the server.' });
    return;
  }
  const r = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password, email_confirm: true }),
  });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { msg?: string; message?: string; error_code?: string };
    const exists = r.status === 422 || j.error_code === 'email_exists';
    res.status(exists ? 409 : 400).json({ error: exists ? 'An account with this email already exists — sign in instead.' : (j.msg ?? j.message ?? 'Sign-up failed.') });
    return;
  }
  res.json({ ok: true });
});

// Serve the built web app (npm run build:web) so ONE ngrok URL gives the tablet both app + API.
const webDist = fileURLToPath(new URL('../../app/dist', import.meta.url));
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  // SPA fallback for client routes like /note/abc
  app.use((req, res, next) => {
    if (req.method !== 'GET' || !req.accepts('html')) return next();
    res.sendFile('index.html', { root: webDist });
  });
} else {
  app.get('/', (_req, res) => {
    res.send('InkBuddy API is running. Run `npm run build:web` to serve the app here too. Status: <a href="/health">/health</a>');
  });
}

// On Vercel the exported app is served as a function; locally we listen on a port.
if (!process.env.VERCEL) {
  const port = Number(process.env.PORT ?? 8787);
  app.listen(port, () => {
    console.log(`InkBuddy server on http://localhost:${port}`);
    console.log(`Expose to the tablet with:  ngrok http ${port}`);
  });
}

export default app;
