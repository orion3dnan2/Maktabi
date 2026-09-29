import type { Db } from '../data/supabase/clientRepository';

/** One request the code under test built: the table or function, the builder calls, and their arguments. */
export interface FakeCall { table?: string; rpc?: string; args?: unknown; steps: [string, unknown[]][] }
export interface FakeResult { data?: unknown; count?: number; error?: { code?: string; message?: string; details?: string | null; hint?: string | null } | null; status?: number }

/**
 * A stand-in for supabase-js that records each query builder chain and answers it when awaited,
 * like PostgREST builders do. `respond` sees the complete call.
 */
export function fakeDb(respond: (call: FakeCall) => FakeResult = () => ({ data: [] })) {
  const calls: FakeCall[] = [];
  const builder = (call: FakeCall): unknown => new Proxy({}, {
    get(_target, key: string) {
      if (key === 'then') return (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => {
        try { resolve({ data: null, error: null, status: 200, ...respond(call) }); } catch (e) { reject(e); }
      };
      return (...args: unknown[]) => { call.steps.push([key, args]); return builder(call); };
    },
  });
  const db = {
    from(table: string) { const call: FakeCall = { table, steps: [] }; calls.push(call); return builder(call); },
    rpc(name: string, args: unknown) { const call: FakeCall = { rpc: name, args, steps: [] }; calls.push(call); return builder(call); },
  };
  return { db: db as unknown as Db, calls };
}
/** The argument list of the first builder call named `method`. */
export const step = (call: FakeCall | undefined, method: string) => call?.steps.find(([name]) => name === method)?.[1];
