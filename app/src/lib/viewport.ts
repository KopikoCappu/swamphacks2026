import { useSharedValue, type SharedValue } from 'react-native-reanimated';

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 6;

/** Zoom/pan of the infinite canvas: screen = page * scale + (tx, ty). Shared values so Skia redraws without React re-renders. */
export type Viewport = { scale: SharedValue<number>; tx: SharedValue<number>; ty: SharedValue<number> };

export function useViewport(): Viewport {
  return { scale: useSharedValue(1), tx: useSharedValue(0), ty: useSharedValue(0) };
}

export const clampZoom = (s: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s));

/** Screen point -> page point. */
export function toPage(vp: Viewport, x: number, y: number): [number, number] {
  const s = vp.scale.get();
  return [(x - vp.tx.get()) / s, (y - vp.ty.get()) / s];
}

/** Zoom to `scale`, keeping the page point under screen (fx, fy) fixed. */
export function zoomAt(vp: Viewport, scale: number, fx: number, fy: number) {
  const s = clampZoom(scale);
  const [px, py] = toPage(vp, fx, fy);
  vp.scale.set(s);
  vp.tx.set(fx - px * s);
  vp.ty.set(fy - py * s);
}

export function resetViewport(vp: Viewport) {
  vp.scale.set(1);
  vp.tx.set(0);
  vp.ty.set(0);
}
