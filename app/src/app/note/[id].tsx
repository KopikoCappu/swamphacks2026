import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AgentPanel } from '@/components/AgentPanel';
import { InkCanvas } from '@/components/InkCanvas';
import { SelectionBar } from '@/components/SelectionBar';
import { ColorMenu, MoreMenu, SideControls, TopBar, ZoomPill, type Menu } from '@/components/Toolbar';
import { selectAll, uid } from '@/lib/ink';
import { prepareImage, renderSelection } from '@/lib/snapshot';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import type { Chip, Include, Selection, Tool } from '@/lib/types';
import { resetViewport, useViewport, zoomAt } from '@/lib/viewport';

const ALL: Include = { ink: true, images: true, text: true };
const idsKey = (s: Selection | null) => (s ? [s.strokeIds, s.textIds, s.mathIds, s.imageIds].map((a) => a.join(',')).join('|') : '');

const TOOL_KEYS: Record<string, Tool> = { p: 'pen', h: 'highlighter', s: 'shape', e: 'eraser', l: 'lasso', t: 'text' };

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const page = useStore((s) => s.pages[id]);
  const updatePage = useStore((s) => s.updatePage);
  const [selection, setSelectionState] = useState<Selection | null>(null);
  const [include, setInclude] = useState<Include>(ALL);
  const [transforming, setTransforming] = useState(false);
  // New selection → send everything by default; moving/resizing the same items keeps the toggles.
  const setSelection = (s: Selection | null) => {
    if (idsKey(s) !== idsKey(selection)) setInclude(ALL);
    setSelectionState(s);
  };
  const [chips, setChips] = useState<Chip[]>([]);
  const [agentOpen, setAgentOpen] = useState(false);
  const [menu, setMenu] = useState<Menu>(null);
  const viewport = useViewport();
  const canvasSize = useRef({ width: 0, height: 0 });
  const center = (): [number, number] => [canvasSize.current.width / 2, canvasSize.current.height / 2];
  // Page-space rect currently on screen (sent to Claude as the "page view").
  const visibleRect = () => {
    const sc = viewport.scale.get();
    const { width, height } = canvasSize.current;
    return { x: -viewport.tx.get() / sc, y: -viewport.ty.get() / sc, w: Math.max(1, width) / sc, h: Math.max(1, height) / sc };
  };

  // Keyboard shortcuts (web / tablets with a keyboard): Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y, P H E L T, Esc
  useEffect(() => {
    if (Platform.OS !== 'web' || !id) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const { undoPage, redoPage, setTool } = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redoPage(id);
        else undoPage(id);
      } else if (mod && key === 'y') {
        e.preventDefault();
        redoPage(id);
      } else if (mod && (key === '=' || key === '+' || key === '-')) {
        e.preventDefault();
        zoomAt(viewport, viewport.scale.get() * (key === '-' ? 1 / 1.25 : 1.25), ...center());
      } else if (mod && key === '0') {
        e.preventDefault();
        resetViewport(viewport);
      } else if (!mod && TOOL_KEYS[key]) {
        setTool(TOOL_KEYS[key]);
      } else if (key === 'escape') {
        setSelection(null);
        setMenu(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!page) return <Text style={{ padding: 24 }}>Note not found.</Text>;

  function addSelectionToAI() {
    if (!selection) return;
    setChips([...chips, renderSelection(useStore.getState().pages[id], selection, include)]);
    setSelection(null);
    setAgentOpen(true);
  }

  function attachWholePage() {
    const p = useStore.getState().pages[id];
    const all = selectAll(p);
    if (all) setChips([...chips, renderSelection(p, all, ALL, 'whole page')]);
    setAgentOpen(true);
  }

  async function addImage(source: 'camera' | 'library') {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], base64: true, quality: 0.9 };
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const asset = res.canceled ? null : res.assets[0];
    if (!asset?.base64) return;
    // Store a downscaled copy (≤2048px): crisp for the AI, small enough to send and persist.
    const img = prepareImage(asset.base64) ?? { base64: asset.base64, width: asset.width, height: asset.height, mime: 'image/jpeg' };
    const view = visibleRect();
    const w = Math.min(view.w * 0.6, 480 / viewport.scale.get(), img.width);
    const h = (img.height / img.width) * w;
    const image = { id: uid(), x: view.x + (view.w - w) / 2, y: view.y + (view.h - h) / 2, w, h, base64: img.base64, mime: img.mime };
    updatePage(id, (p) => ({ images: [...p.images, image] }), true);
    // Select it right away so it can be moved/resized; switch to the lasso tool so the handles work.
    useStore.getState().setTool('lasso');
    setSelection({ strokeIds: [], textIds: [], mathIds: [], imageIds: [image.id], bounds: { x: image.x, y: image.y, w, h } });
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar pageId={id} agentOpen={agentOpen} onToggleAgent={() => setAgentOpen(!agentOpen)} menu={menu} setMenu={setMenu} />
      <View style={styles.body}>
        <View style={{ flex: 1 }} onLayout={(e) => (canvasSize.current = e.nativeEvent.layout)}>
          <InkCanvas pageId={id} selection={selection} onSelectionChange={setSelection} viewport={viewport} onTransformingChange={setTransforming} />
          <SideControls pageId={id} />
          <ZoomPill viewport={viewport} getCenter={center} />
          {selection && !transforming && (
            <SelectionBar
              pageId={id}
              selection={selection}
              viewport={viewport}
              include={include}
              setInclude={setInclude}
              onAsk={addSelectionToAI}
              onSelectionChange={setSelection}
            />
          )}
        </View>
        {agentOpen && (
          <AgentPanel pageId={id} chips={chips} setChips={setChips} onClose={() => setAgentOpen(false)} getView={visibleRect} onAttachPage={attachWholePage} />
        )}
      </View>

      {menu && (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(null)} />
          {menu === 'color' ? (
            <ColorMenu />
          ) : (
            <MoreMenu
              pageId={id}
              onAddImage={(src) => {
                setMenu(null);
                addImage(src);
              }}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.surface },
  body: { flex: 1, flexDirection: 'row' },
});
