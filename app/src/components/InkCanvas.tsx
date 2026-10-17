import { Canvas, DashPathEffect, Group, Image as SkiaImage, Path, Rect, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { GestureDetector, PointerType, usePanGesture } from 'react-native-gesture-handler';
import Animated, { FadeIn, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { annotationPath } from '@/lib/annotations';
import { buildPath, selectWithLasso, strokePath, strokesHitAt, TEXT_LINE_HEIGHT, uid } from '@/lib/ink';
import { skImageFor } from '@/lib/snapshot';
import { useStore } from '@/lib/store';
import type { Annotation, Point, Selection, Stroke } from '@/lib/types';

type Props = {
  pageId: string;
  selection: Selection | null;
  onSelectionChange: (s: Selection | null) => void;
};

const HIGHLIGHTER_SIZE = 22;
const ERASER_RADIUS = 14;

export function InkCanvas({ pageId, selection, onSelectionChange }: Props) {
  const page = useStore((s) => s.pages[pageId]);
  const tool = useStore((s) => s.tool);
  const color = useStore((s) => s.color);
  const penSize = useStore((s) => s.penSize);
  const updatePage = useStore((s) => s.updatePage);
  const [live, setLive] = useState<Point[]>([]);
  const [liveStylus, setLiveStylus] = useState(false);
  const [editingText, setEditingText] = useState<string | null>(null);

  // Gesture callbacks read from refs / getState() so they never see stale render values.
  const g = useRef({ active: false, stylus: false, erasedOnce: false, points: [] as Point[] });
  const onSelRef = useRef(onSelectionChange);
  useEffect(() => {
    onSelRef.current = onSelectionChange;
  }, [onSelectionChange]);

  const pan = usePanGesture({
    minDistance: 0,
    runOnJS: true,
    maxPointers: 1,
    onActivate: (e) => {
      const { tool, penOnly } = useStore.getState();
      const isPen = e.pointerType === PointerType.STYLUS;
      // Palm rejection: in pen-only mode, fingers don't draw.
      g.current = { active: !(penOnly && !isPen), stylus: isPen, erasedOnce: false, points: [] };
      setLiveStylus(isPen);
      if (!g.current.active) return;
      if (tool !== 'text') onSelRef.current(null);
      if (tool === 'eraser') return erase(e.x, e.y);
      g.current.points = [[e.x, e.y, e.stylusData?.pressure ?? 0.5]];
      setLive(g.current.points);
    },
    onUpdate: (e) => {
      if (!g.current.active) return;
      if (useStore.getState().tool === 'eraser') return erase(e.x, e.y);
      g.current.points = [...g.current.points, [e.x, e.y, e.stylusData?.pressure ?? 0.5]];
      setLive(g.current.points);
    },
    onDeactivate: () => {
      if (!g.current.active) return;
      g.current.active = false;
      const pts = g.current.points;
      g.current.points = [];
      setLive([]);
      if (!pts.length) return;

      const { tool, color, penSize, pages } = useStore.getState();
      const page = pages[pageId];
      if (tool === 'pen' || tool === 'highlighter') {
        const stroke: Stroke = {
          id: uid(),
          tool,
          color: tool === 'highlighter' ? '#FFD60A' : color,
          size: tool === 'highlighter' ? HIGHLIGHTER_SIZE : penSize,
          points: pts,
          stylus: g.current.stylus,
        };
        updatePage(pageId, (p) => ({ strokes: [...p.strokes, stroke] }), true);
      } else if (tool === 'lasso') {
        onSelRef.current(selectWithLasso(pts, page.strokes, page.texts, page.images));
      } else if (tool === 'text') {
        const [x, y] = pts[0];
        const id = uid();
        updatePage(pageId, (p) => ({ texts: [...p.texts, { id, x, y: y - TEXT_LINE_HEIGHT / 2, width: 360, text: '' }] }), true);
        setEditingText(id);
      }
    },
  });

  function erase(x: number, y: number) {
    const strokes = useStore.getState().pages[pageId]?.strokes ?? [];
    const hit = strokesHitAt(strokes, x, y, ERASER_RADIUS);
    if (!hit.length) return;
    updatePage(pageId, (p) => ({ strokes: p.strokes.filter((s) => !hit.includes(s.id)) }), !g.current.erasedOnce);
    g.current.erasedOnce = true;
  }

  const livePath = useMemo(() => {
    if (!live.length || tool === 'eraser' || tool === 'text') return null;
    if (tool === 'lasso') {
      const p = Skia.PathBuilder.Make();
      p.moveTo(live[0][0], live[0][1]);
      live.forEach(([x, y]) => p.lineTo(x, y));
      return p.detach();
    }
    return buildPath(live, tool, tool === 'highlighter' ? HIGHLIGHTER_SIZE : penSize, liveStylus);
  }, [live, liveStylus, tool, penSize]);

  if (!page) return null;
  const selected = new Set(selection?.strokeIds);

  return (
    <View style={styles.root}>
      <GestureDetector gesture={pan}>
        <View style={StyleSheet.absoluteFill} collapsable={false}>
          <Canvas style={StyleSheet.absoluteFill}>
            {page.images.map((im) => {
              const sk = skImageFor(im);
              return sk ? <SkiaImage key={im.id} image={sk} x={im.x} y={im.y} width={im.w} height={im.h} fit="contain" /> : null;
            })}

            {page.strokes.map((s) =>
              s.tool === 'highlighter' ? (
                <Path key={s.id} path={strokePath(s)} color={s.color} opacity={0.35} style="stroke" strokeWidth={s.size} strokeCap="round" strokeJoin="round" />
              ) : (
                <Path key={s.id} path={strokePath(s)} color={selected.has(s.id) ? '#3E63DD' : s.color} />
              ),
            )}

            {livePath && tool === 'lasso' && (
              <Path path={livePath} color="#3E63DD" style="stroke" strokeWidth={2}>
                <DashPathEffect intervals={[8, 6]} />
              </Path>
            )}
            {livePath && tool === 'highlighter' && (
              <Path path={livePath} color="#FFD60A" opacity={0.35} style="stroke" strokeWidth={HIGHLIGHTER_SIZE} strokeCap="round" strokeJoin="round" />
            )}
            {livePath && tool === 'pen' && <Path path={livePath} color={color} />}

            {selection && (
              <Rect x={selection.bounds.x - 12} y={selection.bounds.y - 12} width={selection.bounds.w + 24} height={selection.bounds.h + 24} color="#3E63DD" style="stroke" strokeWidth={1.5}>
                <DashPathEffect intervals={[6, 5]} />
              </Rect>
            )}

            <Group>
              {page.annotations.map((a) => (
                <AnnotationStroke key={a.id} a={a} />
              ))}
            </Group>
          </Canvas>
        </View>
      </GestureDetector>

      {/* Typed text blocks: editable only with the text tool so drawing over them still works */}
      <View style={StyleSheet.absoluteFill} pointerEvents={tool === 'text' ? 'box-none' : 'none'}>
        {page.texts.map((t) => (
          <TextInput
            key={t.id}
            value={t.text}
            multiline
            autoFocus={editingText === t.id}
            placeholder="Type…"
            onChangeText={(text) => updatePage(pageId, (p) => ({ texts: p.texts.map((x) => (x.id === t.id ? { ...x, text } : x)) }))}
            onBlur={() => {
              setEditingText(null);
              if (!t.text.trim()) updatePage(pageId, (p) => ({ texts: p.texts.filter((x) => x.id !== t.id) }));
            }}
            style={[styles.textBlock, { left: t.x, top: t.y, width: t.width }, selection?.textIds.includes(t.id) && styles.textSelected]}
          />
        ))}
      </View>

      {/* AI margin notes in handwriting font */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {page.annotations
          .filter((a) => a.kind === 'note' && a.text)
          .map((a) => (
            <AiNote key={a.id} a={a} />
          ))}
      </View>
    </View>
  );
}

/** Delay (ms) before an annotation should start animating, or null if it's old and should just appear. */
function useAppearDelay(a: Annotation) {
  const [delay] = useState(() => {
    const age = Date.now() - a.createdAt;
    return age > 5000 ? null : Math.max(0, -age);
  });
  return delay;
}

/** AI ink that "draws itself" in with a stroke-trim animation. */
function AnnotationStroke({ a }: { a: Annotation }) {
  const path = useMemo(() => annotationPath(a), [a]);
  const delay = useAppearDelay(a);
  const end = useSharedValue(delay === null ? 1 : 0);
  useEffect(() => {
    if (delay !== null) end.value = withDelay(delay, withTiming(1, { duration: 700 }));
  }, [delay, end]);
  if (!path) return null;
  return <Path path={path} color={a.color} style="stroke" strokeWidth={3.5} strokeCap="round" strokeJoin="round" end={end} />;
}

/** AI margin note in a handwriting font. */
function AiNote({ a }: { a: Annotation }) {
  const delay = useAppearDelay(a);
  return (
    <Animated.Text
      entering={delay === null ? undefined : FadeIn.delay(delay).duration(600)}
      style={[styles.note, { left: a.rect.x, top: a.rect.y, maxWidth: Math.max(180, a.rect.w), color: a.color }]}
    >
      {a.text}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFDF8', overflow: 'hidden' },
  textBlock: {
    position: 'absolute',
    fontSize: 18,
    lineHeight: TEXT_LINE_HEIGHT,
    color: '#1F2328',
    padding: 4,
  },
  textSelected: { backgroundColor: 'rgba(62,99,221,0.12)', borderRadius: 4 },
  note: { position: 'absolute', fontFamily: 'Caveat_600SemiBold', fontSize: 26, lineHeight: 28 },
});
