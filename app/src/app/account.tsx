import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SyncBadge } from '@/components/SyncBadge';
import { IconBtn } from '@/components/Toolbar';
import { useStore } from '@/lib/store';
import { signIn, signOut, signUp, syncNow, useAuth } from '@/lib/sync';
import { C, R, shadow } from '@/lib/theme';

export default function AccountScreen() {
  const session = useAuth((s) => s.session);
  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.top}>
        <IconBtn icon="chevron-left" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.center}>
        <View style={[styles.card, shadow]}>{session ? <SignedIn email={session.user.email ?? ''} /> : <SignInForm />}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SignInForm() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const localNotes = useStore((s) => Object.keys(s.pages).length);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signup') await signUp(email, password);
      else await signIn(email, password);
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Text style={styles.h1}>{mode === 'signin' ? 'Sign in' : 'Create your account'}</Text>
      <Text style={styles.sub}>Sync your notes across your tablet, laptop and phone.</Text>

      <View style={styles.tabs}>
        {(['signin', 'signup'] as const).map((m) => (
          <Pressable key={m} onPress={() => (setMode(m), setError(null))} style={[styles.tab, mode === m && styles.tabOn]}>
            <Text style={[styles.tabText, mode === m && { color: C.text }]}>{m === 'signin' ? 'Sign in' : 'Create account'}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
        placeholderTextColor={C.faint}
        style={styles.input}
      />
      <Text style={styles.label}>Password</Text>
      <View style={styles.pwRow}>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          placeholder={mode === 'signup' ? 'At least 6 characters' : ''}
          placeholderTextColor={C.faint}
          onSubmitEditing={submit}
          style={[styles.input, { flex: 1, borderWidth: 0 }]}
        />
        <IconBtn icon={show ? 'eye-off-outline' : 'eye-outline'} onPress={() => setShow(!show)} size={18} />
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={[styles.primary, (busy || !email || !password) && { opacity: 0.4 }]} disabled={busy || !email || !password} onPress={submit}>
        {busy ? <ActivityIndicator color={C.onPrimary} /> : <Text style={styles.primaryText}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>}
      </Pressable>

      {localNotes > 0 && (
        <Text style={styles.note}>
          {localNotes} note{localNotes > 1 ? 's' : ''} on this device will be added to your account.
        </Text>
      )}
      <Pressable onPress={() => router.replace('/')} hitSlop={8} style={{ alignSelf: 'center', marginTop: 14 }}>
        <Text style={styles.link}>Continue without an account</Text>
      </Pressable>
    </>
  );
}

function SignedIn({ email }: { email: string }) {
  const { status, lastSyncedAt, error } = useAuth();
  const count = useStore((s) => Object.keys(s.pages).length);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(false), 4000);
    return () => clearTimeout(t);
  }, [confirm]);

  async function doSignOut() {
    if (!confirm) return setConfirm(true);
    setBusy(true);
    setSignOutError(null);
    try {
      await signOut();
      router.replace('/');
    } catch (e) {
      setSignOutError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <MaterialCommunityIcons name="account-circle-outline" size={44} color={C.icon} style={{ alignSelf: 'center' }} />
      <Text style={[styles.h1, { textAlign: 'center', marginTop: 8 }]}>{email}</Text>
      <View style={styles.statusRow}>
        <SyncBadge />
        <Text style={styles.sub}>
          {count} note{count === 1 ? '' : 's'}
          {lastSyncedAt ? ` · synced ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
        </Text>
      </View>
      {status === 'error' && !!error && <Text style={styles.error}>Sync problem: {error}</Text>}

      <Pressable style={[styles.secondary, status === 'syncing' && { opacity: 0.5 }]} disabled={status === 'syncing'} onPress={() => void syncNow()}>
        <MaterialCommunityIcons name="cloud-sync-outline" size={18} color={C.text} />
        <Text style={styles.secondaryText}>Sync now</Text>
      </Pressable>
      <Pressable style={[styles.secondary, confirm && { borderColor: C.danger }]} disabled={busy} onPress={doSignOut}>
        {busy ? <ActivityIndicator color={C.danger} /> : <MaterialCommunityIcons name="logout" size={18} color={C.danger} />}
        <Text style={[styles.secondaryText, { color: C.danger }]}>{confirm ? 'Tap again — notes leave this device (kept in your account)' : 'Sign out'}</Text>
      </Pressable>
      {!!signOutError && <Text style={styles.error}>{signOutError}</Text>}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  top: { paddingHorizontal: 12, paddingTop: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 400, backgroundColor: C.surface, borderRadius: R.lg, padding: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  h1: { fontSize: 22, fontWeight: '700', color: C.text, letterSpacing: -0.3 },
  sub: { fontSize: 14, color: C.muted, marginTop: 4 },
  tabs: { flexDirection: 'row', backgroundColor: C.bg, borderRadius: R.sm, padding: 3, marginTop: 20, marginBottom: 8 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 6 },
  tabOn: { backgroundColor: C.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  tabText: { fontSize: 13, fontWeight: '600', color: C.muted },
  label: { fontSize: 12, fontWeight: '600', color: C.muted, marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.text, backgroundColor: C.surface },
  pwRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border, borderRadius: R.sm, paddingRight: 2 },
  error: { color: C.danger, fontSize: 13, marginTop: 12 },
  primary: { backgroundColor: C.primary, borderRadius: R.pill, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  primaryText: { color: C.onPrimary, fontWeight: '600', fontSize: 15 },
  note: { fontSize: 13, color: C.muted, textAlign: 'center', marginTop: 12 },
  link: { fontSize: 14, color: C.muted, textDecorationLine: 'underline' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 6, marginBottom: 16 },
  secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: C.border, borderRadius: R.pill, minHeight: 44, paddingHorizontal: 14, marginTop: 10 },
  secondaryText: { fontSize: 14, fontWeight: '600', color: C.text, flexShrink: 1, textAlign: 'center' },
});
