import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AgentPanel } from '@/components/AgentPanel';
import { InkCanvas } from '@/components/InkCanvas';
import { Toolbar } from '@/components/Toolbar';
import { uid } from '@/lib/ink';
import { renderSelection } from '@/lib/snapshot';
import { useStore } from '@/lib/store';
import type { Chip, Selection } from '@/lib/types';

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const page = useStore((s) => s.pages[id]);
  const updatePage = useStore((s) => s.updatePage);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [chips, setChips] = useState<Chip[]>([]);
  const [agentOpen, setAgentOpen] = useState(false);

  if (!page) return <Text style={{ padding: 24 }}>Note not found.</Text>;

  function addSelectionToAI() {
    if (!selection) return;
    setChips([...chips, renderSelection(useStore.getState().pages[id], selection)]);
    setSelection(null);
    setAgentOpen(true);
  }

  async function addImage(source: 'camera' | 'library') {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], base64: true, quality: 0.6 };
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const asset = res.canceled ? null : res.assets[0];
    if (!asset?.base64) return;
    const w = Math.min(480, asset.width);
    const h = (asset.height / asset.width) * w;
    updatePage(id, (p) => ({ images: [...p.images, { id: uid(), x: 40, y: 40, w, h, base64: asset.base64! }] }), true);
  }

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <TextInput
              value={page.title}
              onChangeText={(title) => updatePage(id, () => ({ title }))}
              style={styles.title}
              placeholder="Untitled"
            />
          ),
        }}
      />
      <Toolbar pageId={id} agentOpen={agentOpen} onToggleAgent={() => setAgentOpen(!agentOpen)} onAddImage={addImage} />
      <View style={styles.body}>
        <View style={{ flex: 1 }}>
          <InkCanvas pageId={id} selection={selection} onSelectionChange={setSelection} />
          {selection && (
            <Pressable
              style={[styles.askBtn, { left: selection.bounds.x + selection.bounds.w - 120, top: selection.bounds.y + selection.bounds.h + 20 }]}
              onPress={addSelectionToAI}
            >
              <Text style={styles.askText}>✨ Add to AI</Text>
            </Pressable>
          )}
        </View>
        {agentOpen && <AgentPanel pageId={id} chips={chips} setChips={setChips} onClose={() => setAgentOpen(false)} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFDF8' },
  body: { flex: 1, flexDirection: 'row' },
  title: { fontSize: 18, fontWeight: '700', minWidth: 200, color: '#1F2328' },
  askBtn: {
    position: 'absolute',
    backgroundColor: '#6E56CF',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  askText: { color: 'white', fontWeight: '700' },
});
