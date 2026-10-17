import { Caveat_600SemiBold, useFonts } from '@expo-google-fonts/caveat';
import { OpenDyslexic}

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
    <GestureHandlerRootView testID="app-gesture-handler-root-view" style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </GestureHandlerRootView>
  );
}
