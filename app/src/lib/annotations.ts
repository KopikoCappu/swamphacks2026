import { Skia, type SkPath } from '@shopify/react-native-skia';
import { uid } from './ink';
import type { Annotation, AnnotationKind, MathBlock, Rect, TextBlock } from './types';

export const AI_COLORS: Record<string, string> = {
  red: '#E5484D',
  green: '#30A46C',
  blue: '#3E63DD',
  orange: '#F76B15',
};

export type ModelKind = AnnotationKind | 'text' | 'math';

export type ModelAnnotation = {
  kind: ModelKind;
  /** index of the image (in the request's latest message) the box is relative to */
  image: number;
  box: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
  from?: [number, number]; // arrow start [y, x] 0-1000
  text?: string;
  color?: keyof typeof AI_COLORS;
};

export type PageAdditions = { annotations: Annotation[]; texts: TextBlock[]; maths: MathBlock[] };

/**
 * Map the model's output back into page space. `regions[i]` is the page-space rect that request image i
 * showed, so boxes on any image (a selection or the page view) land in the right place.
 */
export function applyModelOutput(items: ModelAnnotation[], regions: Rect[]): PageAdditions {
  const now = Date.now();
  const out: PageAdditions = { annotations: [], texts: [], maths: [] };
  items.forEach((a, i) => {
    const region = regions[a.image] ?? regions[regions.length - 1];
    if (!region) return;
    const [ymin, xmin, ymax, xmax] = a.box;
    const rect: Rect = {
      x: region.x + (xmin / 1000) * region.w,
      y: region.y + (ymin / 1000) * region.h,
      w: ((xmax - xmin) / 1000) * region.w,
      h: ((ymax - ymin) / 1000) * region.h,
    };
    const color = AI_COLORS[a.color ?? (a.kind === 'check' ? 'green' : a.kind === 'text' || a.kind === 'math' ? 'blue' : 'red')] ?? AI_COLORS.red;

    if (a.kind === 'text') {
      if (a.text?.trim()) out.texts.push({ id: uid(), x: rect.x, y: rect.y, width: Math.max(220, rect.w), text: a.text, color });
    } else if (a.kind === 'math') {
      const latex = a.text?.trim().replace(/^\$+|\$+$/g, ''); // tolerate stray $ delimiters
      if (latex) out.maths.push({ id: uid(), x: rect.x, y: rect.y, w: Math.max(120, rect.w), h: Math.max(44, rect.h), latex, color });
    } else {
      out.annotations.push({
        id: uid(),
        kind: a.kind,
        color: a.kind === 'highlight' ? AI_COLORS[a.color ?? 'orange'] ?? AI_COLORS.orange : color,
        text: a.text,
        rect,
        from: a.from ? [region.x + (a.from[1] / 1000) * region.w, region.y + (a.from[0] / 1000) * region.h] : undefined,
        createdAt: now + i * 350, // stagger the draw-in animation
      });
    }
  });
  return out;
}

// Deterministic wobble so AI ink looks hand-drawn but doesn't jitter on re-render.
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** Hand-drawn style path for an annotation. `note` has no path (rendered as text). */
export function annotationPath(a: Annotation): SkPath | null {
  const r = rng(a.id);
  const j = (amt: number) => (r() - 0.5) * 2 * amt;
  const { x, y, w, h } = a.rect;
  const p = Skia.PathBuilder.Make();

  switch (a.kind) {
    case 'circle': {
      const cx = x + w / 2, cy = y + h / 2;
      const rx = w / 2 + 12, ry = h / 2 + 10;
      const start = -Math.PI * 0.6 + j(0.3);
      const turns = 1.12; // overshoot like a real pen loop
      const steps = 64;
      for (let i = 0; i <= steps; i++) {
        const t = start + (i / steps) * Math.PI * 2 * turns;
        const wob = 1 + Math.sin(i * 0.35) * 0.03 + (i / steps) * 0.06;
        const px = cx + Math.cos(t) * rx * wob;
        const py = cy + Math.sin(t) * ry * wob;
        if (i === 0) p.moveTo(px, py);
        else p.lineTo(px, py);
      }
      return p.detach();
    }
    case 'box': {
      const pad = 8;
      const pts = [
        [x - pad + j(3), y - pad + j(3)],
        [x + w + pad + j(3), y - pad + j(3)],
        [x + w + pad + j(3), y + h + pad + j(3)],
        [x - pad + j(3), y + h + pad + j(3)],
        [x - pad + j(3), y - pad - 4 + j(3)],
      ];
      p.moveTo(pts[0][0], pts[0][1]);
      pts.slice(1).forEach(([px, py]) => p.lineTo(px, py));
      return p.detach();
    }
    case 'underline':
    case 'strike': {
      const ly = a.kind === 'underline' ? y + h + 6 : y + h / 2;
      p.moveTo(x - 4, ly + j(2));
      p.quadTo(x + w / 2, ly + j(5), x + w + 6, ly + j(3));
      if (a.kind === 'underline') {
        p.moveTo(x + 4, ly + 6 + j(2));
        p.quadTo(x + w / 2, ly + 5 + j(4), x + w - 4, ly + 7 + j(2));
      }
      return p.detach();
    }
    case 'check': {
      const s = Math.max(16, Math.min(40, h));
      const bx = x + w + 10, by = y + h / 2;
      p.moveTo(bx, by);
      p.lineTo(bx + s * 0.35, by + s * 0.4);
      p.lineTo(bx + s, by - s * 0.55);
      return p.detach();
    }
    case 'cross': {
      const s = Math.max(16, Math.min(36, h));
      const bx = x + w + 10, by = y + h / 2 - s / 2;
      p.moveTo(bx, by);
      p.lineTo(bx + s, by + s);
      p.moveTo(bx + s, by);
      p.lineTo(bx, by + s);
      return p.detach();
    }
    case 'highlight': {
      const pad = 4;
      p.addRRect(Skia.RRectXY(Skia.XYWHRect(x - pad, y - pad, w + pad * 2, h + pad * 2), 6, 6));
      return p.detach();
    }
    case 'arrow': {
      // From `from` (or the left of the box) to the nearest point on the box edge, with a slight curve.
      const [fx, fy] = a.from ?? [x - 80, y + h / 2];
      const tx = Math.max(x - 6, Math.min(fx, x + w + 6));
      const ty = Math.max(y - 6, Math.min(fy, y + h + 6));
      const [ex, ey] = fx >= x && fx <= x + w && fy >= y && fy <= y + h ? [x + w / 2, y + h / 2] : [tx, ty];
      const mx = (fx + ex) / 2 + j(20), my = (fy + ey) / 2 + j(20);
      p.moveTo(fx, fy);
      p.quadTo(mx, my, ex, ey);
      const ang = Math.atan2(ey - my, ex - mx);
      const head = 14;
      p.moveTo(ex - head * Math.cos(ang - 0.45), ey - head * Math.sin(ang - 0.45));
      p.lineTo(ex, ey);
      p.lineTo(ex - head * Math.cos(ang + 0.45), ey - head * Math.sin(ang + 0.45));
      return p.detach();
    }
    default:
      return null;
  }
}
