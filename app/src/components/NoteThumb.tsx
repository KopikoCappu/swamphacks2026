import { Canvas, Group, Path, type Transforms3d } from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { strokeBounds, strokePath, unionRects } from '@/lib/ink';
import type { Page } from '@/lib/types';

const PAD = 14;

/** Small live preview of a page's ink for the notes grid. */
export function NoteThumb({ page }: { page: Page }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const bounds = unionRects(page.strokes.map(strokeBounds));

  let transform: Transforms3d = [];
  if (bounds && size.width) {
    // Fit the ink, but never blow up a tiny doodle past ~half size.
    const s = Math.min((size.width - PAD * 2) / Math.max(bounds.w, 1), (size.height - PAD * 2) / Math.max(bounds.h, 1), 0.5);
    transform = [{ translateX: PAD - bounds.x * s }, { translateY: PAD - bounds.y * s }, { scale: s }];
  }

  return (
    <View testID="note-thumb-view" style={[StyleSheet.absoluteFill, { backgroundColor: page.bg ?? '#FFFFFF' }]} onLayout={(e) => setSize(e.nativeEvent.layout)}>
      {bounds && size.width > 0 && (
        <Canvas style={StyleSheet.absoluteFill}>
          <Group transform={transform}>
            {page.strokes.map((s) =>
              s.tool === 'pen' ? (
                <Path key={s.id} path={strokePath(s)} color={s.color} />
              ) : (
                <Path key={s.id} path={strokePath(s)} color={s.color} opacity={s.tool === 'highlighter' ? 0.35 : 1} style="stroke" strokeWidth={s.size} strokeCap="round" strokeJoin="round" />
              ),
            )}
          </Group>
        </Canvas>
      )}
    </View>
  );
}
