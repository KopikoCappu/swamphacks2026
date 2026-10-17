import { Skia, type SkPath } from '@shopify/react-native-skia';
import { uid } from './ink';
import type { Annotation, AnnotationKind, Rect } from './types';

export const AI_COLORS: Record<string, string> = {
  red: '#E5484D',
  green: '#30A46C',
  blue: '#3E63DD',
  orange: '#F76B15',
};

export type ModelAnnotation = {
  kind: AnnotationKind;
  box: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
  text?: string;
  color?: keyof typeof AI_COLORS;
};

/** Map normalized model boxes (relative to the chip image) back into page space. */
export function toPageAnnotations(items: ModelAnnotation[], region: Rect): Annotation[] {
  const now = Date.now();
  return items.map((a, i) => {
    const [ymin, xmin, ymax, xmax] = a.box;
    return {
      id: uid(),
      kind: a.kind,
      color: AI_COLORS[a.color ?? (a.kind === 'check' ? 'green' : 'red')] ?? AI_COLORS.red,
      text: a.text,
      rect: {
        x: region.x + (xmin / 1000) * region.w,
        y: region.y + (ymin / 1000) * region.h,
        w: ((xmax - xmin) / 1000) * region.w,
        h: ((ymax - ymin) / 1000) * region.h,
      },
      createdAt: now + i * 350, // stagger the draw-in animation
    };
  });
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
    default:
      return null;
  }
}
