import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { platform, secureStore } = vi.hoisted(() => {
  const items = new Map<string, string>();
  // expo-secure-store rejects keys outside this pattern on every native platform.
  const assertKey = (key: string) => {
    if (!/^[\w.-]+$/.test(key)) throw new Error(`Invalid SecureStore key: ${key}`);
  };
  return {
    platform: { OS: 'ios' },
    secureStore: {
      items,
      getItemAsync: vi.fn(async (key: string) => { assertKey(key); return items.get(key) ?? null; }),
      setItemAsync: vi.fn(async (key: string, value: string) => { assertKey(key); items.set(key, value); }),
      deleteItemAsync: vi.fn(async (key: string) => { assertKey(key); items.delete(key); }),
    },
  };
});

vi.mock('react-native', () => ({ Platform: platform }));
vi.mock('expo-secure-store', () => secureStore);

const STORAGE_KEY = 'sb-maktabitest-auth-token';

const passwordGrant = () => ({
  access_token: 'header.payload.signature',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'refresh-token',
  user: { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'lawyer@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-09-28T00:00:00Z' },
});

const clients: { auth: { stopAutoRefresh: () => Promise<void> } }[] = [];

// Each import is a fresh module instance, like a cold app start reading the same device storage.
async function startApp() {
  vi.resetModules();
  const { supabase } = await import('./supabase');
  clients.push(supabase);
  return supabase;
}

beforeEach(() => {
  platform.OS = 'ios';
  secureStore.items.clear();
  vi.clearAllMocks();
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://maktabitest.supabase.co');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) =>
    String(input).includes('/auth/v1/token?grant_type=password')
      ? new Response(JSON.stringify(passwordGrant()), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : new Response('{}', { status: 404 })));
});

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.auth.stopAutoRefresh()));
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('supabase client storage', () => {
  it.each(['ios', 'android'])('persists the %s session in SecureStore across restarts', async (os) => {
    platform.OS = os;
    const first = await startApp();
    const { error } = await first.auth.signInWithPassword({ email: 'lawyer@example.com', password: 'secret' });
    expect(error).toBeNull();
    expect(secureStore.setItemAsync).toHaveBeenCalledWith(STORAGE_KEY, expect.any(String));

    const restarted = await startApp();
    const { data } = await restarted.auth.getSession();
    expect(data.session?.user.email).toBe('lawyer@example.com');
  });

  it('treats an unparseable SecureStore session as signed out and replaces it on sign-in', async () => {
    secureStore.items.set(STORAGE_KEY, '{not json');
    const app = await startApp();
    const { data, error } = await app.auth.getSession();
    expect(error).toBeNull();
    expect(data.session).toBeNull();

    await app.auth.signInWithPassword({ email: 'lawyer@example.com', password: 'secret' });
    expect(JSON.parse(secureStore.items.get(STORAGE_KEY) ?? 'null')?.user.email).toBe('lawyer@example.com');
  });

  it('removes a stored value that is not a valid session', async () => {
    secureStore.items.set(STORAGE_KEY, JSON.stringify({ access_token: null }));
    const { data, error } = await (await startApp()).auth.getSession();
    expect(error).toBeNull();
    expect(data.session).toBeNull();
    expect(secureStore.items.has(STORAGE_KEY)).toBe(false);
  });

  it('uses browser localStorage on web and never touches SecureStore', async () => {
    platform.OS = 'web';
    // auth-js warns about the earlier tests' client instances once it sees a browser context.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const localItems = new Map<string, string>();
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal('document', { visibilityState: 'hidden' });
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => localItems.get(key) ?? null,
      setItem: (key: string, value: string) => { localItems.set(key, value); },
      removeItem: (key: string) => { localItems.delete(key); },
    });

    const { error } = await (await startApp()).auth.signInWithPassword({ email: 'lawyer@example.com', password: 'secret' });
    expect(error).toBeNull();
    expect(JSON.parse(localItems.get(STORAGE_KEY) ?? 'null')?.user.email).toBe('lawyer@example.com');
    expect(secureStore.getItemAsync).not.toHaveBeenCalled();
    expect(secureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('fails fast with setup instructions when the Expo env vars are missing', async () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    await expect(startApp()).rejects.toThrow('Missing Supabase environment variables');
  });
});
