import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from '@/lib/store';
import type { Tool } from '@/lib/types';

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'pen', label: '✏️ Pen' },
  { id: 'highlighter', label: '🖍️ Mark' },
  { id: 'eraser', label: '🧽 Erase' },
  { id: 'lasso', label: '➰ Lasso' },
  { id: 'text', label: '🔤 Text' },
];
const COLORS = ['#1F2328', '#3E63DD', '#E5484D', '#30A46C'];
const SIZES = [2.5, 4, 7];

type Props = {
  pageId: string;
  agentOpen: boolean;
  onToggleAgent: () => void;
  onAddImage: (source: 'camera' | 'library') => void;
};

export function Toolbar({ pageId, agentOpen, onToggleAgent, onAddImage }: Props) {
  const { tool, color, penSize, penOnly, setTool, setColor, setPenSize, setPenOnly, undoPage, updatePage } = useStore();
  const hasAiInk = useStore((s) => (s.pages[pageId]?.annotations.length ?? 0) > 0);

  return (
    <View style={styles.bar}>
      <View style={styles.group}>
        {TOOLS.map((t) => (
          <Btn key={t.id} label={t.label} active={tool === t.id} onPress={() => setTool(t.id)} />
        ))}
      </View>

      <View style={styles.group}>
        {COLORS.map((c) => (
          <Pressable key={c} onPress={() => setColor(c)} style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]} />
        ))}
        {SIZES.map((s) => (
          <Pressable key={s} onPress={() => setPenSize(s)} style={[styles.sizeBtn, penSize === s && styles.btnActive]}>
            <View style={{ width: s * 2.2, height: s * 2.2, borderRadius: s * 2, backgroundColor: '#1F2328' }} />
          </Pressable>
        ))}
      </View>

      <View style={styles.group}>
        <Btn label="↩️" onPress={() => undoPage(pageId)} />
        <Btn label="📷" onPress={() => onAddImage('camera')} />
        <Btn label="🖼️" onPress={() => onAddImage('library')} />
        <Btn label={penOnly ? '🖊️ Pen only' : '👆 Touch draw'} active={penOnly} onPress={() => setPenOnly(!penOnly)} />
        {hasAiInk && <Btn label="🧹 AI ink" onPress={() => updatePage(pageId, () => ({ annotations: [] }), true)} />}
      </View>

      <Btn label="✨ Ask AI" active={agentOpen} onPress={onToggleAgent} accent />
    </View>
  );
}

function Btn({ label, active, onPress, accent }: { label: string; active?: boolean; onPress: () => void; accent?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.btn, active && styles.btnActive, accent && styles.accent, accent && active && styles.accentActive]}>
      <Text style={[styles.btnText, accent && { color: 'white' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F6F4EF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#D9D4C7',
    flexWrap: 'wrap',
  },
  group: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  btnActive: { backgroundColor: '#E4DFD3' },
  btnText: { fontSize: 15, color: '#1F2328' },
  accent: { backgroundColor: '#6E56CF', marginLeft: 'auto' },
  accentActive: { backgroundColor: '#5B45B5' },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: '#F76B15' },
  sizeBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
