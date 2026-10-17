import { StyleSheet, Text } from 'react-native';
import { C } from '@/lib/theme';

export type RichTextProps = { text: string; color?: string };

/**
 * Native fallback: plain text with math delimiters stripped. The web build (RichText.web.tsx) renders
 * full Markdown + KaTeX. TODO: native rendering (react-native-markdown-display + a WebView/MathJax for math).
 */
export function RichText({ text, color }: RichTextProps) {
  const plain = text.replace(/\$\$?([^$]+)\$\$?/g, '$1');
  return <Text testID="rich-text-text" style={[styles.text, color ? { color } : null]}>{plain}</Text>;
}

const styles = StyleSheet.create({ text: { fontSize: 15, lineHeight: 22, color: C.text } });
