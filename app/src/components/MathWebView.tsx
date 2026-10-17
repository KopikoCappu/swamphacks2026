import { useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { KATEX_CSS } from '@/lib/katexRender';

type Props = {
  /** Pre-rendered HTML (KaTeX / Markdown). Raw model HTML must already be escaped. */
  html: string;
  color: string;
  fontSize: number;
  /** inline: size to the content's width too (equations); otherwise fill the width (chat). */
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
};

const BASE_CSS = `
  html, body { margin: 0; padding: 0; background: transparent; -webkit-text-size-adjust: 100%; }
  #c { font-family: -apple-system, Roboto, 'Segoe UI', sans-serif; overflow-wrap: anywhere; }
  #c.inline { display: inline-block; white-space: nowrap; }
  p { margin: 0 0 8px; } p:last-child { margin-bottom: 0; }
  ul, ol { margin: 0 0 8px; padding-left: 20px; }
  code { font-family: monospace; font-size: 0.87em; background: rgba(0,0,0,0.05); padding: 1px 4px; border-radius: 4px; }
  pre { background: rgba(0,0,0,0.05); padding: 10px; border-radius: 8px; overflow-x: auto; }
  .katex-display { margin: 8px 0; overflow-x: auto; overflow-y: hidden; }
  h1, h2, h3 { font-size: 1em; margin: 8px 0 4px; }
`;

// Reports the rendered size back to React Native (re-sent after KaTeX fonts load).
const MEASURE = `
  (function () {
    var el = document.getElementById('c');
    function post() {
      var r = el.getBoundingClientRect();
      window.ReactNativeWebView.postMessage(JSON.stringify({ w: Math.ceil(r.width), h: Math.ceil(r.height) }));
    }
    post();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(post);
    if (window.ResizeObserver) new ResizeObserver(post).observe(el);
    setTimeout(post, 400);
  })();
`;

/**
 * Native renderer for KaTeX/Markdown HTML: a transparent, non-scrolling WebView that sizes itself to its
 * content. Navigation is blocked, so links in model output can't go anywhere.
 */
export function MathWebView({ html, color, fontSize, inline, style }: Props) {
  const [size, setSize] = useState({ w: inline ? 40 : 0, h: Math.round(fontSize * 1.5) });
  const doc = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="${KATEX_CSS}"><style>${BASE_CSS} #c { color: ${color}; font-size: ${fontSize}px; line-height: 1.45; }</style></head>
<body><div id="c" class="${inline ? 'inline' : ''}">${html}</div><script>${MEASURE}</script></body></html>`;

  return (
    <WebView
      originWhitelist={['*']}
      source={{ html: doc }}
      style={[{ height: size.h, backgroundColor: 'transparent' }, inline && { width: size.w }, style]}
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      setSupportMultipleWindows={false}
      onShouldStartLoadWithRequest={(req) => req.url.startsWith('about:') || req.url.startsWith('data:')}
      onMessage={(e) => {
        try {
          const { w, h } = JSON.parse(e.nativeEvent.data) as { w: number; h: number };
          if (h > 0 && (Math.abs(h - size.h) > 1 || (inline && Math.abs(w - size.w) > 1))) setSize({ w: w + 2, h });
        } catch {
          // ignore malformed messages
        }
      }}
    />
  );
}
