import { Skia, type SkPath } from '@shopify/react-native-skia';
import { getStroke } from 'perfect-freehand';
import type { PageImage, Point, Rect, Selection, ShapeKind, Stroke, TextBlock } from './types';

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

/** Top of a text block whose first line sits on the ruled line nearest to y. */
export function snapTextTop(y: number) {
  const rule = Math.round(y / LINE_SPACING) * LINE_SPACING; // the canvas is infinite, so lines are too
  return rule - LINE_SPACING + 4;
}
export const textBounds = (t: TextBlock): Rect => ({
  x: t.x,
  y: t.y,
  w: t.width,
  h: Math.max(1, t.text.split('\n').length) * TEXT_LINE_HEIGHT + 8,
});

/** Everything mostly inside the lasso polygon. */
export function selectWithLasso(
  lasso: Point[],
  strokes: Stroke[],
  texts: TextBlock[],
  images: PageImage[],
): Selection | null {
  if (lasso.length < 3) return null;
  const strokeIds = strokes
    .filter((s) => {
      const inside = s.points.filter(([x, y]) => pointInPolygon(x, y, lasso)).length;
      return inside / s.points.length >= 0.5;
    })
    .map((s) => s.id);
  const center = (r: Rect) => [r.x + r.w / 2, r.y + r.h / 2] as const;
  const textIds = texts.filter((t) => pointInPolygon(...center(textBounds(t)), lasso)).map((t) => t.id);
  const imageIds = images.filter((im) => pointInPolygon(...center(im), lasso)).map((i) => i.id);

  const rects = [
    ...strokes.filter((s) => strokeIds.includes(s.id)).map(strokeBounds),
    ...texts.filter((t) => textIds.includes(t.id)).map(textBounds),
    ...images.filter((i) => imageIds.includes(i.id)),
  ];
  const bounds = unionRects(rects);
  if (!bounds) return null;
  return { strokeIds, textIds, imageIds, bounds };
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
