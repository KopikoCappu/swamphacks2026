import './src/styles/global.css';

// Skia on web needs CanvasKit (WASM) loaded before any Skia module is evaluated,
// so the router (and every screen that imports Skia) is required only after it's ready.
// Metro evaluates modules lazily on require(), so this defers the whole app.
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web/LoadSkiaWeb';

// The app handles pinch/pan itself — stop the browser from zooming or scrolling the page instead.
if (typeof document !== 'undefined') {
  let meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'viewport');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
  // KaTeX styles + fonts for rendered math (chat and on-page equations). Version matches package.json.
  const katexCss = document.createElement('link');
  katexCss.rel = 'stylesheet';
  katexCss.href = 'https://cdn.jsdelivr.net/npm/katex@0.19.0/dist/katex.min.css';
  document.head.appendChild(katexCss);
}

LoadSkiaWeb({ locateFile: (file) => `/${file}` }).then(() => {
  require('expo-router/entry');
});
