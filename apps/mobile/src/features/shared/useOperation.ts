import { useRef, useState } from 'react';
import { userMessage } from '@/data/supabase/errors';
export function useOperation(reload?: () => void) {
  const lock = useRef(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const run = async (action: () => Promise<void>, success = 'تم الحفظ') => { if (lock.current) return; lock.current = true; setBusy(true); setMessage(''); setError(''); try { await action(); setMessage(success); reload?.(); } catch (e) { setError(userMessage(e, 'تعذرت العملية')); } finally { lock.current = false; setBusy(false); } };
  return { run, busy, message, error };
}
