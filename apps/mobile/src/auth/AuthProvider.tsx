import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { resetRepositories } from '@/data/repositories';
import { discardUserVault, isUnlocked, lockVault, openUserVault, selectVaultUser, VaultPasswordMismatch } from '@/data/vault';
import { accessProblem, isStaff, type Access } from './access';
import { normalizePhone, phoneLoginEmail } from './phone';

type Status = 'loading' | 'signedOut' | 'ready';
interface AuthState {
  status: Status;
  access?: Access;
  /** Signs in by phone; staff also unlock their encrypted workspace on this device. */
  signIn(phone: string, password: string): Promise<void>;
  /** After VaultPasswordMismatch: start an empty workspace on this device, then sign in. */
  signInDiscardingLocalData(phone: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);
export const useAuth = () => { const value = useContext(AuthContext); if (!value) throw new Error('useAuth outside AuthProvider'); return value; };

async function loadAccess(): Promise<Access | undefined> {
  const { data, error } = await supabase.rpc('my_access');
  if (error) throw new Error('تعذر الاتصال بالخادم. تحقق من الإنترنت ثم حاول مجدداً.');
  return (data ?? undefined) as Access | undefined;
}

function authMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'رقم الهاتف أو كلمة المرور غير صحيحة';
  if (/network|fetch/i.test(message)) return 'تعذر الاتصال بالخادم. تحقق من الإنترنت ثم حاول مجدداً.';
  if (/rate|too many/i.test(message)) return 'محاولات كثيرة؛ انتظر قليلاً ثم حاول مجدداً';
  return 'تعذر تسجيل الدخول';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [access, setAccess] = useState<Access>();

  const clearLocal = useCallback(() => { lockVault(); selectVaultUser(null); resetRepositories(); setAccess(undefined); setStatus('signedOut'); }, []);

  // Cold start: a saved session is enough for the portal and the platform console.
  // Staff must type their password again because it unlocks this device's workspace.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { if (active) setStatus('signedOut'); return; }
      try {
        const current = await loadAccess();
        if (!active) return;
        if (accessProblem(current) || (isStaff(current) && !isUnlocked())) { await supabase.auth.signOut(); if (active) clearLocal(); return; }
        setAccess(current); setStatus('ready');
      } catch { if (active) setStatus('signedOut'); }
    })();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT' && active) clearLocal(); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [clearLocal]);

  const doSignIn = useCallback(async (phoneInput: string, password: string, discardLocal: boolean) => {
    const phone = normalizePhone(phoneInput);
    if (!phone) throw new Error('رقم الهاتف غير صحيح؛ أدخله مع رمز الدولة');
    if (!password) throw new Error('أدخل كلمة المرور');
    const { data, error } = await supabase.auth.signInWithPassword({ email: phoneLoginEmail(phone), password });
    if (error || !data.user) throw new Error(authMessage(error?.message ?? ''));
    try {
      const current = await loadAccess();
      const problem = accessProblem(current);
      if (problem) throw new Error(problem);
      if (isStaff(current)) {
        if (discardLocal) { selectVaultUser(current!.user_id); await discardUserVault(); }
        await openUserVault(current!.user_id, phone, password);
        resetRepositories();
      }
      void supabase.rpc('log_login_success');
      setAccess(current); setStatus('ready');
    } catch (e) {
      await supabase.auth.signOut();
      clearLocal();
      if (e instanceof VaultPasswordMismatch) throw e;
      throw e instanceof Error ? e : new Error('تعذر تسجيل الدخول');
    }
  }, [clearLocal]);

  const value = useMemo<AuthState>(() => ({
    status, access,
    signIn: (phone, password) => doSignIn(phone, password, false),
    signInDiscardingLocalData: (phone, password) => doSignIn(phone, password, true),
    signOut: async () => { await supabase.auth.signOut(); clearLocal(); },
    refresh: async () => { const current = await loadAccess(); if (current) setAccess(current); },
  }), [status, access, doSignIn, clearLocal]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
