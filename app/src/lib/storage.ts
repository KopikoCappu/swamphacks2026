import { File, Paths } from 'expo-file-system';
import type { StateStorage } from 'zustand/middleware';

/**
 * Native persistence: one JSON file per key in the app's document directory.
 * (Android AsyncStorage caps out at ~6 MB, which a few photos would blow through.)
 * Writes are debounced because the store persists on every stroke.
 */
const WRITE_DELAY_MS = 400;
const pending = new Map<string, { value: string; timer: ReturnType<typeof setTimeout> }>();

const fileFor = (key: string) => new File(Paths.document, `${key}.json`);

async function flush(key: string) {
  const job = pending.get(key);
  if (!job) return;
  pending.delete(key);
  const file = fileFor(key);
  if (!file.exists) file.create();
  await file.write(job.value);
}

export const appStorage: StateStorage = {
  getItem: async (key) => {
    const queued = pending.get(key);
    if (queued) return queued.value;
    const file = fileFor(key);
    return file.exists ? await file.text() : null;
  },
  setItem: (key, value) => {
    const prev = pending.get(key);
    if (prev) clearTimeout(prev.timer);
    pending.set(key, { value, timer: setTimeout(() => void flush(key), WRITE_DELAY_MS) });
  },
  removeItem: (key) => {
    const prev = pending.get(key);
    if (prev) clearTimeout(prev.timer);
    pending.delete(key);
    const file = fileFor(key);
    if (file.exists) file.delete();
  },
};
