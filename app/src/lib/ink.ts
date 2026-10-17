import { Skia, type SkPath } from '@shopify/react-native-skia';
import { getStroke } from 'perfect-freehand';
import type { PageImage, Point, Rect, Selection, Stroke, TextBlock } from './types';

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

  if (tool === 'highlighter') {
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

// Notebook ruling. Typed text uses the same line height so it sits on the lines.
export const LINE_SPACING = 32;
export const RULE_TOP = 64; // first ruled line
export const MARGIN_X = 72; // red margin line on lined paper
export const TEXT_LINE_HEIGHT = LINE_SPACING;

/** Top of a text block whose first line sits on the ruled line nearest to y. */
export function snapTextTop(y: number) {
  const rule = RULE_TOP + Math.max(0, Math.round((y - RULE_TOP) / LINE_SPACING)) * LINE_SPACING;
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
