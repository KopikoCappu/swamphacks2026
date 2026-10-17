import { Platform, Text } from 'react-native';

export type MathViewProps = { latex: string; color?: string; fontSize?: number };

/** Native fallback shows the LaTeX source; the web build (MathView.web.tsx) typesets it with KaTeX. */
export function MathView({ latex, color, fontSize = 20 }: MathViewProps) {
  return <Text testID="math-view-text" style={{ color, fontSize: fontSize * 0.8, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) }}>{latex}</Text>;
}
