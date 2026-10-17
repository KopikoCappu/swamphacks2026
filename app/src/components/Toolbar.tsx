import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { PAGE_COLORS } from '@/components/PaperBackground';
import { SIZE_OPTIONS, useStore } from '@/lib/store';
import { C, R, shadow } from '@/lib/theme';
import type { Paper, ShapeKind, Tool } from '@/lib/types';
import { pageAtCenter } from '@/lib/pages';
import { zoomAt, type Viewport } from '@/lib/viewport';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
export type Menu = 'color' | 'more' | null;

const TOOLS: { id: Tool; icon: IconName }[] = [
  { id: 'pen', icon: 'pencil-outline' },
  { id: 'highlighter', icon: 'marker' },
  { id: 'shape', icon: 'shape-outline' },
  { id: 'eraser', icon: 'eraser' },
  { id: 'lasso', icon: 'lasso' },
  { id: 'text', icon: 'format-text' },
];
const PEN_COLORS = ['#1C1C1E', '#636366', '#FFFFFF', '#2F6FEB', '#E5484D', '#30A46C', '#8E4EC6', '#F76B15', '#0E9F9F'];
const SHAPES: { id: ShapeKind; icon: IconName }[] = [
  { id: 'line', icon: 'vector-line' },
  { id: 'arrow', icon: 'arrow-top-right' },
  { id: 'rect', icon: 'rectangle-outline' },
  { id: 'ellipse', icon: 'ellipse-outline' },
];
const HIGHLIGHTER_COLORS = ['#FFD60A', '#7CE38B', '#7DD3FC', '#F9A8D4', '#FDBA74'];
const PAPERS: { id: Paper; icon: IconName; label: string }[] = [
  { id: 'lined', icon: 'notebook-outline', label: 'Lined' },
  { id: 'grid', icon: 'grid', label: 'Grid' },
  { id: 'dots', icon: 'dots-grid', label: 'Dots' },
  { id: 'blank', icon: 'checkbox-blank-outline', label: 'Blank' },
];

// ---------------------------------------------------------------- top bar

type TopBarProps = {
  pageId: string;
  agentOpen: boolean;
  onToggleAgent: () => void;
  menu: Menu;
  setMenu: (m: Menu) => void;
};

