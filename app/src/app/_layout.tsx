import { Caveat_600SemiBold, useFonts } from '@expo-google-fonts/caveat';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({ Caveat_600SemiBold });
  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);
  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerStyle: { backgroundColor: '#F6F4EF' }, headerShadowVisible: false }}>
        <Stack.Screen name="index" options={{ title: 'InkBuddy' }} />
        <Stack.Screen name="note/[id]" options={{ title: '' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
