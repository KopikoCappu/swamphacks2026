import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HomeBanner } from '@/components/HomeBanner';
import { Logo } from '@/components/Logo';
import { NoteThumb } from '@/components/NoteThumb';
import { SyncBadge } from '@/components/SyncBadge';
import { IconBtn } from '@/components/Toolbar';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/sync';
import { C, FOLDER_COLORS, folderColor, R, shadow } from '@/lib/theme';
import type { Folder, Page } from '@/lib/types';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
const ALL = '__all__';

export default function NotesHome() {
  const pages = useStore((s) => s.pages);
  const folders = useStore((s) => s.folders);
  const { createPage, createFolder } = useStore.getState();
  const [selected, setCurrent] = useState<string>(ALL);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [cardMenu, setCardMenu] = useState<string | null>(null);
  const [mainWidth, setMainWidth] = useState(0);

  // If the open folder was deleted, fall back to All notes.
  const current = selected !== ALL && folders[selected] ? selected : ALL;
  const folderList = Object.values(folders).sort((a, b) => a.createdAt - b.createdAt);
  const inFolder = current === ALL ? Object.values(pages) : Object.values(pages).filter((p) => p.folderId === current);
  const list = inFolder.sort((a, b) => b.updatedAt - a.updatedAt);
  const cols = Math.max(2, Math.floor((mainWidth - 64) / 220));
  const heading = current === ALL ? 'All notes' : (folders[current]?.name ?? 'All notes');
  const [weekAgo] = useState(() => Date.now() - 7 * 864e5);
  const recent = list.filter((p) => p.updatedAt > weekAgo).length;
  const subtitle = `${list.length} note${list.length === 1 ? '' : 's'}${recent ? ` · ${recent} edited this week` : ''}`;

  function newFolder() {
    const id = createFolder();
    setCurrent(id);
    setRenaming(id);
  }

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.sidebar}>
        <View style={styles.brandRow}>
          <Logo size={34} />
          <Text style={styles.brand}>InkBuddy</Text>
        </View>
        <ScrollView contentContainerStyle={{ gap: 2 }}>
          <SideItem icon="note-multiple-outline" label="All notes" count={Object.keys(pages).length} active={current === ALL} onPress={() => setCurrent(ALL)} />
          <Text style={styles.sideLabel}>Folders</Text>
          {folderList.map((f) => (
            <FolderItem
              key={f.id}
              folder={f}
              count={Object.values(pages).filter((p) => p.folderId === f.id).length}
              active={current === f.id}
              renaming={renaming === f.id}
              onPress={() => setCurrent(f.id)}
              onRename={() => setRenaming(f.id)}
              onDoneRename={() => setRenaming(null)}
            />
          ))}
          <Pressable onPress={newFolder} style={({ pressed }) => [styles.sideItem, pressed && { backgroundColor: C.selected }]}>
            <MaterialCommunityIcons name="folder-plus-outline" size={18} color={C.muted} />
            <Text style={[styles.sideText, { color: C.muted }]}>New folder</Text>
          </Pressable>
        </ScrollView>
        <AccountRow />
      </View>

      <View style={styles.main} onLayout={(e) => setMainWidth(e.nativeEvent.layout.width)}>
        <View style={styles.header}>
          <HomeBanner
            color={current === ALL ? undefined : folderColor(folders[current])}
            title={heading}
            subtitle={subtitle}
            action={
              <Pressable
                style={({ pressed }) => [styles.newBtn, shadow, pressed && { opacity: 0.8 }]}
                onPress={() => router.push(`/note/${createPage(current === ALL ? null : current)}`)}
              >
                <MaterialCommunityIcons name="plus" size={18} color={C.text} />
                <Text style={styles.newText}>New note</Text>
              </Pressable>
            }
          />
        </View>

        {mainWidth > 0 && (
          <FlatList
            data={list}
            key={`cols-${cols}`}
            numColumns={cols}
            keyExtractor={(p) => p.id}
            columnWrapperStyle={{ gap: 20 }}
            contentContainerStyle={{ gap: 24, paddingHorizontal: 32, paddingBottom: 48 }}
            ListEmptyComponent={<Text style={styles.empty}>{current === ALL ? 'No notes yet.' : 'This folder is empty.'}</Text>}
            renderItem={({ item }) => (
              <NoteCard
                page={item}
                width={(mainWidth - 64 - 20 * (cols - 1)) / cols}
                folders={folderList}
                folder={item.folderId ? folders[item.folderId] : undefined}
                showFolder={current === ALL}
                menuOpen={cardMenu === item.id}
                setMenuOpen={(o) => setCardMenu(o ? item.id : null)}
              />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

/** Bottom of the sidebar: who's signed in + sync state, or a prompt to sign in. */
function AccountRow() {
  const session = useAuth((s) => s.session);
  if (!supabase) return null;
  return (
    <Pressable onPress={() => router.push('/account')} style={({ pressed }) => [styles.account, pressed && { backgroundColor: C.selected }]}>
      <MaterialCommunityIcons name="account-circle-outline" size={22} color={C.icon} />
      <View style={{ flex: 1 }}>
        <Text style={styles.sideText} numberOfLines={1}>
          {session ? session.user.email : 'Sign in to sync'}
        </Text>
        {session ? <SyncBadge /> : <Text style={styles.count}>Notes stay on this device</Text>}
      </View>
    </Pressable>
  );
}

function SideItem({ icon, label, count, active, onPress }: { icon: IconName; label: string; count: number; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.sideItem, (active || pressed) && { backgroundColor: C.selected }]}>
      <MaterialCommunityIcons name={icon} size={18} color={active ? C.text : C.icon} />
      <Text style={[styles.sideText, active && { fontWeight: '600' }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.count}>{count}</Text>
    </Pressable>
  );
}

type FolderItemProps = {
  folder: Folder;
  count: number;
  active: boolean;
  renaming: boolean;
  onPress: () => void;
  onRename: () => void;
  onDoneRename: () => void;
};

function FolderItem({ folder, count, active, renaming, onPress, onRename, onDoneRename }: FolderItemProps) {
  const { renameFolder, deleteFolder, setFolderColor } = useStore.getState();
  const [name, setName] = useState(folder.name);
  const [confirm, setConfirm] = useState(false);
  const [palette, setPalette] = useState(false);
  const color = folderColor(folder);
  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(false), 3000);
    return () => clearTimeout(t);
  }, [confirm]);

  if (renaming) {
    return (
      <View style={[styles.sideItem, { backgroundColor: C.selected }]}>
        <MaterialCommunityIcons name="folder" size={18} color={color} />
        <TextInput
          value={name}
          onChangeText={setName}
          autoFocus
          selectTextOnFocus
          onSubmitEditing={() => {
            renameFolder(folder.id, name.trim() || 'Untitled folder');
            onDoneRename();
          }}
          onBlur={() => {
            renameFolder(folder.id, name.trim() || 'Untitled folder');
            onDoneRename();
          }}
          style={[styles.sideText, styles.renameInput]}
        />
      </View>
    );
  }

  return (
    <View>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.sideItem, (active || pressed) && { backgroundColor: C.selected }]}>
        <MaterialCommunityIcons name="folder" size={18} color={color} />
        <Text style={[styles.sideText, active && { fontWeight: '600' }]} numberOfLines={1}>
          {folder.name}
        </Text>
        {active ? (
          <View style={{ flexDirection: 'row' }}>
            <SmallIcon icon="palette-outline" onPress={() => setPalette(!palette)} />
            <SmallIcon icon="pencil-outline" onPress={onRename} />
            <SmallIcon icon={confirm ? 'check' : 'delete-outline'} danger={confirm} onPress={() => (confirm ? deleteFolder(folder.id) : setConfirm(true))} />
          </View>
        ) : (
          <Text style={styles.count}>{count}</Text>
        )}
      </Pressable>
      {active && palette && (
        <View style={styles.swatches}>
          {FOLDER_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setFolderColor(folder.id, c)}
              hitSlop={4}
              style={[styles.swatch, { backgroundColor: c }, c === color && styles.swatchOn]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

type NoteCardProps = {
  page: Page;
  width: number;
  folders: Folder[];
  folder?: Folder;
  showFolder: boolean;
  menuOpen: boolean;
  setMenuOpen: (o: boolean) => void;
};

function NoteCard({ page, width, folders, folder, showFolder, menuOpen, setMenuOpen }: NoteCardProps) {
  const { movePage } = useStore.getState();

  return (
    <View style={{ width, zIndex: menuOpen ? 10 : 0 }}>
      <Pressable onPress={() => router.push(`/note/${page.id}`)} onLongPress={() => setMenuOpen(true)}>
        <View style={[styles.card, shadow]}>
          <NoteThumb page={page} />
          {folder && <View style={[styles.stripe, { backgroundColor: folderColor(folder) }]} />}
        </View>
      </Pressable>
      <View style={styles.cardMeta}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {page.title || 'Untitled'}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{new Date(page.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
            {showFolder && folder && (
              <View style={[styles.tag, { backgroundColor: folderColor(folder) + '22' }]}>
                <View style={[styles.tagDot, { backgroundColor: folderColor(folder) }]} />
                <Text style={styles.tagText} numberOfLines={1}>
                  {folder.name}
                </Text>
              </View>
            )}
          </View>
        </View>
        <IconBtn icon="dots-horizontal" size={18} active={menuOpen} onPress={() => setMenuOpen(!menuOpen)} />
      </View>

      {menuOpen && (
        <View style={[styles.cardMenu, shadow]}>
          <Text style={styles.menuLabel}>Move to</Text>
          <MenuRow icon="inbox-outline" label="No folder" checked={!page.folderId} onPress={() => (movePage(page.id, null), setMenuOpen(false))} />
          {folders.map((f) => (
            <MenuRow key={f.id} icon="folder" iconColor={folderColor(f)} label={f.name} checked={page.folderId === f.id} onPress={() => (movePage(page.id, f.id), setMenuOpen(false))} />
          ))}
          <View style={styles.sep} />
          <DeleteRow pageId={page.id} />
        </View>
      )}
    </View>
  );
}

/** Two-tap delete; lives inside the menu so its confirm state resets whenever the menu closes. */
function DeleteRow({ pageId }: { pageId: string }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <MenuRow
      icon="delete-outline"
      label={confirm ? 'Tap again to delete' : 'Delete note'}
      danger
      onPress={() => (confirm ? useStore.getState().deletePage(pageId) : setConfirm(true))}
    />
  );
}

type MenuRowProps = { icon: IconName; iconColor?: string; label: string; onPress: () => void; checked?: boolean; danger?: boolean };

function MenuRow({ icon, iconColor, label, onPress, checked, danger }: MenuRowProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: C.selected }]}>
      <MaterialCommunityIcons name={icon} size={18} color={danger ? C.danger : (iconColor ?? C.icon)} />
      <Text style={[styles.menuText, danger && { color: C.danger }]} numberOfLines={1}>
        {label}
      </Text>
      {checked && <MaterialCommunityIcons name="check" size={16} color={C.text} />}
    </Pressable>
  );
}

