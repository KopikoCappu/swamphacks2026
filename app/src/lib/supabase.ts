import './polyfills';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
// Publishable key: safe to ship in the app. Row level security limits every user to their own rows.
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

/** null when the app was built without Supabase config — accounts/sync are then simply hidden. */
export const supabase =
  url && key
    ? createClient(url, key, {
        auth: {
          // Native: AsyncStorage (the session is small). Web: supabase-js defaults to localStorage.
          storage: Platform.OS === 'web' ? undefined : AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

// Only refresh tokens while the app is in the foreground (recommended for React Native).
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
