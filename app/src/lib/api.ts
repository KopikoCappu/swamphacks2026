import type { ModelAnnotation } from './annotations';
import type { ChatMessage } from './types';

import { Platform } from 'react-native';

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
