// Skia on web needs CanvasKit (WASM) loaded before any Skia module is evaluated,
// so the router (and every screen that imports Skia) loads only after it's ready.
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

LoadSkiaWeb({ locateFile: (file) => `/${file}` }).then(async () => {
  await import('expo-router/entry');
});
