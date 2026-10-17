import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { deleteSelection, duplicateSelection, makeSelection } from '@/lib/ink';
import { useStore } from '@/lib/store';
import { C, R, shadow } from '@/lib/theme';
import type { Include, Selection } from '@/lib/types';
import type { Viewport } from '@/lib/viewport';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type Props = {
  pageId: string;
  selection: Selection;
  viewport: Viewport;
  include: Include;
  setInclude: (i: Include) => void;
  onAsk: () => void;
  onSelectionChange: (s: Selection | null) => void;
};

const BAR_H = 44;

/** Floating actions for the current selection: Ask, what to send to the AI, and edit actions. */
export function SelectionBar({ pageId, selection, viewport, include, setInclude, onAsk, onSelectionChange }: Props) {
  const { updatePage } = useStore.getState();
  const hasInk = selection.strokeIds.length > 0;
  const hasImages = selection.imageIds.length > 0;
  const hasText = selection.textIds.length + selection.mathIds.length > 0;
  const { x, y, h } = selection.bounds;

  // Sit above the selection; flip below it when there's no room at the top.
  const pos = useAnimatedStyle(() => {
    const s = viewport.scale.get();
    const top = (y - 12) * s + viewport.ty.get() - BAR_H - 10;
    return {
      left: Math.max(64, (x - 12) * s + viewport.tx.get()),
      top: top < 8 ? (y + h + 12) * s + viewport.ty.get() + 10 : top,
    };
  });

  const page = () => useStore.getState().pages[pageId];

  function duplicate() {
    const { changes, ids } = duplicateSelection(page(), selection);
    updatePage(pageId, () => changes, true);
    onSelectionChange(makeSelection(page(), ids));
  }

  function recolor() {
    const { color, highlighterColor } = useStore.getState();
    updatePage(
      pageId,
      (p) => ({ strokes: p.strokes.map((s) => (selection.strokeIds.includes(s.id) ? { ...s, color: s.tool === 'highlighter' ? highlighterColor : color } : s)) }),
      true,
    );
  }

  function reorder(front: boolean) {
    updatePage(
      pageId,
      (p) => {
        const sel = p.images.filter((i) => selection.imageIds.includes(i.id));
        const rest = p.images.filter((i) => !selection.imageIds.includes(i.id));
        return { images: front ? [...rest, ...sel] : [...sel, ...rest] };
      },
      true,
    );
  }

  /** Locked images become background: not selectable or movable, never swept up by the lasso. */
  function lock() {
    updatePage(pageId, (p) => ({ images: p.images.map((i) => (selection.imageIds.includes(i.id) ? { ...i, locked: true } : i)) }), true);
    onSelectionChange(makeSelection(page(), { ...selection, imageIds: [] }));
  }

  function remove() {
    updatePage(pageId, (p) => deleteSelection(p, selection), true);
    onSelectionChange(null);
  }

  return (
    <Animated.View style={[styles.wrap, pos]}>
      <View style={[styles.bar, shadow]}>
        <Pressable style={styles.ask} onPress={onAsk}>
          <MaterialCommunityIcons name="creation" size={15} color={C.onPrimary} />
          <Text style={styles.askText}>Ask</Text>
        </Pressable>

        {/* What the AI receives from this selection */}
        {hasInk && <Toggle icon="draw" label="Ink" on={include.ink} onPress={() => setInclude({ ...include, ink: !include.ink })} />}
        {hasImages && <Toggle icon="image-outline" label="Image" on={include.images} onPress={() => setInclude({ ...include, images: !include.images })} />}
        {hasText && <Toggle icon="format-text" label="Text" on={include.text} onPress={() => setInclude({ ...include, text: !include.text })} />}

        <View style={styles.divider} />
        <Action icon="content-copy" onPress={duplicate} />
        {hasInk && <Action icon="palette-outline" onPress={recolor} />}
        {hasImages && (
          <>
            <Action icon="arrange-bring-forward" onPress={() => reorder(true)} />
            <Action icon="arrange-send-backward" onPress={() => reorder(false)} />
            <Action icon="lock-outline" onPress={lock} />
          </>
        )}
        <Action icon="delete-outline" onPress={remove} danger />
      </View>
    </Animated.View>
  );
}

function Toggle({ icon, label, on, onPress }: { icon: IconName; label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={4} style={[styles.toggle, on && styles.toggleOn]}>
      <MaterialCommunityIcons name={icon} size={15} color={on ? C.text : C.faint} />
      <Text style={[styles.toggleText, !on && { color: C.faint, textDecorationLine: 'line-through' }]}>{label}</Text>
    </Pressable>
  );
}

function Action({ icon, onPress, danger }: { icon: IconName; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={4} style={({ pressed }) => [styles.action, pressed && { backgroundColor: C.selected }]}>
      <MaterialCommunityIcons name={icon} size={19} color={danger ? C.danger : C.icon} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', zIndex: 5 },
  bar: { height: BAR_H, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: C.surface, borderRadius: R.pill, paddingHorizontal: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  ask: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.primary, height: 34, paddingHorizontal: 12, borderRadius: R.pill, marginRight: 4 },
  askText: { color: C.onPrimary, fontWeight: '600', fontSize: 13 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingHorizontal: 8, borderRadius: R.pill },
  toggleOn: { backgroundColor: C.selected },
  toggleText: { fontSize: 12, fontWeight: '600', color: C.text },
  divider: { width: StyleSheet.hairlineWidth, height: 22, backgroundColor: C.border, marginHorizontal: 4 },
  action: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
