import type { ModelAnnotation } from './annotations';
import type { ChatMessage } from './types';

// Set EXPO_PUBLIC_API_URL in app/.env to your ngrok URL (e.g. https://abc123.ngrok-free.app)
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

export type Provider = 'claude' | 'gemini';
export type Mode = 'ask' | 'mistake' | 'explain' | 'transcribe';

export type AskResponse = {
  reply: string;
  annotations: ModelAnnotation[];
  transcription?: string;
};

export async function ask(provider: Provider, mode: Mode, history: ChatMessage[]): Promise<AskResponse> {
  const messages = history
    .filter((m) => !m.error)
    .map((m) => ({
      role: m.role,
      text: [m.text, ...(m.chips ?? []).map((c) => (c.text ? `Typed text from my notes:\n${c.text}` : ''))]
        .filter(Boolean)
        .join('\n\n'),
      images: (m.chips ?? []).flatMap((c) => (c.image ? [c.image] : [])),
    }));

  const res = await fetch(`${API_URL}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
    body: JSON.stringify({ provider, mode, messages }),
  });
  if (!res.ok) throw new Error(`Server ${res.status}: ${await res.text()}`);
  return res.json();
}
