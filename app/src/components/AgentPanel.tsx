import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRef, useState, type ComponentProps, type ComponentRef } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { IconBtn } from '@/components/Toolbar';
import { ask, type Mode, type Provider } from '@/lib/api';
import { AI_COLORS, toPageAnnotations } from '@/lib/annotations';
import { uid } from '@/lib/ink';
import { useStore } from '@/lib/store';
import { C, R } from '@/lib/theme';
import type { ChatMessage, Chip } from '@/lib/types';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type Props = {
  pageId: string;
  chips: Chip[];
  setChips: (c: Chip[]) => void;
  onClose: () => void;
};

const QUICK: { mode: Mode; icon: IconName; label: string; prompt: string }[] = [
  { mode: 'mistake', icon: 'magnify', label: 'Find mistake', prompt: 'Can you find my mistake?' },
  { mode: 'explain', icon: 'lightbulb-outline', label: 'Explain', prompt: 'Explain this to me.' },
  { mode: 'transcribe', icon: 'text-recognition', label: 'To text', prompt: 'Convert my handwriting to text.' },
];

export function AgentPanel({ pageId, chips, setChips, onClose }: Props) {
  const chat = useStore((s) => s.pages[pageId]?.chat ?? []);
  const updatePage = useStore((s) => s.updatePage);
  // Gemini is wired up on the server but hidden in the UI for now.
  const provider: Provider = 'claude';
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
        chat: [...p.chat, { id: uid(), role: 'assistant', text: e instanceof Error ? e.message : String(e), error: true }],
      }));
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  /** Anchor point for pinning content: just right of the most recent selection on this page. */
  function lastAnchor() {
    const last = [...chat].reverse().find((m) => m.chips?.length)?.chips?.[0]?.bounds;
    return last ?? { x: 80, y: 80, w: 0, h: 0 };
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

  const canSend = !busy && (!!input.trim() || chips.length > 0);

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <MaterialCommunityIcons name="creation" size={18} color={C.text} />
          <Text style={styles.titleText}>Claude</Text>
        </View>
        <IconBtn icon="close" onPress={onClose} />
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14 }}>
        {chat.length === 0 && (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="lasso" size={28} color={C.faint} />
            <Text style={styles.emptyText}>Lasso part of your page, then tap “Ask about this”.</Text>
          </View>
        )}
        {chat.map((m) =>
          m.role === 'user' ? (
            <View key={m.id} style={styles.userMsg}>
              {m.chips?.map((c) => <ChipPreview key={c.id} chip={c} />)}
              {!!m.text && <Text style={styles.msgText}>{m.text}</Text>}
            </View>
          ) : (
            <View key={m.id} style={styles.aiMsg}>
              <Text style={[styles.msgText, m.error && { color: C.danger }]}>{m.text}</Text>
              {!!m.transcription && <Text style={styles.mono}>{m.transcription}</Text>}
              {!m.error && (
                <View style={styles.msgActions}>
                  <Action icon="pin-outline" label="Pin to page" onPress={() => pinNote(m.text)} />
                  {!!m.transcription && <Action icon="tray-arrow-down" label="Insert text" onPress={() => insertText(m.transcription!)} />}
                </View>
              )}
            </View>
          ),
        )}
        {busy && <ActivityIndicator color={C.muted} style={{ alignSelf: 'flex-start' }} />}
      </ScrollView>

      <View style={styles.composer}>
        {chips.length > 0 && (
          <ScrollView horizontal contentContainerStyle={{ gap: 8, paddingBottom: 10 }} style={{ flexGrow: 0 }}>
            {chips.map((c) => (
              <View key={c.id}>
                <ChipPreview chip={c} small />
                <Pressable style={styles.chipX} onPress={() => setChips(chips.filter((x) => x.id !== c.id))} hitSlop={6}>
                  <MaterialCommunityIcons name="close" size={12} color={C.onPrimary} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}

        {chips.length > 0 && (
          <View style={styles.quick}>
            {QUICK.map((q) => (
              <Pressable key={q.mode} disabled={busy} onPress={() => send(q.mode, input || q.prompt)} style={({ pressed }) => [styles.quickBtn, pressed && { backgroundColor: C.selected }, busy && { opacity: 0.4 }]}>
                <MaterialCommunityIcons name={q.icon} size={15} color={C.icon} />
                <Text style={styles.quickText}>{q.label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={chips.length ? 'Ask about your selection' : 'Ask anything'}
            placeholderTextColor={C.muted}
            multiline
          />
          <Pressable style={[styles.send, !canSend && { opacity: 0.25 }]} onPress={() => send('ask', input)} disabled={!canSend}>
            <MaterialCommunityIcons name="arrow-up" size={18} color={C.onPrimary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function ChipPreview({ chip, small }: { chip: Chip; small?: boolean }) {
  const h = small ? 56 : 110;
  return (
    <View style={styles.chip}>
      {chip.image && (
        <Image
          source={{ uri: `data:image/png;base64,${chip.image.base64}` }}
          style={{ height: h, width: Math.min(small ? 120 : 260, (chip.image.width / chip.image.height) * h) }}
          resizeMode="contain"
        />
      )}
      {!!chip.text && (
        <Text numberOfLines={small ? 2 : 6} style={styles.chipText}>
          {chip.text}
        </Text>
      )}
    </View>
  );
}

function Action({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => [styles.action, pressed && { opacity: 0.5 }]}>
      <MaterialCommunityIcons name={icon} size={14} color={C.muted} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { width: 380, backgroundColor: C.surface, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: 52 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  titleText: { fontSize: 15, fontWeight: '600', color: C.text },
  empty: { alignItems: 'center', gap: 10, marginTop: 48, paddingHorizontal: 32 },
  emptyText: { color: C.muted, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  userMsg: { alignSelf: 'flex-end', maxWidth: '88%', backgroundColor: C.bg, borderRadius: R.lg, padding: 10, gap: 8 },
  aiMsg: { alignSelf: 'stretch', gap: 8 },
  msgText: { fontSize: 15, lineHeight: 22, color: C.text },
  mono: { fontFamily: 'monospace', fontSize: 13, color: C.text, backgroundColor: C.bg, padding: 10, borderRadius: R.sm },
  msgActions: { flexDirection: 'row', gap: 16 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 13, color: C.muted },
  chip: { backgroundColor: C.paper, borderRadius: R.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, overflow: 'hidden', alignSelf: 'flex-start' },
  chipText: { fontSize: 12, padding: 6, maxWidth: 200, color: C.text },
  chipX: { position: 'absolute', top: -6, right: -6, backgroundColor: C.text, borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  composer: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  quick: { flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  quickBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: C.faint, paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.pill },
  quickText: { fontSize: 13, color: C.text },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', backgroundColor: C.bg, borderRadius: R.lg, padding: 6, paddingLeft: 12 },
  input: { flex: 1, minHeight: 32, maxHeight: 120, paddingVertical: 6, fontSize: 15, color: C.text },
  send: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
});
