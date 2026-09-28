import { createClient, FunctionsHttpError } from '@supabase/supabase-js';
import { deleteItemAsync, getItemAsync, setItemAsync } from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase environment variables. Copy apps/mobile/.env.example to apps/mobile/.env and restart Expo.');
}

// SecureStore values are limited to ~2 KB and a Supabase session is larger, so
// long values are split into numbered chunks. Keys: `<key>` or `<key>.n` + `<key>.<i>`.
const CHUNK = 1800;
const secureChunkedStorage = {
  async getItem(key: string): Promise<string | null> {
    const count = await getItemAsync(`${key}.n`);
    if (count === null) return getItemAsync(key);
    let value = '';
    for (let i = 0; i < Number(count); i++) {
      const part = await getItemAsync(`${key}.${i}`);
      if (part === null) return null;
      value += part;
    }
    return value;
  },
  async setItem(key: string, value: string): Promise<void> {
    await secureChunkedStorage.removeItem(key);
    if (value.length <= CHUNK) { await setItemAsync(key, value); return; }
    const count = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < count; i++) await setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    await setItemAsync(`${key}.n`, String(count));
  },
  async removeItem(key: string): Promise<void> {
    const count = await getItemAsync(`${key}.n`);
    if (count !== null) {
      for (let i = 0; i < Number(count); i++) await deleteItemAsync(`${key}.${i}`);
      await deleteItemAsync(`${key}.n`);
    }
    await deleteItemAsync(key);
  },
};

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    // On web supabase-js uses localStorage by default; SecureStore is native only.
    storage: Platform.OS === 'web' ? undefined : secureChunkedStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** Calls the manage-users Edge Function and surfaces its Arabic error message. */
export async function manageUsers<T extends Record<string, unknown>>(action: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('manage-users', { body: { action, ...payload } });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null) as { message?: string } | null;
      throw new Error(body?.message ?? 'تعذر إكمال العملية');
    }
    throw new Error('تعذر الاتصال بالخادم. تحقق من الإنترنت ثم حاول مجدداً.');
  }
  return data as T;
}
