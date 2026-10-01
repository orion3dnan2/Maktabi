import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { resetRepositories } from '@/data/repositories';
import { discardUserVault, lockVault, openUserVault, selectVaultUser, VaultPasswordMismatch } from '@/data/vault';
import { clearSharedSession, initializeSharedSession } from '@/data/sharedRepositories';
import { cloudError } from '@/data/sync/cloud';
import { SyncError } from '@/data/sync/types';
import { cachedAccess, rememberAccess, forgetAccess } from './offlineAccess';
import { accessProblem, isStaff, type Access } from './access';
import { normalizePhone, phoneLoginEmail } from './phone';
import { AuthRetryableFetchError } from '@supabase/supabase-js';
import { settleWithin } from '@/lib/settleWithin';

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
  if (error) throw cloudError(error);
  const access = (data ?? undefined) as Access | undefined;
  if (accessProblem(access)) return access;
  if (access?.office && access.role !== 'client') {
    const { data: member, error: memberError } = await supabase.from('office_members').select('role,status').eq('office_id',access.office.id).eq('user_id',access.user_id).maybeSingle();
    if (memberError) throw cloudError(memberError);
    if (!member || member.status !== 'active') throw new SyncError('forbidden','عضوية المكتب غير نشطة');
    access.role = member.role;
  }
  return access;
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

  const clearLocal = useCallback(() => { clearSharedSession(); lockVault(); selectVaultUser(null); resetRepositories(); setAccess(undefined); setStatus('signedOut'); }, []);

  // Cold start: a saved session is enough for the portal and the platform console.
  // Shared operational records use device keys; legacy vaults remain recoverable separately.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let current: Access | undefined;
        const sessionResult = await settleWithin(() => supabase.auth.getSession(), null);
        const data = sessionResult?.data;
        const sessionError = sessionResult?.error;
        if(!sessionResult || sessionError instanceof AuthRetryableFetchError) current=await cachedAccess();
        else {
          if(sessionError) throw sessionError;
          if (!data?.session) { if (active) setStatus('signedOut'); return; }
          try { current = await loadAccess(); if (current) await rememberAccess(current); }
          catch (e) { if (e instanceof SyncError && e.reason === 'offline') current = await cachedAccess(data.session.user.id); else { await forgetAccess(data.session.user.id); throw e; } }
        }
        if (!active) return;
        if (accessProblem(current)) { await forgetAccess(); await supabase.auth.signOut(); if (active) clearLocal(); return; }
        await initializeSharedSession(current!);
        if (!active) { clearSharedSession(); return; }
        setAccess(current); setStatus('ready');
      } catch { if (active) setStatus('signedOut'); }
    })();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT' && active) { void forgetAccess(); clearLocal(); } });
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
        try { await openUserVault(current!.user_id, phone, password); }
        catch (e) { if (!(e instanceof VaultPasswordMismatch)) throw e; /* Preserve old ciphertext; shared data is independent of this password. */ }
        resetRepositories();
      }
      await initializeSharedSession(current!);
      await rememberAccess(current!);
      // PostgREST builders are lazy: attaching then actually sends the audit request.
      void supabase.rpc('log_login_success').then(({ error }) => { if (error) console.warn('Login audit could not be saved'); });
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
    signOut: async () => { if (access) await forgetAccess(access.user_id); await supabase.auth.signOut(); clearLocal(); },
    refresh: async () => { const current = await loadAccess(); if (current) { await initializeSharedSession(current); await rememberAccess(current); setAccess(current); } },
  }), [status, access, doSignIn, clearLocal]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
