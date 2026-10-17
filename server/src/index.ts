import 'dotenv/config';
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
