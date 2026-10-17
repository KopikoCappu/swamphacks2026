import { Canvas, Group, Path } from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { strokePath } from '@/lib/ink';
import { PAGE_H, PAGE_W } from '@/lib/pages';
import type { Page } from '@/lib/types';

/** Page 1 of a note, scaled down to the card (cards share the Letter page's aspect ratio). */
export function NoteThumb({ page }: { page: Page }) {
  const [width, setWidth] = useState(0);
  const s = width / PAGE_W;
  const firstPage = page.strokes.filter((st) => st.points.some(([, y]) => y < PAGE_H));

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: page.bg ?? '#FFFFFF' }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && firstPage.length > 0 && (
        <Canvas style={StyleSheet.absoluteFill}>
          <Group transform={[{ scale: s }]}>
            {firstPage.map((st) =>
              st.tool === 'pen' ? (
                <Path key={st.id} path={strokePath(st)} color={st.color} />
              ) : (
                <Path key={st.id} path={strokePath(st)} color={st.color} opacity={st.tool === 'highlighter' ? 0.35 : 1} style="stroke" strokeWidth={st.size} strokeCap="round" strokeJoin="round" />
              ),
            )}
          </Group>
        </Canvas>
      )}
    </View>
  );
}
