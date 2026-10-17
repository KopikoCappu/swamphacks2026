import { useMemo } from 'react';
import { MathWebView } from '@/components/MathWebView';
import { renderMath } from '@/lib/katexRender';
import { C } from '@/lib/theme';

export type MathViewProps = { latex: string; color?: string; fontSize?: number };

/** A LaTeX equation on the page (native: KaTeX in a WebView). The web build uses MathView.web.tsx. */
export function MathView({ latex, color, fontSize = 24 }: MathViewProps) {
  const html = useMemo(() => renderMath(latex, true), [latex]);
  return <MathWebView html={html} color={color ?? C.text} fontSize={fontSize} inline />;
}
