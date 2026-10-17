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

  const style = document.createElement('style');
  style.textContent = `
    html, body { touch-action: none; overscroll-behavior: none; }
    .ib-rich { font: 15px/22px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1C1C1E; overflow-wrap: anywhere; }
    .ib-rich p { margin: 0 0 8px; }
    .ib-rich p:last-child { margin-bottom: 0; }
    .ib-rich ul, .ib-rich ol { margin: 0 0 8px; padding-left: 20px; }
    .ib-rich code { font-family: ui-monospace, Menlo, monospace; font-size: 13px; background: rgba(0,0,0,0.05); padding: 1px 4px; border-radius: 4px; }
    .ib-rich pre { background: rgba(0,0,0,0.05); padding: 10px; border-radius: 8px; overflow-x: auto; }
    .ib-rich .katex-display { margin: 8px 0; overflow-x: auto; overflow-y: hidden; }
    .ib-rich h1, .ib-rich h2, .ib-rich h3 { font-size: 15px; margin: 8px 0 4px; }
  `;
  document.head.appendChild(style);
}

LoadSkiaWeb({ locateFile: (file) => `/${file}` }).then(() => {
  require('expo-router/entry');
});
