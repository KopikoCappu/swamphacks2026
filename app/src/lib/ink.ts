import { Skia, type SkPath } from '@shopify/react-native-skia';
import { getStroke } from 'perfect-freehand';
import type { Annotation, MathBlock, Page, Point, Rect, Selection, ShapeKind, Stroke, TextBlock } from './types';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// ---------- Stroke -> Skia path ----------

const pathCache = new WeakMap<Stroke, SkPath>();

/** Filled outline path for a stroke (pen) or a plain polyline (highlighter). Cached per stroke object. */
export function strokePath(stroke: Stroke): SkPath {
  const cached = pathCache.get(stroke);
  if (cached) return cached;
  const path = buildPath(stroke.points, stroke.tool, stroke.size, stroke.stylus);
  pathCache.set(stroke, path);
  return path;
}

export function buildPath(points: Point[], tool: Stroke['tool'], size: number, stylus: boolean): SkPath {
  const path = Skia.PathBuilder.Make();
  if (points.length === 0) return path.detach();

  if (tool === 'highlighter' || tool === 'shape') {
    path.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) path.lineTo(points[i][0], points[i][1]);
    if (points.length === 1) path.lineTo(points[0][0] + 0.1, points[0][1]);
    return path.detach();
  }

  const outline = getStroke(points, {
    size,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.4,
    simulatePressure: !stylus,
    last: true,
  });
  if (outline.length < 2) return path.detach();
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length - 1; i++) {
    // quadratic smoothing between midpoints
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[i + 1];
    path.quadTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  path.close();
  return path.detach();
}

// ---------- Geometry ----------

export function boundsOfPoints(pts: { x: number; y: number }[]): Rect {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function unionRects(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  return boundsOfPoints(rects.flatMap((r) => [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y + r.h }]));
}

export function strokeBounds(s: Stroke): Rect {
  const r = boundsOfPoints(s.points.map(([x, y]) => ({ x, y })));
  const pad = s.size;
  return { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
}

export function pointInPolygon(x: number, y: number, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Paper ruling. Typed text uses the same line height so it sits on the lines.
export const LINE_SPACING = 32;
export const TEXT_LINE_HEIGHT = LINE_SPACING;

export const TEXT_SIZE = 18;
export const textLineHeight = (t: TextBlock) => ((t.size ?? TEXT_SIZE) / TEXT_SIZE) * TEXT_LINE_HEIGHT;
export const textBounds = (t: TextBlock): Rect => ({
  x: t.x,
  y: t.y,
  w: t.width,
  h: Math.max(1, t.text.split('\n').length) * textLineHeight(t) + 8,
});

export const mathBounds = (m: MathBlock): Rect => ({ x: m.x, y: m.y, w: m.w, h: m.h });

/** Clickable area of an AI note or mark (marks extend a little past their target rect). */
export function annotationBounds(a: Annotation): Rect {
  const k = a.scale ?? 1;
  if (a.kind === 'note') return { x: a.rect.x, y: a.rect.y, w: Math.max(a.rect.w, 60 * k), h: Math.max(a.rect.h, 28 * k) };
  const pad = 14 * k;
  const r = { x: a.rect.x - pad, y: a.rect.y - pad, w: a.rect.w + pad * 2, h: a.rect.h + pad * 2 };
  if (a.kind === 'check' || a.kind === 'cross') r.w += 50 * k; // drawn just right of the target
  return a.from ? unionRects([r, { x: a.from[0] - 6, y: a.from[1] - 6, w: 12, h: 12 }])! : r;
}

export const rectContains = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/** Everything mostly inside the lasso polygon (ink by point coverage, everything else by its center). */
export function selectWithLasso(lasso: Point[], page: Page): Selection | null {
  if (lasso.length < 3) return null;
  const strokeIds = page.strokes
    .filter((s) => {
      const inside = s.points.filter(([x, y]) => pointInPolygon(x, y, lasso)).length;
      return inside / s.points.length >= 0.5;
    })
    .map((s) => s.id);
  const center = (r: Rect) => [r.x + r.w / 2, r.y + r.h / 2] as const;
  return makeSelection(page, {
    strokeIds,
    textIds: page.texts.filter((t) => pointInPolygon(...center(textBounds(t)), lasso)).map((t) => t.id),
    imageIds: page.images.filter((im) => !im.locked && pointInPolygon(...center(im), lasso)).map((i) => i.id),
    mathIds: (page.maths ?? []).filter((m) => pointInPolygon(...center(mathBounds(m)), lasso)).map((m) => m.id),
    annotationIds: page.annotations.filter((a) => pointInPolygon(...center(annotationBounds(a)), lasso)).map((a) => a.id),
  });
}

/** Strokes touched by the eraser at (x, y). */
export function strokesHitAt(strokes: Stroke[], x: number, y: number, radius: number): string[] {
  const r2 = radius * radius;
  return strokes
    .filter((s) => s.points.some(([px, py]) => (px - x) ** 2 + (py - y) ** 2 <= r2 + (s.size / 2) ** 2))
    .map((s) => s.id);
}

// ---------- Shapes ----------

/** Resample a polyline so points are at most `step` apart (keeps eraser hit-testing working on long edges). */
function densify(pts: [number, number][], step = 4): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 0; k < n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, 0.5]);
  }
  const last = pts[pts.length - 1];
  out.push([last[0], last[1], 0.5]);
  return out;
}

