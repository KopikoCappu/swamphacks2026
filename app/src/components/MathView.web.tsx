import { useMemo } from 'react';
import { renderMath } from '@/lib/richtext.web';
import type { MathViewProps } from './MathView';

/** A LaTeX equation rendered with KaTeX (web). Real DOM text, so it stays crisp at any zoom. */
export function MathView({ latex, color, fontSize = 24 }: MathViewProps) {
  const html = useMemo(() => renderMath(latex, true), [latex]);
  return <div style={{ color, fontSize, whiteSpace: 'nowrap', lineHeight: 1.2 }} dangerouslySetInnerHTML={{ __html: html }} />;
}
