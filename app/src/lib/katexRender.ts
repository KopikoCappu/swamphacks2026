import katex from 'katex';
import { marked } from 'marked';

/** Keep in sync with the katex version in package.json (also referenced in index.web.js). */
export const KATEX_CSS = 'https://cdn.jsdelivr.net/npm/katex@0.19.0/dist/katex.min.css';

const KATEX = { throwOnError: false, output: 'html' as const };

/** LaTeX → KaTeX HTML. `\displaystyle` keeps fractions full-size. */
export function renderMath(latex: string, display = false) {
  return katex.renderToString(display ? `\\displaystyle ${latex}` : latex, KATEX);
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Markdown + math → HTML. Math is pulled out first (so Markdown can't mangle `_` / `*` inside it), then
 * the Markdown is rendered and KaTeX output is put back. Model output is untrusted, so callers either
 * sanitize the HTML (web: DOMPurify) or escape raw HTML up front (native, where it renders in a locked-down WebView).
 */
export function renderMarkdownMath(md: string, opts: { sanitize?: (html: string) => string; escapeRaw?: boolean } = {}): string {
  const maths: string[] = [];
  const stash = (tex: string, display: boolean) => {
    maths.push(katex.renderToString(tex, { ...KATEX, displayMode: display }));
    return `MATHPH${maths.length - 1}X`;
  };
  let src = md
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, t: string) => stash(t, true))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, t: string) => stash(t, true))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, t: string) => stash(t, false))
    .replace(/\$([^\s$](?:[^$\n]*?[^\s$])?)\$/g, (_, t: string) => stash(t, false));
  if (opts.escapeRaw) src = escapeHtml(src);
  let html = marked.parse(src, { async: false, breaks: true });
  if (opts.sanitize) html = opts.sanitize(html);
  return html.replace(/MATHPH(\d+)X/g, (_, i: string) => maths[Number(i)] ?? '');
}
