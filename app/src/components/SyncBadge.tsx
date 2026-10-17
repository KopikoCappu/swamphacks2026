import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/lib/sync';
import { C } from '@/lib/theme';

const STATES = {
  'signed-out': { icon: 'cloud-off-outline', text: 'Not syncing', color: C.muted },
  idle: { icon: 'cloud-check-outline', text: 'Synced', color: '#30A46C' },
  syncing: { icon: 'cloud-sync-outline', text: 'Syncing…', color: C.muted },
  error: { icon: 'cloud-alert-outline', text: 'Sync error', color: C.danger },
} as const;

/** Small cloud icon + word for the current sync state. */
export function SyncBadge({ compact }: { compact?: boolean }) {
  const status = useAuth((s) => s.status);
  const m = STATES[status];
  return (
    <View style={styles.badge}>
      <MaterialCommunityIcons name={m.icon} size={15} color={m.color} />
      {!compact && <Text style={[styles.text, { color: m.color }]}>{m.text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  text: { fontSize: 13, fontWeight: '600' },
});
