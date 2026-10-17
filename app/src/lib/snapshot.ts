import { ImageFormat, PaintStyle, Skia, StrokeCap, StrokeJoin, type SkImage } from '@shopify/react-native-skia';
import { strokePath } from './ink';
import type { Chip, Page, PageImage, Rect, Selection } from './types';

const PADDING = 24; // page points of whitespace around the selection
const TARGET_LONG_SIDE = 1600; // px — plenty for handwriting, well under API image limits
const MAX_SCALE = 4;

const imageCache = new Map<string, SkImage | null>();

/** Decode a page image once and reuse it (used by both the live canvas and snapshots). */
export function skImageFor(img: PageImage): SkImage | null {
  if (!imageCache.has(img.id)) {
    imageCache.set(img.id, Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(img.base64)));
  }
  return imageCache.get(img.id) ?? null;
}

/**
 * Re-render ONLY the selected strokes/images at high resolution on the page color (no paper lines).
 * This is the whole point of the app: the model gets vector-crisp ink instead of a blurry screenshot.
 */
export function renderSelection(page: Page, sel: Selection): Chip {
  const region: Rect = {
    x: sel.bounds.x - PADDING,
    y: sel.bounds.y - PADDING,
    w: sel.bounds.w + PADDING * 2,
    h: sel.bounds.h + PADDING * 2,
  };

  const text = page.texts
    .filter((t) => sel.textIds.includes(t.id) && t.text.trim())
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((t) => t.text)
    .join('\n');

  const strokes = page.strokes.filter((s) => sel.strokeIds.includes(s.id));
  const images = page.images.filter((i) => sel.imageIds.includes(i.id));
  const chip: Chip = { id: Math.random().toString(36).slice(2), bounds: region, text: text || undefined };
  if (!strokes.length && !images.length) return chip;

  const scale = Math.min(MAX_SCALE, Math.max(1, TARGET_LONG_SIDE / Math.max(region.w, region.h)));
  const width = Math.round(region.w * scale);
  const height = Math.round(region.h * scale);

  const surface = Skia.Surface.Make(width, height) ?? Skia.Surface.MakeOffscreen(width, height);
  if (!surface) throw new Error('Could not create Skia surface');
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
  const base64 = surface.makeImageSnapshot().encodeToBase64(ImageFormat.PNG, 100);
  return { ...chip, image: { base64, width, height } };
}
