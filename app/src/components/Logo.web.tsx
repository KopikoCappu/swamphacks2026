import { useMemo } from 'react';
import { INK, logoSvg } from '@/lib/logo';

/**
 * Web version of the logo: a real vector <img> instead of a Skia canvas, so it stays sharp at any
 * browser zoom (a canvas is rasterized once at the initial pixel ratio and blurs when zoomed).
 */
export function Logo({ size = 32, color = INK }: { size?: number; color?: string }) {
  const src = useMemo(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logoSvg({ color }))}`, [color]);
  return <img src={src} width={size} height={size} alt="" draggable={false} style={{ display: 'block', pointerEvents: 'none', userSelect: 'none' }} />;
}
