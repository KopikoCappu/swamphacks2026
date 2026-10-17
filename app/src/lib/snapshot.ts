import { ImageFormat, PaintStyle, Skia, StrokeCap, StrokeJoin, type SkImage } from '@shopify/react-native-skia';
import { mathBounds, strokeBounds, strokePath, textBounds } from './ink';
import type { Chip, Include, Page, PageImage, Rect, Selection } from './types';

const PADDING = 24; // page points of whitespace around a selection
const TARGET_LONG_SIDE = 1600; // px — plenty for handwriting, well under API image limits
const MAX_SCALE = 4;

export type RenderedImage = { base64: string; width: number; height: number };

const imageCache = new Map<string, SkImage | null>();

/** Decode a page image once and reuse it (used by both the live canvas and snapshots). */
export function skImageFor(img: PageImage): SkImage | null {
  if (!imageCache.has(img.id)) {
    imageCache.set(img.id, Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(img.base64)));
  }
  return imageCache.get(img.id) ?? null;
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Re-render page content inside `region` from the raw vectors, at high resolution on the page color
 * (no paper lines). This is the whole point of the app: the model gets crisp ink instead of a blurry screenshot.
 */
export function renderRegion(
  page: Page,
  region: Rect,
  opts: { strokeIds?: string[]; imageIds?: string[]; longSide?: number; maxScale?: number } = {},
): RenderedImage | null {
  const strokes = page.strokes.filter((s) => (opts.strokeIds ? opts.strokeIds.includes(s.id) : overlaps(strokeBounds(s), region)));
  const images = page.images.filter((i) => (opts.imageIds ? opts.imageIds.includes(i.id) : overlaps(i, region)));

  const scale = Math.min(opts.maxScale ?? MAX_SCALE, (opts.longSide ?? TARGET_LONG_SIDE) / Math.max(region.w, region.h));
  const width = Math.max(1, Math.round(region.w * scale));
  const height = Math.max(1, Math.round(region.h * scale));

  const surface = Skia.Surface.Make(width, height) ?? Skia.Surface.MakeOffscreen(width, height);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  canvas.drawColor(Skia.Color(page.bg ?? '#FFFFFF'));
  canvas.scale(scale, scale);
  canvas.translate(-region.x, -region.y);

  const imgPaint = Skia.Paint();
  for (const im of images) {
    const sk = skImageFor(im);
    if (sk) canvas.drawImageRect(sk, Skia.XYWHRect(0, 0, sk.width(), sk.height()), Skia.XYWHRect(im.x, im.y, im.w, im.h), imgPaint);
  }

  for (const s of strokes) {
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setColor(Skia.Color(s.color));
    if (s.tool !== 'pen') {
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(s.size);
      paint.setStrokeCap(StrokeCap.Round);
      paint.setStrokeJoin(StrokeJoin.Round);
      if (s.tool === 'highlighter') paint.setAlphaf(0.35);
    } else {
      paint.setStyle(PaintStyle.Fill);
    }
    canvas.drawPath(strokePath(s), paint);
  }

  surface.flush();
  return { base64: surface.makeImageSnapshot().encodeToBase64(ImageFormat.PNG, 100), width, height };
}

const ALL: Include = { ink: true, images: true, text: true };

/**
 * A selection → chip, split into layers so Claude reads each cleanly:
 * - ink: just the strokes, nothing behind them
 * - images: each selected image at its stored (original) resolution
 * - combined: ink + images together, only when ink actually overlaps an image (e.g. labels on a diagram)
 * - text: typed text and LaTeX as exact text (never rasterized)
 */
export function renderSelection(page: Page, sel: Selection, include: Include = ALL, label?: string): Chip {
  const region: Rect = {
    x: sel.bounds.x - PADDING,
    y: sel.bounds.y - PADDING,
    w: sel.bounds.w + PADDING * 2,
    h: sel.bounds.h + PADDING * 2,
  };
  const chip: Chip = { id: Math.random().toString(36).slice(2), bounds: region, label };

  if (include.text) {
    const typed = [
      ...page.texts.filter((t) => sel.textIds.includes(t.id) && t.text.trim()).map((t) => ({ y: t.y, x: t.x, s: t.text })),
      ...(page.maths ?? []).filter((m) => sel.mathIds.includes(m.id)).map((m) => ({ y: m.y, x: m.x, s: `$$${m.latex}$$` })),
    ]
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((t) => t.s)
      .join('\n');
    if (typed) chip.text = typed;
  }

  const strokes = include.ink ? sel.strokeIds : [];
  const images = include.images ? page.images.filter((i) => sel.imageIds.includes(i.id)) : [];

  if (strokes.length) chip.ink = renderRegion(page, region, { strokeIds: strokes, imageIds: [] }) ?? undefined;
  if (images.length) {
    chip.images = images.map((im) => {
      const sk = skImageFor(im);
      return { base64: im.base64, mime: im.mime ?? 'image/jpeg', width: sk?.width() ?? Math.round(im.w), height: sk?.height() ?? Math.round(im.h), region: { x: im.x, y: im.y, w: im.w, h: im.h } };
    });
    const inkOnImage = page.strokes.some((s) => strokes.includes(s.id) && images.some((im) => overlaps(strokeBounds(s), im)));
    if (inkOnImage) chip.combined = renderRegion(page, region, { strokeIds: strokes, imageIds: images.map((i) => i.id) }) ?? undefined;
  }
  return chip;
}

/** Downscale an imported photo once, on insert: sharp enough for the AI, small enough to send and store. */
export function prepareImage(base64: string, maxSide = 2048): { base64: string; width: number; height: number; mime: string } | null {
  const img = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(base64));
  if (!img) return null;
  const scale = Math.min(1, maxSide / Math.max(img.width(), img.height()));
  const width = Math.round(img.width() * scale);
  const height = Math.round(img.height() * scale);
  const surface = Skia.Surface.Make(width, height) ?? Skia.Surface.MakeOffscreen(width, height);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  canvas.drawColor(Skia.Color('white'));
  canvas.drawImageRect(img, Skia.XYWHRect(0, 0, img.width(), img.height()), Skia.XYWHRect(0, 0, width, height), Skia.Paint());
  surface.flush();
  return { base64: surface.makeImageSnapshot().encodeToBase64(ImageFormat.JPEG, 85), width, height, mime: 'image/jpeg' };
}

/**
 * What's on screen right now: an image of the ink plus a text list of typed text / equations with their
 * normalized positions, so the model can place writing anywhere visible even without a selection.
 */
export function renderPageView(page: Page, view: Rect): { image: RenderedImage | null; context: string } {
  const image = renderRegion(page, view, { longSide: 1280, maxScale: 2 });
  const norm = (x: number, y: number) => `[y=${Math.round(((y - view.y) / view.h) * 1000)}, x=${Math.round(((x - view.x) / view.w) * 1000)}]`;
  const lines = [
    ...page.texts.filter((t) => t.text.trim() && overlaps(textBounds(t), view)).map((t) => `- typed text at ${norm(t.x, t.y)}: ${JSON.stringify(t.text)}`),
    ...(page.maths ?? []).filter((m) => overlaps(mathBounds(m), view)).map((m) => `- equation at ${norm(m.x, m.y)}: $$${m.latex}$$`),
  ];
  return { image, context: lines.length ? `Typed content visible on the page view (positions on the page view image):\n${lines.join('\n')}` : '' };
}
