import DOMPurify from 'dompurify';
import katex from 'katex';
import { marked } from 'marked';

const KATEX = { throwOnError: false, output: 'html' as const };

/** LaTeX → KaTeX HTML. `\displaystyle` keeps fractions full-size on the page. */
export function renderMath(latex: string, display = false) {
  return katex.renderToString(display ? `\\displaystyle ${latex}` : latex, KATEX);
}

/**
 * Markdown + math → safe HTML. Math is pulled out first (so Markdown can't mangle `_` / `*` inside it),
 * the Markdown HTML is sanitized (model output is untrusted), then KaTeX output is put back.
 */
export function renderRich(md: string): string {
  const maths: string[] = [];
  const stash = (tex: string, display: boolean) => {
    maths.push(katex.renderToString(tex, { ...KATEX, displayMode: display }));
    return `MATHPH${maths.length - 1}X`;
  };
  const withPlaceholders = md
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, t: string) => stash(t, true))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, t: string) => stash(t, true))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, t: string) => stash(t, false))
    .replace(/\$([^\s$](?:[^$\n]*?[^\s$])?)\$/g, (_, t: string) => stash(t, false));
  const html = DOMPurify.sanitize(marked.parse(withPlaceholders, { async: false, breaks: true }));
  return html.replace(/MATHPH(\d+)X/g, (_, i: string) => maths[Number(i)] ?? '');
}
