import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import { MODE_INSTRUCTIONS, SYSTEM_PROMPT } from './prompts.js';
import { RESPONSE_JSON_SCHEMA, type AskRequest, type AskResponse } from './schema.js';

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5-5';
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-flash-latest';

let anthropic: Anthropic | null = null;
let gemini: GoogleGenAI | null = null;

function withModeInstruction(req: AskRequest) {
  // Append the mode instruction to the latest user turn so it applies to this request only.
  const messages = req.messages.map((m) => ({ ...m }));
  const last = messages[messages.length - 1];
  if (last?.role === 'user') {
    last.text = `${last.text}\n\n[Mode instruction] ${MODE_INSTRUCTIONS[req.mode]}`.trim();
  }
  return messages;
}

export async function askClaude(req: AskRequest): Promise<AskResponse> {
  anthropic ??= new Anthropic(); // reads ANTHROPIC_API_KEY
  const messages = withModeInstruction(req);

  // Structured outputs: the API guarantees the reply matches RESPONSE_JSON_SCHEMA.
  // (Forced tool_choice is not supported on current models.)
  const res = await anthropic.beta.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: RESPONSE_JSON_SCHEMA as unknown as Record<string, unknown> },
    },
    // If a safety classifier declines, the server retries on a suitable fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    messages: messages.map((m) => ({
      role: m.role,
      content: [
        ...(m.images ?? []).map((img) => ({
          type: 'image' as const,
          source: { type: 'base64' as const, media_type: 'image/png' as const, data: img.base64 },
        })),
        { type: 'text' as const, text: m.text || '(see image)' },
      ],
    })),
  });

  if (res.stop_reason === 'refusal') {
    return { reply: "Sorry — I can't help with that one.", annotations: [] };
  }
  const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  try {
    return normalize(JSON.parse(text));
  } catch {
    return { reply: text || '(no response)', annotations: [] };
  }
}

export async function askGemini(req: AskRequest): Promise<AskResponse> {
  gemini ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const messages = withModeInstruction(req);

  const res = await gemini.models.generateContent({
    model: GEMINI_MODEL,
    contents: messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [
        ...(m.images ?? []).map((img) => ({ inlineData: { mimeType: 'image/png', data: img.base64 } })),
        { text: m.text || '(see image)' },
      ],
    })),
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseJsonSchema: RESPONSE_JSON_SCHEMA,
    },
  });

  try {
    return normalize(JSON.parse(res.text ?? '{}'));
  } catch {
    return { reply: res.text ?? '(no response)', annotations: [] };
  }
}

// Defensive cleanup: models occasionally return out-of-range or malformed boxes.
function normalize(raw: unknown): AskResponse {
  const r = (raw ?? {}) as Partial<AskResponse>;
  const clamp = (n: number) => Math.max(0, Math.min(1000, Math.round(Number(n) || 0)));
  const annotations = (Array.isArray(r.annotations) ? r.annotations : [])
    .filter((a) => a && Array.isArray(a.box) && a.box.length === 4)
    .map((a) => {
      const [y0, x0, y1, x1] = a.box.map(clamp);
      return {
        ...a,
        box: [Math.min(y0, y1), Math.min(x0, x1), Math.max(y0, y1), Math.max(x0, x1)] as [number, number, number, number],
      };
    });
  return { reply: String(r.reply ?? ''), annotations, transcription: r.transcription };
}
