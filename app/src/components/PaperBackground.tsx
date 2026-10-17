import { Path, Skia } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { LINE_SPACING } from '@/lib/ink';
import { PAGE_GAP, PAGE_H, PAGE_W, RULE_TOP } from '@/lib/pages';
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

/** Desk color behind the pages. */
export const deskColor = (bg: string) => (isDark(bg) ? '#0E0E10' : '#E7E7E3');


const RULE_BOTTOM = 48; // keep the last line off the page edge

type Props = { paper: Paper; bg: string; pageCount: number; width: number; height: number; viewport: Viewport };

/**
 * The stacked Letter pages: sheets (with a soft edge) plus lines / grid / dots inside each page.
 * Only pages in view are generated; drawn inside the zoomed group (page space). Never in AI snapshots.
 */
export function PaperBackground({ paper, bg, pageCount, width, height, viewport }: Props) {
  const { scale, ty } = viewport;
  const dark = isDark(bg);
  const lineColor = dark ? 'rgba(255,255,255,0.10)' : paper === 'dots' ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.08)';

  // Which pages intersect the screen.
  const visible = useDerivedValue(() => {
    const s = scale.get();
    const y0 = -ty.get() / s;
    const y1 = y0 + height / s;
    const stride = PAGE_H + PAGE_GAP;
    const first = Math.max(0, Math.floor(y0 / stride));
    const last = Math.min(pageCount - 1, Math.floor(y1 / stride));
    return [first, last];
  }, [height, pageCount]);

  const sheets = useDerivedValue(() => {
    const b = Skia.PathBuilder.Make();
    const [first, last] = visible.get();
    for (let i = first; i <= last; i++) b.addRect(Skia.XYWHRect(0, i * (PAGE_H + PAGE_GAP), PAGE_W, PAGE_H));
    return b.detach();
  });

  const pattern = useDerivedValue(() => {
    const b = Skia.PathBuilder.Make();
    if (paper === 'blank' || !width || !height) return b.detach();
    const [first, last] = visible.get();
    const step = LINE_SPACING;
    for (let i = first; i <= last; i++) {
      const top = i * (PAGE_H + PAGE_GAP);
      if (paper === 'lined') {
        for (let y = top + RULE_TOP; y <= top + PAGE_H - RULE_BOTTOM; y += step) {
          b.moveTo(0, y);
          b.lineTo(PAGE_W, y);
        }
      } else if (paper === 'grid') {
        for (let y = top + step; y < top + PAGE_H; y += step) {
          b.moveTo(0, y);
          b.lineTo(PAGE_W, y);
        }
        for (let x = step; x < PAGE_W; x += step) {
          b.moveTo(x, top);
          b.lineTo(x, top + PAGE_H);
        }
      } else if (paper === 'dots' && scale.get() >= 0.35) {
        for (let y = top + step; y < top + PAGE_H; y += step) for (let x = step; x < PAGE_W; x += step) b.addCircle(x, y, 1.3);
      }
    }
    return b.detach();
  }, [paper, width, height]);

  // Keep hairlines ~1 screen pixel at any zoom.
  const hairline = useDerivedValue(() => 1 / scale.get());

  return (
    <>
      {/* soft edge under each sheet */}
      <Path path={sheets} color={dark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.10)'} style="stroke" strokeWidth={hairline} />
      <Path path={sheets} color={bg} />
      {paper === 'dots' ? (
        <Path path={pattern} color={lineColor} />
      ) : (
        paper !== 'blank' && <Path path={pattern} color={lineColor} style="stroke" strokeWidth={hairline} />
      )}
    </>
  );
}
