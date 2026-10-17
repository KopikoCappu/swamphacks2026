import { strokeBounds, textBounds, mathBounds, unionRects } from './ink';
import type { Page, Rect } from './types';
import { clampZoom, type Viewport } from './viewport';

/** US Letter at 96 dpi (8.5 × 11 in). All page content lives in this coordinate space. */
export const PAGE_W = 816;
export const PAGE_H = 1056;
/** Grey "desk" gap between stacked pages. */
export const PAGE_GAP = 40;
/** Desk margin around the document when it's fitted to the screen. */
export const DESK_PAD = 24;

export const pageTop = (i: number) => i * (PAGE_H + PAGE_GAP);
export const pageRect = (i: number): Rect => ({ x: 0, y: pageTop(i), w: PAGE_W, h: PAGE_H });
export const docHeight = (count: number) => count * PAGE_H + (count - 1) * PAGE_GAP;

/** Pages in a note: what the user added, or more if existing content reaches further down. */
export function pageCountFor(page: Page): number {
  const bounds = unionRects([
    ...page.strokes.map(strokeBounds),
    ...page.texts.map(textBounds),
    ...(page.maths ?? []).map(mathBounds),
    ...page.images,
  ]);
  const needed = bounds ? Math.floor(Math.max(0, bounds.y + bounds.h - 1) / (PAGE_H + PAGE_GAP)) + 1 : 1;
  return Math.max(page.pageCount ?? 1, needed);
}

/** Zoom that fits a page's width to the screen (never above 100% on big screens). */
export const fitScale = (viewW: number) => clampZoom(Math.min(1.25, (viewW - DESK_PAD * 2) / PAGE_W));

/** Fit the page width to the screen and scroll to the top of `pageIndex`. */
export function fitToWidth(vp: Viewport, viewW: number, pageIndex = 0) {
  const s = fitScale(viewW);
  vp.scale.set(s);
  vp.tx.set((viewW - PAGE_W * s) / 2);
  vp.ty.set(DESK_PAD - pageTop(pageIndex) * s);
}

/**
 * Keep the document on screen: center it horizontally when it's narrower than the view, otherwise stop
 * panning at its edges (+ a little desk); vertically stop just past the first and last page.
 */
export function clampViewport(vp: Viewport, viewW: number, viewH: number, pageCount: number) {
  if (!viewW || !viewH) return;
  const s = vp.scale.get();
  const docW = PAGE_W * s;
  const docH = docHeight(pageCount) * s;
  const pad = DESK_PAD;

  const tx = vp.tx.get();
  if (docW + pad * 2 <= viewW) vp.tx.set((viewW - docW) / 2);
  else vp.tx.set(Math.min(pad, Math.max(viewW - docW - pad, tx)));

  const ty = vp.ty.get();
  const minTy = Math.min(pad, viewH - docH - viewH * 0.4); // allow scrolling a bit past the last page
  vp.ty.set(Math.min(pad, Math.max(minTy, ty)));
}

/** Which page is at the vertical center of the screen (0-based). */
export function pageAtCenter(ty: number, scale: number, viewH: number, pageCount: number) {
  'worklet'; // also runs inside Reanimated reactions (UI thread on native)
  const y = (viewH / 2 - ty) / scale;
  return Math.min(pageCount - 1, Math.max(0, Math.floor(y / (PAGE_H + PAGE_GAP))));
}

/** First ruled line from the top of each page (see PaperBackground). */
export const RULE_TOP = 96;

/** Top of a text block whose first line sits on the ruled line nearest to page-space y. */
export function snapToRule(y: number, lineSpacing: number) {
  const stride = PAGE_H + PAGE_GAP;
  const top = Math.max(0, Math.floor(y / stride)) * stride;
  const n = Math.max(0, Math.round((y - top - RULE_TOP) / lineSpacing));
  return top + RULE_TOP + n * lineSpacing - lineSpacing + 4;
}
