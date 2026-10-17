import { Caveat_600SemiBold, useFonts } from '@expo-google-fonts/caveat';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { startSync } from '@/lib/sync';

SplashScreen.preventAutoHideAsync();
// Accounts + cloud sync (no-op when the build has no Supabase config).
startSync();

export default function RootLayout() {
  const [loaded, fontError] = useFonts({ Caveat_600SemiBold });
  // A font that fails to load must never block the app — fall back to the system font instead.
  const ready = loaded || !!fontError;
  useEffect(() => {
    if (fontError) console.warn('[fonts] falling back to system font:', fontError.message);
    if (ready) SplashScreen.hideAsync();
  }, [ready, fontError]);
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </GestureHandlerRootView>
  );
}
