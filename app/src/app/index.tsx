import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from '@/lib/store';

export default function NotesList() {
  const pages = useStore((s) => s.pages);
  const createPage = useStore((s) => s.createPage);
  const deletePage = useStore((s) => s.deletePage);
  const list = Object.values(pages).sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <View style={styles.root}>
      <Pressable style={styles.newBtn} onPress={() => router.push(`/note/${createPage()}`)}>
        <Text style={styles.newText}>＋ New note</Text>
      </Pressable>
      <FlatList
        data={list}
        numColumns={4}
        keyExtractor={(p) => p.id}
        columnWrapperStyle={{ gap: 16 }}
        contentContainerStyle={{ gap: 16, padding: 16 }}
        ListEmptyComponent={<Text style={styles.empty}>No notes yet. Grab your S Pen and start one.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/note/${item.id}`)} onLongPress={() => deletePage(item.id)}>
            <Text style={styles.title} numberOfLines={1}>{item.title || 'Untitled'}</Text>
            <Text style={styles.meta}>
              {item.strokes.length} strokes · {item.chat.length} messages
            </Text>
            <Text style={styles.meta}>{new Date(item.updatedAt).toLocaleString()}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFDF8' },
  newBtn: { margin: 16, marginBottom: 0, backgroundColor: '#6E56CF', borderRadius: 12, padding: 14, alignSelf: 'flex-start' },
  newText: { color: 'white', fontWeight: '700', fontSize: 16 },
  empty: { color: '#6B665C', textAlign: 'center', marginTop: 48, fontSize: 16 },
  card: { flex: 1, maxWidth: '24%', aspectRatio: 0.8, backgroundColor: 'white', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E4DFD3', gap: 4 },
  title: { fontSize: 17, fontWeight: '700', color: '#1F2328' },
  meta: { fontSize: 12, color: '#6B665C' },
});
