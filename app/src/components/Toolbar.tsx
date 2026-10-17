import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SIZE_OPTIONS, useStore } from '@/lib/store';
import type { Paper, Tool } from '@/lib/types';

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'pen', label: '✏️ Pen' },
  { id: 'highlighter', label: '🖍️ Mark' },
  { id: 'eraser', label: '🧽 Erase' },
  { id: 'lasso', label: '➰ Lasso' },
  { id: 'text', label: '🔤 Text' },
];
const PEN_COLORS = ['#1F2328', '#3E63DD', '#E5484D', '#30A46C', '#8E4EC6', '#F76B15'];
const HIGHLIGHTER_COLORS = ['#FFD60A', '#7CE38B', '#7DD3FC', '#F9A8D4'];
const PAPERS: { id: Paper; label: string }[] = [
  { id: 'lined', label: '📓 Lined' },
  { id: 'grid', label: '▦ Grid' },
  { id: 'dots', label: '⠿ Dots' },
  { id: 'blank', label: '⬜ Blank' },
];

type Props = {
  pageId: string;
  agentOpen: boolean;
  onToggleAgent: () => void;
  onAddImage: (source: 'camera' | 'library') => void;
};

export function Toolbar({ pageId, agentOpen, onToggleAgent, onAddImage }: Props) {
  const s = useStore();
  const page = s.pages[pageId];
  const canUndo = (s.undo[pageId]?.length ?? 0) > 0;
  const canRedo = (s.redo[pageId]?.length ?? 0) > 0;
  const paper = page?.paper ?? 'blank';
  const [confirmClear, setConfirmClear] = useState(false);

  // Two-tap clear: the second tap must come within 3s. (No modal dialogs.)
  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 3000);
    return () => clearTimeout(t);
  }, [confirmClear]);

  const sizedTool = s.tool === 'pen' || s.tool === 'highlighter' || s.tool === 'eraser' ? s.tool : s.tool === 'text' ? null : 'pen';
  const colors = s.tool === 'highlighter' ? HIGHLIGHTER_COLORS : PEN_COLORS;
  const activeColor = s.tool === 'highlighter' ? s.highlighterColor : s.color;

  function cyclePaper() {
    const i = PAPERS.findIndex((p) => p.id === paper);
    const next = PAPERS[(i + 1) % PAPERS.length].id;
    s.updatePage(pageId, () => ({ paper: next }));
  }

  function clearPage() {
    if (!confirmClear) return setConfirmClear(true);
    setConfirmClear(false);
    s.updatePage(pageId, () => ({ strokes: [], texts: [], images: [], annotations: [] }), true); // undoable
  }

  return (
    <View style={styles.bar}>
      <View style={styles.group}>
        <Btn label="↩️" onPress={() => s.undoPage(pageId)} disabled={!canUndo} />
        <Btn label="↪️" onPress={() => s.redoPage(pageId)} disabled={!canRedo} />
      </View>

      <View style={styles.group}>
        {TOOLS.map((t) => (
          <Btn key={t.id} label={t.label} active={s.tool === t.id} onPress={() => s.setTool(t.id)} />
        ))}
      </View>

      {s.tool !== 'eraser' && s.tool !== 'lasso' && (
        <View style={styles.group}>
          {colors.map((c) => (
            <Pressable
              key={c}
              onPress={() => (s.tool === 'highlighter' ? s.setHighlighterColor(c) : s.setColor(c))}
              style={[styles.swatch, { backgroundColor: c }, activeColor === c && styles.swatchActive]}
            />
          ))}
        </View>
      )}

      {sizedTool && (
        <View style={styles.group}>
          {SIZE_OPTIONS[sizedTool].map((size) => {
            // Preview dot: eraser size is a radius, the others are widths.
            const d = Math.min(26, Math.max(4, sizedTool === 'eraser' ? size * 0.5 : sizedTool === 'highlighter' ? size * 0.5 : size * 1.6));
            const dotColor = sizedTool === 'eraser' ? '#B5AFA2' : sizedTool === 'highlighter' ? s.highlighterColor : s.color;
            return (
              <Pressable key={size} onPress={() => s.setSize(sizedTool, size)} style={[styles.sizeBtn, s.sizes[sizedTool] === size && styles.btnActive]}>
                <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: dotColor }} />
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.group}>
        <Btn label={PAPERS.find((p) => p.id === paper)!.label} onPress={cyclePaper} />
        <Btn label="📷" onPress={() => onAddImage('camera')} />
        <Btn label="🖼️" onPress={() => onAddImage('library')} />
        <Btn label={s.penOnly ? '🖊️ Pen only' : '👆 Touch draw'} active={s.penOnly} onPress={() => s.setPenOnly(!s.penOnly)} />
        {(page?.annotations.length ?? 0) > 0 && <Btn label="🧹 AI ink" onPress={() => s.updatePage(pageId, () => ({ annotations: [] }), true)} />}
        <Btn label={confirmClear ? 'Tap again to clear' : '🗑️'} danger={confirmClear} onPress={clearPage} />
      </View>

      <Btn label="✨ Ask AI" active={agentOpen} onPress={onToggleAgent} accent />
    </View>
  );
}

type BtnProps = { label: string; active?: boolean; onPress: () => void; accent?: boolean; disabled?: boolean; danger?: boolean };

function Btn({ label, active, onPress, accent, disabled, danger }: BtnProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.btn, active && styles.btnActive, accent && styles.accent, accent && active && styles.accentActive, danger && styles.danger, disabled && { opacity: 0.35 }]}
    >
      <Text style={[styles.btnText, (accent || danger) && { color: 'white' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
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
  danger: { backgroundColor: '#E5484D' },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: '#1F2328', transform: [{ scale: 1.15 }] },
  sizeBtn: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