function SmallIcon({ icon, onPress, danger }: { icon: IconName; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.smallIcon}>
      <MaterialCommunityIcons name={icon} size={16} color={danger ? C.danger : C.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: C.bg },
  sidebar: { width: 240, backgroundColor: C.surface, borderRightWidth: StyleSheet.hairlineWidth, borderColor: C.border, paddingHorizontal: 12, paddingTop: 20 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, marginBottom: 16 },
  brand: { fontSize: 17, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 38, paddingRight: 10, paddingVertical: 8 },
  swatch: { width: 20, height: 20, borderRadius: 10 },
  swatchOn: { borderWidth: 3, borderColor: C.surface, transform: [{ scale: 1.15 }] },
  sideLabel: { fontSize: 11, fontWeight: '600', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 10, marginTop: 18, marginBottom: 4 },
  sideItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, height: 38, borderRadius: R.sm },
  sideText: { flex: 1, fontSize: 14, color: C.text },
  renameInput: { paddingVertical: 4, borderBottomWidth: 1, borderColor: C.text },
  count: { fontSize: 12, color: C.muted, fontVariant: ['tabular-nums'] },
  smallIcon: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  account: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, marginVertical: 12, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },

  main: { flex: 1 },
  header: { paddingHorizontal: 32, paddingTop: 24, paddingBottom: 24 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', paddingHorizontal: 16, height: 40, borderRadius: R.pill },
  newText: { color: C.text, fontWeight: '700', fontSize: 14 },
  empty: { color: C.muted, textAlign: 'center', marginTop: 80, fontSize: 15 },

  card: { aspectRatio: 816 / 1056, backgroundColor: C.paper, borderRadius: R.md, overflow: 'hidden' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  title: { fontSize: 14, fontWeight: '600', color: C.text },
  meta: { fontSize: 12, color: C.muted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  stripe: { position: 'absolute', left: 0, right: 0, top: 0, height: 5 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 7, height: 20, borderRadius: R.pill, flexShrink: 1 },
  tagDot: { width: 7, height: 7, borderRadius: 4 },
  tagText: { fontSize: 11, fontWeight: '600', color: C.icon, flexShrink: 1 },
  cardMenu: { position: 'absolute', top: 40, right: 0, left: 0, backgroundColor: C.surface, borderRadius: R.md, padding: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  menuLabel: { fontSize: 11, fontWeight: '600', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 8, paddingVertical: 6 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, height: 36, borderRadius: R.sm },
  menuText: { flex: 1, fontSize: 14, color: C.text },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginVertical: 4 },
});
