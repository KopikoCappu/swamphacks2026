import DOMPurify from 'dompurify';
import { renderMarkdownMath } from './katexRender';

export { renderMath } from './katexRender';

/** Markdown + math → sanitized HTML for direct insertion into the DOM (web only). */
export function renderRich(md: string): string {
  return renderMarkdownMath(md, { sanitize: (html) => DOMPurify.sanitize(html) });
}
