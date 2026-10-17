import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '@/lib/store';
import { C, R, shadow } from '@/lib/theme';

export default function NotesList() {
  const pages = useStore((s) => s.pages);
  const createPage = useStore((s) => s.createPage);
  const deletePage = useStore((s) => s.deletePage);
  const list = Object.values(pages).sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Text style={styles.h1}>Notes</Text>
        <Pressable style={styles.newBtn} onPress={() => router.push(`/note/${createPage()}`)}>
          <MaterialCommunityIcons name="plus" size={18} color={C.onPrimary} />
          <Text style={styles.newText}>New note</Text>
        </Pressable>
      </View>
      <FlatList
        data={list}
        numColumns={4}
        key="grid-4"
        keyExtractor={(p) => p.id}
        columnWrapperStyle={{ gap: 20 }}
        contentContainerStyle={{ gap: 20, paddingHorizontal: 32, paddingBottom: 32 }}
        ListEmptyComponent={<Text style={styles.empty}>No notes yet.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.cardWrap} onPress={() => router.push(`/note/${item.id}`)} onLongPress={() => deletePage(item.id)}>
            <View style={[styles.card, shadow]}>
              {(item.paper ?? 'blank') === 'lined' && [0, 1, 2, 3, 4, 5, 6].map((i) => <View key={i} style={[styles.rule, { top: 28 + i * 18 }]} />)}
            </View>
            <Text style={styles.title} numberOfLines={1}>
              {item.title || 'Untitled'}
            </Text>
            <Text style={styles.meta}>{new Date(item.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32, paddingTop: 24, paddingBottom: 20 },
  h1: { fontSize: 28, fontWeight: '700', color: C.text, letterSpacing: -0.5 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primary, paddingHorizontal: 16, height: 38, borderRadius: R.pill },
  newText: { color: C.onPrimary, fontWeight: '600', fontSize: 14 },
  empty: { color: C.muted, textAlign: 'center', marginTop: 80, fontSize: 15 },
  cardWrap: { flex: 1, maxWidth: '23.5%', gap: 4 },
  card: { aspectRatio: 0.77, backgroundColor: C.paper, borderRadius: R.md, overflow: 'hidden', marginBottom: 6 },
  rule: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: '#DCE6F2' },
  title: { fontSize: 14, fontWeight: '600', color: C.text },
  meta: { fontSize: 12, color: C.muted },
});