export function TopBar({ pageId, agentOpen, onToggleAgent, menu, setMenu }: TopBarProps) {
  const title = useStore((s) => s.pages[pageId]?.title ?? '');
  const tool = useStore((s) => s.tool);
  const color = useStore((s) => (s.tool === 'highlighter' ? s.highlighterColor : s.color));
  const { setTool, updatePage } = useStore.getState();

  return (
    <View style={styles.topBar}>
      <View style={styles.left}>
        <IconBtn icon="chevron-left" onPress={() => router.back()} />
        <TextInput
          value={title}
          onChangeText={(t) => updatePage(pageId, () => ({ title: t }))}
          placeholder="Untitled"
          placeholderTextColor={C.muted}
          style={styles.title}
        />
      </View>

      <View style={styles.right}>
        {TOOLS.map((t) => (
          <IconBtn key={t.id} icon={t.icon} active={tool === t.id} onPress={() => setTool(t.id)} />
        ))}
        <Pressable onPress={() => setMenu(menu === 'color' ? null : 'color')} style={styles.colorBtn} hitSlop={6}>
          <View style={[styles.colorDot, { backgroundColor: color }]} />
        </Pressable>
        <View style={styles.divider} />
        <IconBtn icon="dots-horizontal" active={menu === 'more'} onPress={() => setMenu(menu === 'more' ? null : 'more')} />
        <Pressable onPress={onToggleAgent} style={[styles.askBtn, agentOpen && { opacity: 0.85 }]}>
          <MaterialCommunityIcons name="creation" size={16} color={C.onPrimary} />
          <Text style={styles.askText}>Ask</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- left rail (size + undo/redo)

export function SideControls({ pageId }: { pageId: string }) {
  const tool = useStore((s) => s.tool);
  const sizes = useStore((s) => s.sizes);
  const color = useStore((s) => (s.tool === 'highlighter' ? s.highlighterColor : s.color));
  const canUndo = useStore((s) => (s.undo[pageId]?.length ?? 0) > 0);
  const canRedo = useStore((s) => (s.redo[pageId]?.length ?? 0) > 0);
  const shapeKind = useStore((s) => s.shapeKind);
  const { setSize, undoPage, redoPage, setShapeKind } = useStore.getState();
  // Shapes share the pen's width.
  const sized = tool === 'pen' || tool === 'shape' ? 'pen' : tool === 'highlighter' || tool === 'eraser' ? tool : null;

  return (
    <View style={styles.rail} pointerEvents="box-none">
      {tool === 'shape' && (
        <View style={[styles.railCard, shadow]}>
          {SHAPES.map((sh) => (
            <IconBtn key={sh.id} icon={sh.icon} active={shapeKind === sh.id} onPress={() => setShapeKind(sh.id)} size={20} />
          ))}
        </View>
      )}
      {sized && (
        <View style={[styles.railCard, shadow]}>
          {[...SIZE_OPTIONS[sized]].reverse().map((size) => {
            const d = Math.min(22, Math.max(4, sized === 'pen' ? size * 1.5 : size * 0.45));
            const active = sizes[sized] === size;
            return (
              <Pressable key={size} onPress={() => setSize(sized, size)} style={styles.sizeBtn}>
                <View
                  style={[
                    { width: d, height: d, borderRadius: d / 2 },
                    sized === 'eraser'
                      ? { borderWidth: 1.5, borderColor: active ? C.text : C.faint }
                      : { backgroundColor: color, opacity: active ? 1 : 0.35 },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      )}
      <View style={[styles.railCard, shadow]}>
        <IconBtn icon="undo" onPress={() => undoPage(pageId)} disabled={!canUndo} />
        <IconBtn icon="redo" onPress={() => redoPage(pageId)} disabled={!canRedo} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- popovers

export function ColorMenu() {
  const tool = useStore((s) => s.tool);
  const color = useStore((s) => s.color);
  const highlighterColor = useStore((s) => s.highlighterColor);
  const { setColor, setHighlighterColor } = useStore.getState();
  const hl = tool === 'highlighter';
  const colors = hl ? HIGHLIGHTER_COLORS : PEN_COLORS;
  const current = hl ? highlighterColor : color;

  return (
    <View style={[styles.popover, shadow, { right: 150, width: 228 }]}>
      <Text style={styles.popLabel}>{hl ? 'Highlighter' : 'Ink'}</Text>
      <View style={styles.swatches}>
        {colors.map((c) => (
          <Pressable key={c} onPress={() => (hl ? setHighlighterColor(c) : setColor(c))} style={[styles.swatchRing, current === c && { borderColor: C.text }]}>
            <View style={[styles.swatch, { backgroundColor: c }]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function MoreMenu({ pageId, onAddImage }: { pageId: string; onAddImage: (s: 'camera' | 'library') => void }) {
  const paper = useStore((s) => s.pages[pageId]?.paper ?? 'blank');
  const bg = useStore((s) => s.pages[pageId]?.bg ?? '#FFFFFF');
  const penOnly = useStore((s) => s.penOnly);
  const hasAiInk = useStore((s) => (s.pages[pageId]?.annotations.length ?? 0) > 0);
  const lockedCount = useStore((s) => s.pages[pageId]?.images.filter((i) => i.locked).length ?? 0);
  const { updatePage, setPenOnly } = useStore.getState();
  const [confirmClear, setConfirmClear] = useState(false);

  // Two-tap clear: the second tap must come within 3s. (No modal dialogs.)
  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 3000);
    return () => clearTimeout(t);
  }, [confirmClear]);

  function clearPage() {
    if (!confirmClear) return setConfirmClear(true);
    setConfirmClear(false);
    updatePage(pageId, () => ({ strokes: [], texts: [], images: [], annotations: [] }), true); // undoable
  }

  return (
    <View style={[styles.popover, shadow, { right: 76, width: 300 }]}>
      <Text style={styles.popLabel}>Paper</Text>
      <View style={styles.paperRow}>
        {PAPERS.map((p) => (
          <Pressable key={p.id} onPress={() => updatePage(pageId, () => ({ paper: p.id }))} style={[styles.paperBtn, paper === p.id && styles.paperActive]}>
            <MaterialCommunityIcons name={p.icon} size={20} color={paper === p.id ? C.text : C.muted} />
            <Text style={[styles.paperText, paper === p.id && { color: C.text }]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.popLabel, { marginTop: 12 }]}>Page color</Text>
      <View style={styles.paperRow}>
        {PAGE_COLORS.map((c) => (
          <Pressable key={c.id} onPress={() => updatePage(pageId, () => ({ bg: c.id }))} style={[styles.paperBtn, bg === c.id && styles.paperActive]}>
            <View style={[styles.pageSwatch, { backgroundColor: c.id }]} />
            <Text style={[styles.paperText, bg === c.id && { color: C.text }]}>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.sep} />
      <Row icon="image-outline" label="Insert photo" onPress={() => onAddImage('library')} />
      <Row icon="camera-outline" label="Take photo" onPress={() => onAddImage('camera')} />
      <Row icon="draw-pen" label="Pen only (palm rejection)" onPress={() => setPenOnly(!penOnly)} right={<Toggle on={penOnly} />} />

      {lockedCount > 0 && (
        <Row
          icon="lock-open-variant-outline"
          label={`Unlock background image${lockedCount > 1 ? 's' : ''} (${lockedCount})`}
          onPress={() => updatePage(pageId, (p) => ({ images: p.images.map((i) => ({ ...i, locked: false })) }), true)}
        />
      )}

      <View style={styles.sep} />
      {hasAiInk && <Row icon="broom" label="Clear AI ink" onPress={() => updatePage(pageId, () => ({ annotations: [] }), true)} />}
      <Row icon="delete-outline" label={confirmClear ? 'Tap again to clear page' : 'Clear page'} danger onPress={clearPage} />
    </View>
  );
}

// ---------------------------------------------------------------- zoom pill

type ZoomPillProps = {
  viewport: Viewport;
  getCenter: () => [number, number];
  /** Fit the page width and jump back to the top of page 1. */
  onReset: () => void;
  pageCount: number;
  viewHeight: number;
};

export function ZoomPill({ viewport, getCenter, onReset, pageCount, viewHeight }: ZoomPillProps) {
  const [pct, setPct] = useState(100);
  const [pageNo, setPageNo] = useState(1);
  useAnimatedReaction(
    () => Math.round(viewport.scale.get() * 100),
    (v, prev) => {
      if (v !== prev) scheduleOnRN(setPct, v);
    },
  );
  useAnimatedReaction(
    () => pageAtCenter(viewport.ty.get(), viewport.scale.get(), viewHeight, pageCount) + 1,
    (v, prev) => {
      if (v !== prev) scheduleOnRN(setPageNo, v);
    },
    [viewHeight, pageCount],
  );
  const step = (f: number) => zoomAt(viewport, viewport.scale.get() * f, ...getCenter());

  return (
    <View style={[styles.zoom, shadow]}>
      <Pressable onPress={onReset} hitSlop={4} style={styles.pageNo}>
        <Text style={styles.zoomText}>
          Page {Math.min(pageNo, pageCount)} / {pageCount}
        </Text>
      </Pressable>
      <View style={styles.zoomDivider} />
      <IconBtn icon="minus" onPress={() => step(1 / 1.25)} size={18} />
      <Pressable onPress={onReset} hitSlop={4}>
        <Text style={styles.zoomText}>{pct}%</Text>
      </Pressable>
      <IconBtn icon="plus" onPress={() => step(1.25)} size={18} />
    </View>
  );
}

// ---------------------------------------------------------------- primitives

export function IconBtn({ icon, onPress, active, disabled, size = 22 }: { icon: IconName; onPress: () => void; active?: boolean; disabled?: boolean; size?: number }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={4} style={({ pressed }) => [styles.iconBtn, (active || pressed) && { backgroundColor: C.selected }, disabled && { opacity: 0.3 }]}>
      <MaterialCommunityIcons name={icon} size={size} color={active ? C.text : C.icon} />
    </Pressable>
  );
}

function Row({ icon, label, onPress, danger, right }: { icon: IconName; label: string; onPress: () => void; danger?: boolean; right?: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: C.selected }]}>
      <MaterialCommunityIcons name={icon} size={20} color={danger ? C.danger : C.icon} />
      <Text style={[styles.rowText, danger && { color: C.danger }]}>{label}</Text>
      {right}
    </Pressable>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <View style={[styles.toggle, on && { backgroundColor: C.text }]}>
      <View style={[styles.knob, on && { transform: [{ translateX: 14 }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    backgroundColor: C.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    zIndex: 10,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  title: { fontSize: 16, fontWeight: '600', color: C.text, minWidth: 120, maxWidth: 320, paddingVertical: 6 },
  divider: { width: StyleSheet.hairlineWidth, height: 24, backgroundColor: C.border, marginHorizontal: 6 },
  iconBtn: { width: 40, height: 40, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center' },
  colorBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  colorDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' },
  askBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primary, paddingHorizontal: 14, height: 36, borderRadius: R.pill, marginLeft: 6 },
  askText: { color: C.onPrimary, fontWeight: '600', fontSize: 14 },

  rail: { position: 'absolute', left: 12, top: 0, bottom: 0, justifyContent: 'center', gap: 10 },
  railCard: { backgroundColor: C.surface, borderRadius: R.lg, paddingVertical: 6, paddingHorizontal: 4, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  sizeBtn: { width: 40, height: 34, alignItems: 'center', justifyContent: 'center' },

  popover: { position: 'absolute', top: 64, backgroundColor: C.surface, borderRadius: R.lg, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, zIndex: 20 },
  popLabel: { fontSize: 12, fontWeight: '600', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  swatchRing: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 34, height: 34, borderRadius: 17 },
  paperRow: { flexDirection: 'row', gap: 6 },
  paperBtn: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 8, borderRadius: R.sm },
  paperActive: { backgroundColor: C.selected },
  paperText: { fontSize: 12, color: C.muted },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingVertical: 10, borderRadius: R.sm },
  rowText: { flex: 1, fontSize: 15, color: C.text },
  toggle: { width: 34, height: 20, borderRadius: 10, backgroundColor: C.faint, padding: 2 },
  knob: { width: 16, height: 16, borderRadius: 8, backgroundColor: C.surface },
  pageSwatch: { width: 22, height: 22, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.2)' },
  zoom: { position: 'absolute', bottom: 16, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: R.pill, paddingHorizontal: 2, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  pageNo: { paddingHorizontal: 10 },
  zoomDivider: { width: StyleSheet.hairlineWidth, height: 18, backgroundColor: C.border },
  zoomText: { fontSize: 13, fontWeight: '600', color: C.text, minWidth: 48, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
