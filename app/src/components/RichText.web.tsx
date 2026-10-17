import { useMemo } from 'react';
import { renderRich } from '@/lib/richtext.web';
import type { RichTextProps } from './RichText';

/** Markdown + LaTeX (KaTeX) for chat messages on web. */
export function RichText({ text, color }: RichTextProps) {
  const html = useMemo(() => renderRich(text), [text]);
  return <div className="ib-rich" style={{ color }} dangerouslySetInnerHTML={{ __html: html }} />;
}
