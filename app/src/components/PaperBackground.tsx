import { Path, Skia } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { LINE_SPACING } from '@/lib/ink';
import type { Paper } from '@/lib/types';
import type { Viewport } from '@/lib/viewport';

export const PAGE_COLORS = [
  { id: '#FFFFFF', label: 'White' },
  { id: '#FAF6EC', label: 'Cream' },
  { id: '#F1F1EF', label: 'Grey' },
  { id: '#1F1F22', label: 'Dark' },
];

export function isDark(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}

type Props = { paper: Paper; bg: string; width: number; height: number; viewport: Viewport };

/**
 * Lines / grid / dots for the infinite canvas. Only the visible area is generated, recomputed as the
 * viewport moves. Drawn inside the zoomed group, in page space. Never included in AI snapshots.
 */
export function PaperBackground({ paper, bg, width, height, viewport }: Props) {
  const { scale, tx, ty } = viewport;
  const color = isDark(bg) ? 'rgba(255,255,255,0.10)' : paper === 'dots' ? 'rgba(0,0,0,0.16)' : 'rgba(0,0,0,0.07)';

  const path = useDerivedValue(() => {
    const b = Skia.PathBuilder.Make();
    if (paper === 'blank' || !width || !height) return b.detach();
    const s = scale.value;
    const x0 = -tx.value / s, y0 = -ty.value / s;
    const x1 = x0 + width / s, y1 = y0 + height / s;
    const step = LINE_SPACING;
    const startX = Math.floor(x0 / step) * step;
    const startY = Math.floor(y0 / step) * step;

    if (paper === 'dots') {
      if (s < 0.45) return b.detach(); // too dense to be useful
      const r = 1.3 / Math.min(s, 1.5);
      for (let y = startY; y <= y1; y += step) for (let x = startX; x <= x1; x += step) b.addCircle(x, y, r);
      return b.detach();
    }
    for (let y = startY; y <= y1; y += step) {
      b.moveTo(x0, y);
      b.lineTo(x1, y);
    }
    if (paper === 'grid') {
      for (let x = startX; x <= x1; x += step) {
        b.moveTo(x, y0);
        b.lineTo(x, y1);
      }
    }
    return b.detach();
  }, [paper, width, height]);

  // Keep lines ~1 screen pixel wide at any zoom.
  const strokeWidth = useDerivedValue(() => 1 / scale.value);

  if (paper === 'blank') return null;
  return paper === 'dots' ? <Path path={path} color={color} /> : <Path path={path} color={color} style="stroke" strokeWidth={strokeWidth} />;
}
