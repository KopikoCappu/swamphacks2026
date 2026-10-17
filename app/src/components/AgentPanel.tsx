import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ask, type Mode, type Provider } from '@/lib/api';
import { AI_COLORS, toPageAnnotations } from '@/lib/annotations';
import { uid } from '@/lib/ink';
import { useStore } from '@/lib/store';
import type { ChatMessage, Chip } from '@/lib/types';

type Props = {
  pageId: string;
  chips: Chip[];
  setChips: (c: Chip[]) => void;
  onClose: () => void;
};

const QUICK: { mode: Mode; label: string; prompt: string }[] = [
  { mode: 'mistake', label: '🔍 Find my mistake', prompt: 'Can you find my mistake?' },
  { mode: 'explain', label: '💡 Explain', prompt: 'Explain this to me.' },
  { mode: 'transcribe', label: '✍️ To text', prompt: 'Convert my handwriting to text.' },
];

export function AgentPanel({ pageId, chips, setChips, onClose }: Props) {
  const chat = useStore((s) => s.pages[pageId]?.chat ?? []);
  const updatePage = useStore((s) => s.updatePage);
  const [provider, setProvider] = useState<Provider>('claude');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  async function send(mode: Mode, text: string) {
    if (busy || (!text.trim() && !chips.length)) return;
    const userMsg: ChatMessage = { id: uid(), role: 'user', text: text.trim(), chips };
    const history = [...chat, userMsg];
    updatePage(pageId, () => ({ chat: history }));
    setInput('');
    setChips([]);
    setBusy(true);
    try {
      const res = await ask(provider, mode, history);
      // Annotations are relative to the first image chip of this message.
      const anchor = chips.find((c) => c.image);
      const annotations = anchor ? toPageAnnotations(res.annotations, anchor.bounds) : [];
      updatePage(pageId, (p) => ({
        chat: [...p.chat, { id: uid(), role: 'assistant', text: res.reply, transcription: res.transcription }],
        annotations: [...p.annotations, ...annotations],
      }));
    } catch (e) {
      updatePage(pageId, (p) => ({
        chat: [...p.chat, { id: uid(), role: 'assistant', text: `⚠️ ${e instanceof Error ? e.message : e}`, error: true }],
      }));
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  /** Anchor point for pinning content: just right of the most recent selection on this page. */
  function lastAnchor() {
    const last = [...chat].reverse().find((m) => m.chips?.length)?.chips?.[0]?.bounds;
    return last ?? { x: 40, y: 40, w: 0, h: 0 };
  }

  function pinNote(text: string) {
    const b = lastAnchor();
    updatePage(
      pageId,
      (p) => ({
        annotations: [
          ...p.annotations,
          { id: uid(), kind: 'note', color: AI_COLORS.blue, text: text.slice(0, 280), rect: { x: b.x + b.w + 16, y: b.y, w: 260, h: 0 }, createdAt: Date.now() },
        ],
      }),
      true,
    );
  }

  function insertText(text: string) {
    const b = lastAnchor();
    updatePage(pageId, (p) => ({ texts: [...p.texts, { id: uid(), x: b.x, y: b.y + b.h + 12, width: Math.max(300, b.w), text }] }), true);
  }

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.segment}>
          {(['claude', 'gemini'] as Provider[]).map((p) => (
            <Pressable key={p} onPress={() => setProvider(p)} style={[styles.segBtn, provider === p && styles.segActive]}>
              <Text style={[styles.segText, provider === p && { color: 'white' }]}>{p === 'claude' ? 'Claude' : 'Gemini'}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={{ fontSize: 20 }}>✕</Text>
        </Pressable>
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 10 }}>
        {chat.length === 0 && <Text style={styles.hint}>Use ➰ Lasso to circle your work, then tap “Add to AI”. Or just ask a question.</Text>}
        {chat.map((m) => (
          <View key={m.id} style={[styles.msg, m.role === 'user' ? styles.userMsg : styles.aiMsg, m.error && styles.errMsg]}>
            {m.chips?.map((c) => <ChipPreview key={c.id} chip={c} />)}
            {!!m.text && <Text style={styles.msgText}>{m.text}</Text>}
            {!!m.transcription && <Text style={[styles.msgText, styles.mono]}>{m.transcription}</Text>}
            {m.role === 'assistant' && !m.error && (
              <View style={styles.msgActions}>
                <SmallBtn label="📌 Pin to page" onPress={() => pinNote(m.text)} />
                {!!m.transcription && <SmallBtn label="⬇️ Insert text" onPress={() => insertText(m.transcription!)} />}
              </View>
            )}
          </View>
        ))}
        {busy && <ActivityIndicator style={{ marginTop: 8 }} />}
      </ScrollView>

      {chips.length > 0 && (
        <ScrollView horizontal style={styles.tray} contentContainerStyle={{ gap: 8, padding: 8 }}>
          {chips.map((c) => (
            <View key={c.id}>
              <ChipPreview chip={c} small />
              <Pressable style={styles.chipX} onPress={() => setChips(chips.filter((x) => x.id !== c.id))}>
                <Text style={{ color: 'white', fontSize: 12 }}>✕</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.quick}>
        {QUICK.map((q) => (
          <SmallBtn key={q.mode} label={q.label} disabled={busy || !chips.length} onPress={() => send(q.mode, input || q.prompt)} />
        ))}
      </View>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={chips.length ? 'Ask about your selection…' : 'Ask anything…'}
          multiline
        />
        <Pressable style={[styles.send, busy && { opacity: 0.4 }]} onPress={() => send('ask', input)} disabled={busy}>
          <Text style={{ color: 'white', fontWeight: '600' }}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ChipPreview({ chip, small }: { chip: Chip; small?: boolean }) {
  const h = small ? 64 : 120;
  return (
    <View style={styles.chip}>
      {chip.image && (
        <Image
          source={{ uri: `data:image/png;base64,${chip.image.base64}` }}
          style={{ height: h, width: Math.min(small ? 140 : 280, (chip.image.width / chip.image.height) * h) }}
          resizeMode="contain"
        />
      )}
      {!!chip.text && <Text numberOfLines={small ? 2 : 6} style={styles.chipText}>{chip.text}</Text>}
    </View>
  );
}

function SmallBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.small, disabled && { opacity: 0.4 }]}>
      <Text style={{ fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { width: 400, backgroundColor: '#FBFAF7', borderLeftWidth: StyleSheet.hairlineWidth, borderColor: '#D9D4C7' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  segment: { flexDirection: 'row', backgroundColor: '#ECE8DE', borderRadius: 8, padding: 2 },
  segBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  segActive: { backgroundColor: '#6E56CF' },
  segText: { fontWeight: '600', color: '#1F2328' },
  hint: { color: '#6B665C', textAlign: 'center', marginTop: 24, paddingHorizontal: 16 },
  msg: { borderRadius: 12, padding: 10, gap: 8, maxWidth: '95%' },
  userMsg: { alignSelf: 'flex-end', backgroundColor: '#E9E3FF' },
  aiMsg: { alignSelf: 'flex-start', backgroundColor: 'white', borderWidth: StyleSheet.hairlineWidth, borderColor: '#D9D4C7' },
  errMsg: { backgroundColor: '#FFE5E5' },
  msgText: { fontSize: 15, lineHeight: 21, color: '#1F2328' },
  mono: { fontFamily: 'monospace', fontSize: 13, backgroundColor: '#F3F1EC', padding: 6, borderRadius: 6 },
  msgActions: { flexDirection: 'row', gap: 6 },
  tray: { maxHeight: 96, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#D9D4C7', flexGrow: 0 },
  chip: { backgroundColor: 'white', borderRadius: 8, borderWidth: 1, borderColor: '#D9D4C7', overflow: 'hidden', alignSelf: 'flex-start' },
  chipText: { fontSize: 12, padding: 6, maxWidth: 200 },
  chipX: { position: 'absolute', top: -4, right: -4, backgroundColor: '#1F2328', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  quick: { flexDirection: 'row', gap: 6, paddingHorizontal: 8, paddingTop: 8, flexWrap: 'wrap' },
  small: { backgroundColor: '#ECE8DE', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  inputRow: { flexDirection: 'row', gap: 8, padding: 8, alignItems: 'flex-end' },
  input: { flex: 1, minHeight: 40, maxHeight: 120, backgroundColor: 'white', borderRadius: 10, borderWidth: 1, borderColor: '#D9D4C7', paddingHorizontal: 10, paddingVertical: 8, fontSize: 15 },
  send: { backgroundColor: '#6E56CF', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11 },
});