/** Polyline points for a shape dragged from (x0, y0) to (x1, y1). */
export function shapePoints(kind: ShapeKind, x0: number, y0: number, x1: number, y1: number, size: number): Point[] {
  switch (kind) {
    case 'line':
      return densify([[x0, y0], [x1, y1]]);
    case 'arrow': {
      const a = Math.atan2(y1 - y0, x1 - x0);
      const head = Math.max(14, size * 4);
      const h1: [number, number] = [x1 - head * Math.cos(a - 0.5), y1 - head * Math.sin(a - 0.5)];
      const h2: [number, number] = [x1 - head * Math.cos(a + 0.5), y1 - head * Math.sin(a + 0.5)];
      return densify([[x0, y0], [x1, y1], h1, [x1, y1], h2]);
    }
    case 'rect':
      return densify([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]);
    case 'ellipse': {
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2;
      const pts: [number, number][] = [];
      for (let i = 0; i <= 72; i++) {
        const t = (i / 72) * Math.PI * 2;
        pts.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]);
      }
      return densify(pts);
    }
  }
}

// ---------- Selection: tap-select, bounds, move/resize ----------

const EMPTY_SEL = { strokeIds: [], textIds: [], mathIds: [], imageIds: [], annotationIds: [] };
const annIds = (sel: { annotationIds?: string[] }) => sel.annotationIds ?? [];

/** Bounds of everything in a selection (null if it's empty). */
export function selectionBounds(page: Page, sel: Omit<Selection, 'bounds'>): Rect | null {
  return unionRects([
    ...page.strokes.filter((s) => sel.strokeIds.includes(s.id)).map(strokeBounds),
    ...page.texts.filter((t) => sel.textIds.includes(t.id)).map(textBounds),
    ...(page.maths ?? []).filter((m) => sel.mathIds.includes(m.id)).map(mathBounds),
    ...page.images.filter((i) => sel.imageIds.includes(i.id)),
    ...page.annotations.filter((a) => annIds(sel).includes(a.id)).map(annotationBounds),
  ]);
}

export function makeSelection(page: Page, ids: Partial<Omit<Selection, 'bounds'>>): Selection | null {
  const sel = { ...EMPTY_SEL, ...ids };
  const bounds = selectionBounds(page, sel);
  return bounds ? { ...sel, bounds } : null;
}

/** Topmost single object under a tap (equation > text > ink > image). Locked images are ignored. */
export function hitTest(page: Page, x: number, y: number, tolerance: number): Selection | null {
  const math = [...(page.maths ?? [])].reverse().find((m) => rectContains(mathBounds(m), x, y));
  if (math) return makeSelection(page, { mathIds: [math.id] });
  const text = [...page.texts].reverse().find((t) => rectContains(textBounds(t), x, y));
  if (text) return makeSelection(page, { textIds: [text.id] });
  const note = [...page.annotations].reverse().find((a) => a.kind === 'note' && rectContains(annotationBounds(a), x, y));
  if (note) return makeSelection(page, { annotationIds: [note.id] });
  const stroke = strokesHitAt(page.strokes, x, y, tolerance).pop();
  if (stroke) return makeSelection(page, { strokeIds: [stroke] });
  const mark = [...page.annotations].reverse().find((a) => a.kind !== 'note' && rectContains(annotationBounds(a), x, y));
  if (mark) return makeSelection(page, { annotationIds: [mark.id] });
  const image = [...page.images].reverse().find((i) => !i.locked && rectContains(i, x, y));
  if (image) return makeSelection(page, { imageIds: [image.id] });
  return null;
}

