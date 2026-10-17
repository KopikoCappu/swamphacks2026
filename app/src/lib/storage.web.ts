import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';

/** Web persistence: AsyncStorage (backed by localStorage). Native uses files — see storage.ts. */
export const appStorage: StateStorage = AsyncStorage;
