import 'dotenv/config';
import cors from 'cors';
import express from 'express';
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

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`InkBuddy server on http://localhost:${port}`);
  console.log(`Expose to the tablet with:  ngrok http ${port}`);
});