/** Uniform scale `s` about anchor (ax, ay), then translate by (dx, dy). */
export type Transform = { ax: number; ay: number; s: number; dx: number; dy: number };
export const IDENTITY: Transform = { ax: 0, ay: 0, s: 1, dx: 0, dy: 0 };

export const mapX = (t: Transform, x: number) => t.ax + (x - t.ax) * t.s + t.dx;
export const mapY = (t: Transform, y: number) => t.ay + (y - t.ay) * t.s + t.dy;
export const mapRect = (t: Transform, r: Rect): Rect => ({ x: mapX(t, r.x), y: mapY(t, r.y), w: r.w * t.s, h: r.h * t.s });

/** Apply a move/resize to the selected items. Ink thickness, font size and equation size scale too. */
export function transformSelection(page: Page, sel: Selection, t: Transform): Partial<Page> {
  const has = (ids: string[], id: string) => ids.includes(id);
  return {
    strokes: page.strokes.map((s) =>
      has(sel.strokeIds, s.id) ? { ...s, size: s.size * t.s, points: s.points.map(([x, y, p]) => [mapX(t, x), mapY(t, y), p] as Point) } : s,
    ),
    images: page.images.map((i) => (has(sel.imageIds, i.id) ? { ...i, ...mapRect(t, i) } : i)),
    texts: page.texts.map((b) =>
      has(sel.textIds, b.id) ? { ...b, x: mapX(t, b.x), y: mapY(t, b.y), width: b.width * t.s, size: (b.size ?? TEXT_SIZE) * t.s } : b,
    ),
    maths: (page.maths ?? []).map((m) => (has(sel.mathIds, m.id) ? { ...m, ...mapRect(t, mathBounds(m)), size: (m.size ?? 24) * t.s } : m)),
    annotations: page.annotations.map((a) =>
      has(annIds(sel), a.id)
        ? { ...a, rect: mapRect(t, a.rect), from: a.from ? ([mapX(t, a.from[0]), mapY(t, a.from[1])] as [number, number]) : undefined, scale: (a.scale ?? 1) * t.s }
        : a,
    ),
  };
}

/** Copies of the selected items, offset a little. Returns the page changes and the ids of the copies. */
export function duplicateSelection(page: Page, sel: Selection, offset = 24) {
  const moved = transformSelection(page, sel, { ...IDENTITY, dx: offset, dy: offset });
  const fresh = <T extends { id: string }>(items: T[], ids: string[]) => items.filter((i) => ids.includes(i.id)).map((i) => ({ ...i, id: uid() }));
  const strokes = fresh(moved.strokes!, sel.strokeIds);
  const images = fresh(moved.images!, sel.imageIds);
  const texts = fresh(moved.texts!, sel.textIds);
  const maths = fresh(moved.maths!, sel.mathIds);
  const annotations = fresh(moved.annotations!, annIds(sel)).map((a) => ({ ...a, createdAt: 0 })); // no draw-in animation
  return {
    changes: {
      strokes: [...page.strokes, ...strokes],
      images: [...page.images, ...images],
      texts: [...page.texts, ...texts],
      maths: [...(page.maths ?? []), ...maths],
      annotations: [...page.annotations, ...annotations],
    },
    ids: {
      strokeIds: strokes.map((x) => x.id),
      imageIds: images.map((x) => x.id),
      textIds: texts.map((x) => x.id),
      mathIds: maths.map((x) => x.id),
      annotationIds: annotations.map((x) => x.id),
    },
  };
}

export function deleteSelection(page: Page, sel: Selection): Partial<Page> {
  return {
    strokes: page.strokes.filter((s) => !sel.strokeIds.includes(s.id)),
    images: page.images.filter((i) => !sel.imageIds.includes(i.id)),
    texts: page.texts.filter((t) => !sel.textIds.includes(t.id)),
    maths: (page.maths ?? []).filter((m) => !sel.mathIds.includes(m.id)),
    annotations: page.annotations.filter((a) => !annIds(sel).includes(a.id)),
  };
}

/** Everything on the page as one selection — for "Ask about the whole page". */
export function selectAll(page: Page): Selection | null {
  return makeSelection(page, {
    strokeIds: page.strokes.map((s) => s.id),
    textIds: page.texts.map((t) => t.id),
    mathIds: (page.maths ?? []).map((m) => m.id),
    imageIds: page.images.map((i) => i.id),
  });
}
