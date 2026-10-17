import { Platform } from 'react-native';
import type { ModelAnnotation } from './annotations';
import type { RenderedImage } from './snapshot';
import type { ChatMessage, Rect } from './types';

// Where the server lives:
// - Expo Go / native: set EXPO_PUBLIC_API_URL in app/.env to your ngrok URL
// - Web served BY the server (npm run build:web): same origin, works through one ngrok URL
// - Web dev server on :8081: the local server
function resolveApiUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.port === '8081' ? 'http://localhost:8787' : window.location.origin;
  }
  return process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';
}
export const API_URL = resolveApiUrl();

export type Provider = 'claude' | 'gemini';
export type Mode = 'ask' | 'mistake' | 'explain' | 'transcribe';

export type AskResponse = {
  reply: string;
  annotations: ModelAnnotation[];
  transcription?: string;
};

type WireImage = RenderedImage & { label?: string; mime?: string };
type WireMessage = { role: 'user' | 'assistant'; text: string; images?: WireImage[] };

/** Extra context attached to the newest user message only (not stored in chat history). */
export type PageContext = { view: RenderedImage | null; viewRect: Rect; text: string };

function chipText(m: ChatMessage) {
  return [
    m.text,
    ...(m.chips ?? []).map((c) => (c.text ? `Typed text / equations from my ${c.label ?? 'selection'} (exact text, not an image):\n${c.text}` : '')),
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** Every image a chip contributes, each with a label and the page-space region it shows. */
function chipImages(m: ChatMessage, n: { k: number }): { img: WireImage; region: Rect }[] {
  return (m.chips ?? []).flatMap((c) => {
    const name = c.label ?? `selection ${++n.k}`;
    const out: { img: WireImage; region: Rect }[] = [];
    if (c.image) out.push({ img: { ...c.image, label: name }, region: c.bounds }); // legacy chips
    if (c.ink) out.push({ img: { ...c.ink, label: `${name}: handwriting/ink only (no background)` }, region: c.bounds });
    (c.images ?? []).forEach((im, i) => out.push({ img: { ...im, label: `${name}: image ${i + 1} (original)` }, region: im.region }));
    if (c.combined) out.push({ img: { ...c.combined, label: `${name}: ink and image together, as laid out on the page` }, region: c.bounds });
    return out;
  });
}

/**
 * Build the request. Returns the page-space region each image of the newest message shows, in order,
 * so annotation boxes (which reference images by index) can be mapped back onto the page.
 */
export function buildRequest(history: ChatMessage[], ctx: PageContext): { messages: WireMessage[]; regions: Rect[] } {
  let regions: Rect[] = [];
  const messages = history
    .filter((m) => !m.error)
    .map((m, i, all): WireMessage => {
      const parts = chipImages(m, { k: 0 });
      // Only the newest message carries images (keeps requests under the host's 4.5 MB body limit);
      // earlier turns keep their text so the conversation still makes sense.
      if (i !== all.length - 1) {
        const note = parts.length ? `\n\n(${parts.length} image${parts.length > 1 ? 's' : ''} I attached earlier, omitted)` : '';
        return { role: m.role, text: (chipText(m) || '(see images)') + note };
      }

      regions = parts.map((p) => p.region);
      const images = parts.map((p) => p.img);
      if (ctx.view) {
        images.push({ ...ctx.view, label: 'page view (what is on my screen right now)' });
        regions.push(ctx.viewRect);
      }
      return { role: m.role, text: [chipText(m) || '(see images)', ctx.text].filter(Boolean).join('\n\n'), images };
    });
  return { messages, regions };
}

export async function ask(provider: Provider, mode: Mode, messages: WireMessage[]): Promise<AskResponse> {
  const res = await fetch(`${API_URL}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
    body: JSON.stringify({ provider, mode, messages }),
  });
  if (!res.ok) throw new Error(`Server ${res.status}: ${await res.text()}`);
  return res.json();
}
