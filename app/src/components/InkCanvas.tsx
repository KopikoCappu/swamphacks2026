import { Canvas, Circle, DashPathEffect, Group, Image as SkiaImage, Path, Rect, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { GestureDetector, PointerType, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import Animated, { FadeIn, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { isDark, PaperBackground } from '@/components/PaperBackground';
import { annotationPath } from '@/lib/annotations';
import { buildPath, selectWithLasso, shapePoints, snapTextTop, strokePath, strokesHitAt, TEXT_LINE_HEIGHT, uid } from '@/lib/ink';
import { skImageFor } from '@/lib/snapshot';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import type { Annotation, Point, Selection, Stroke } from '@/lib/types';
import { clampZoom, toPage, zoomAt, type Viewport } from '@/lib/viewport';

type Props = {
  pageId: string;
  selection: Selection | null;
  onSelectionChange: (s: Selection | null) => void;
  viewport: Viewport;
};

type Mode = 'idle' | 'draw' | 'erase' | 'pan';

export function InkCanvas({ pageId, selection, onSelectionChange, viewport }: Props) {
  const page = useStore((s) => s.pages[pageId]);
  const tool = useStore((s) => s.tool);
  const color = useStore((s) => s.color);
  const highlighterColor = useStore((s) => s.highlighterColor);
  const sizes = useStore((s) => s.sizes);
  const shapeKind = useStore((s) => s.shapeKind);
  const updatePage = useStore((s) => s.updatePage);
  const [live, setLive] = useState<Point[]>([]);
  const [liveStylus, setLiveStylus] = useState(false);
  const [editingText, setEditingText] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [eraserAt, setEraserAt] = useState<{ x: number; y: number } | null>(null);
  const rootRef = useRef<ComponentRef<typeof View>>(null);

  // Gesture callbacks read from refs / getState() so they never see stale render values.
  const g = useRef({ mode: 'idle' as Mode, stylus: false, erasedOnce: false, points: [] as Point[], pan: { x: 0, y: 0, tx: 0, ty: 0 } });
  const pinch0 = useRef({ active: false, s: 1, tx: 0, ty: 0, fx: 0, fy: 0 });
  const onSelRef = useRef(onSelectionChange);
  useEffect(() => {
    onSelRef.current = onSelectionChange;
  }, [onSelectionChange]);

  function cancelStroke() {
    g.current.mode = 'idle';
    g.current.points = [];
    setLive([]);
    setEraserAt(null);
  }

  const draw = usePanGesture({
    minDistance: 0,
    runOnJS: true,
    maxPointers: 1,
    onActivate: (e) => {
      if (pinch0.current.active) return;
      const { tool, penOnly } = useStore.getState();
      const isPen = e.pointerType === PointerType.STYLUS;
      g.current.stylus = isPen;
      g.current.erasedOnce = false;
      setLiveStylus(isPen);
      // Pen-only mode: fingers scroll the page instead of drawing (palm rejection).
      if (penOnly && !isPen) {
        g.current.mode = 'pan';
        g.current.pan = { x: e.x, y: e.y, tx: viewport.tx.get(), ty: viewport.ty.get() };
        return;
      }
      if (tool !== 'text') onSelRef.current(null);
      const [px, py] = toPage(viewport, e.x, e.y);
      if (tool === 'eraser') {
        g.current.mode = 'erase';
        return erase(px, py);
      }
      g.current.mode = 'draw';
      g.current.points = [[px, py, e.stylusData?.pressure ?? 0.5]];
      setLive(g.current.points);
    },
    onUpdate: (e) => {
      if (pinch0.current.active) return;
      const m = g.current.mode;
      if (m === 'pan') {
        viewport.tx.set(g.current.pan.tx + e.x - g.current.pan.x);
        viewport.ty.set(g.current.pan.ty + e.y - g.current.pan.y);
        return;
      }
      const [px, py] = toPage(viewport, e.x, e.y);
      if (m === 'erase') return erase(px, py);
      if (m !== 'draw') return;
      const pt: Point = [px, py, e.stylusData?.pressure ?? 0.5];
      // Shapes only need the drag start + current point.
      g.current.points = useStore.getState().tool === 'shape' ? [g.current.points[0], pt] : [...g.current.points, pt];
      setLive(g.current.points);
    },
    onDeactivate: (e) => {
      const m = g.current.mode;
      const pts = g.current.points;
      cancelStroke();
      if (m !== 'draw' || e.canceled || !pts.length) return;

      const { tool, color, highlighterColor, sizes, shapeKind, pages } = useStore.getState();
      const page = pages[pageId];
      if (tool === 'pen' || tool === 'highlighter') {
        const stroke: Stroke = {
          id: uid(),
          tool,
          color: tool === 'highlighter' ? highlighterColor : color,
          size: sizes[tool],
          points: pts,
          stylus: g.current.stylus,
        };
        updatePage(pageId, (p) => ({ strokes: [...p.strokes, stroke] }), true);
      } else if (tool === 'shape') {
        const [a, b] = [pts[0], pts[pts.length - 1]];
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 3) return;
        const stroke: Stroke = { id: uid(), tool: 'shape', color, size: sizes.pen, points: shapePoints(shapeKind, a[0], a[1], b[0], b[1], sizes.pen), stylus: false };
        updatePage(pageId, (p) => ({ strokes: [...p.strokes, stroke] }), true);
      } else if (tool === 'lasso') {
        onSelRef.current(selectWithLasso(pts, page.strokes, page.texts, page.images));
      } else if (tool === 'text') {
        const [x, y] = pts[0];
        const id = uid();
        // On ruled paper, snap typed text onto the nearest line.
        const top = (page.paper ?? 'blank') === 'blank' ? y - TEXT_LINE_HEIGHT / 2 : snapTextTop(y);
        updatePage(pageId, (p) => ({ texts: [...p.texts, { id, x, y: top, width: 360, text: '' }] }), true);
        setEditingText(id);
      }
    },
  });

  // Two fingers: pinch to zoom around the fingers, and move them to pan.
  const pinch = usePinchGesture({
    runOnJS: true,
    onActivate: (e) => {
      cancelStroke();
      pinch0.current = { active: true, s: viewport.scale.get(), tx: viewport.tx.get(), ty: viewport.ty.get(), fx: e.focalX, fy: e.focalY };
    },
    onUpdate: (e) => {
      const p0 = pinch0.current;
      const s = clampZoom(p0.s * e.scale);
      const px = (p0.fx - p0.tx) / p0.s;
      const py = (p0.fy - p0.ty) / p0.s;
      viewport.scale.set(s);
      viewport.tx.set(e.focalX - px * s);
      viewport.ty.set(e.focalY - py * s);
    },
    onFinalize: () => {
      pinch0.current.active = false;
    },
  });

  const gesture = useSimultaneousGestures(draw, pinch);

  // Web: wheel/trackpad scrolls, Ctrl/Cmd+wheel (or trackpad pinch) zooms at the cursor.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = rootRef.current as unknown as HTMLElement | null;
    if (!el?.addEventListener) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(viewport, viewport.scale.get() * Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
      else {
        viewport.tx.set(viewport.tx.get() - e.deltaX);
        viewport.ty.set(viewport.ty.get() - e.deltaY);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [viewport]);

  function erase(x: number, y: number) {
    setEraserAt({ x, y });
    const { pages, sizes } = useStore.getState();
    const hit = strokesHitAt(pages[pageId]?.strokes ?? [], x, y, sizes.eraser / viewport.scale.get());
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
    if (tool === 'shape') {
      const [a, b] = [live[0], live[live.length - 1]];
      return buildPath(shapePoints(shapeKind, a[0], a[1], b[0], b[1], sizes.pen), 'shape', sizes.pen, false);
    }
    return buildPath(live, tool, sizes[tool], liveStylus);
  }, [live, liveStylus, tool, sizes, shapeKind]);

  // Page -> screen transform for both the Skia layer and the RN overlays.
  const { scale, tx, ty } = viewport;
  const transform = useDerivedValue(() => [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }]);
  const overlayStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }] }));
  const eraserR = useDerivedValue(() => sizes.eraser / scale.get(), [sizes.eraser]);
  const hairline = useDerivedValue(() => 1.5 / scale.get());

  if (!page) return null;
  const bg = page.bg ?? '#FFFFFF';
  const textColor = isDark(bg) ? '#F2F2F2' : C.text;
  const selected = new Set(selection?.strokeIds);

  return (
    <View ref={rootRef} style={[styles.root, { backgroundColor: bg }]} onLayout={(e) => setCanvasSize(e.nativeEvent.layout)}>
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill} collapsable={false}>
          <Canvas style={StyleSheet.absoluteFill}>
            <Group transform={transform}>
              <PaperBackground paper={page.paper ?? 'blank'} bg={bg} width={canvasSize.width} height={canvasSize.height} viewport={viewport} />

              {page.images.map((im) => {
                const sk = skImageFor(im);
                return sk ? <SkiaImage key={im.id} image={sk} x={im.x} y={im.y} width={im.w} height={im.h} fit="contain" /> : null;
              })}

              {page.strokes.map((s) =>
                s.tool === 'pen' ? (
                  <Path key={s.id} path={strokePath(s)} color={selected.has(s.id) ? C.focus : s.color} />
                ) : (
                  <Path
                    key={s.id}
                    path={strokePath(s)}
                    color={selected.has(s.id) ? C.focus : s.color}
                    opacity={s.tool === 'highlighter' ? 0.35 : 1}
                    style="stroke"
                    strokeWidth={s.size}
                    strokeCap="round"
                    strokeJoin="round"
                  />
                ),
              )}

              {livePath && tool === 'lasso' && (
                <Path path={livePath} color={C.focus} style="stroke" strokeWidth={hairline}>
                  <DashPathEffect intervals={[8, 6]} />
                </Path>
              )}
              {livePath && tool === 'highlighter' && (
                <Path path={livePath} color={highlighterColor} opacity={0.35} style="stroke" strokeWidth={sizes.highlighter} strokeCap="round" strokeJoin="round" />
              )}
              {livePath && tool === 'shape' && <Path path={livePath} color={color} style="stroke" strokeWidth={sizes.pen} strokeCap="round" strokeJoin="round" />}
              {livePath && tool === 'pen' && <Path path={livePath} color={color} />}

              {eraserAt && tool === 'eraser' && <Circle cx={eraserAt.x} cy={eraserAt.y} r={eraserR} color={C.muted} style="stroke" strokeWidth={hairline} />}

              {selection && (
                <Rect x={selection.bounds.x - 12} y={selection.bounds.y - 12} width={selection.bounds.w + 24} height={selection.bounds.h + 24} color={C.focus} style="stroke" strokeWidth={hairline}>
                  <DashPathEffect intervals={[6, 5]} />
                </Rect>
              )}

              {page.annotations.map((a) => (
                <AnnotationStroke key={a.id} a={a} />
              ))}
            </Group>
          </Canvas>
        </View>
      </GestureDetector>

      {/* Typed text blocks: editable only with the text tool so drawing over them still works */}
      <Animated.View style={[styles.layer, overlayStyle]} pointerEvents={tool === 'text' ? 'box-none' : 'none'}>
        {page.texts.map((t) => (
          <TextInput
            key={t.id}
            value={t.text}
            multiline
            autoFocus={editingText === t.id}
            placeholder="Type…"
            placeholderTextColor={C.muted}
            onChangeText={(text) => updatePage(pageId, (p) => ({ texts: p.texts.map((x) => (x.id === t.id ? { ...x, text } : x)) }))}
            onBlur={() => {
              setEditingText(null);
              if (!t.text.trim()) updatePage(pageId, (p) => ({ texts: p.texts.filter((x) => x.id !== t.id) }));
            }}
            style={[styles.textBlock, { left: t.x, top: t.y, width: t.width, color: textColor }, selection?.textIds.includes(t.id) && styles.textSelected]}
          />
        ))}
      </Animated.View>

      {/* AI margin notes in handwriting font */}
      <Animated.View style={[styles.layer, overlayStyle]} pointerEvents="none">
        {page.annotations
          .filter((a) => a.kind === 'note' && a.text)
          .map((a) => (
            <AiNote key={a.id} a={a} />
          ))}
      </Animated.View>
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
    if (delay !== null) end.set(withDelay(delay, withTiming(1, { duration: 700 })));
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
  root: { flex: 1, overflow: 'hidden' },
  // Overlays share the canvas transform; origin top-left so page (0,0) maps like the Skia group.
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, transformOrigin: 'left top' },
  textBlock: {
    position: 'absolute',
    fontSize: 18,
    lineHeight: TEXT_LINE_HEIGHT,
    paddingHorizontal: 4,
    paddingVertical: 0,
  },
  textSelected: { backgroundColor: 'rgba(47,111,235,0.10)', borderRadius: 4 },
  note: { position: 'absolute', fontFamily: 'Caveat_600SemiBold', fontSize: 26, lineHeight: 28 },
});
