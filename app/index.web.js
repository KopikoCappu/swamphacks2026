// Skia on web needs CanvasKit (WASM) loaded before any Skia module is evaluated,
// so the router (and every screen that imports Skia) is required only after it's ready.
// Metro evaluates modules lazily on require(), so this defers the whole app.
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web/LoadSkiaWeb';

LoadSkiaWeb({ locateFile: (file) => `/${file}` }).then(() => {
  require('expo-router/entry');
});
