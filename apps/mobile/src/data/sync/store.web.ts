import { bytesToHex, hexToBytes, encryptText, decryptText, type CipherEnvelope } from '../crypto';
import { emptyState, type LocalState, type OperationalStore } from './types';

// Web uses IndexedDB rather than expo-sqlite's experimental WASM/COOP dependency.
const stores = new Map<string, Promise<OperationalStore>>();
const request = <T>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
export function operationalStore(userId: string, officeId: string): Promise<OperationalStore> {
  const scope = `${officeId}:${userId}`;
  if (!stores.has(scope)) stores.set(scope, create(scope));
  return stores.get(scope)!;
}
async function create(scope: string): Promise<OperationalStore> {
  const opening = indexedDB.open(`maktabi-operations-v1-${scope}`, 1);
  opening.onupgradeneeded = () => { opening.result.createObjectStore('records'); opening.result.createObjectStore('keys'); };
  const db = await request(opening);
  const txDone = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error ?? new Error('Local transaction aborted')); });
  const keyTx = db.transaction('keys','readwrite'); const keyDone = txDone(keyTx);
  let keyHex = await request(keyTx.objectStore('keys').get('device')) as string | undefined;
  if (!keyHex) { keyHex = bytesToHex(crypto.getRandomValues(new Uint8Array(32))); keyTx.objectStore('keys').put(keyHex,'device'); }
  await keyDone; const key = hexToBytes(keyHex);
  let queue: Promise<unknown> = Promise.resolve();
  const read = async (): Promise<LocalState> => {
    const tx = db.transaction('records','readonly'); const done = txDone(tx);
    const rows = await request(tx.objectStore('records').getAll()) as { key: string; payload: CipherEnvelope; order: number }[];
    await done; const state = emptyState();
    for (const row of rows.sort((a,b) => a.order-b.order)) {
      const value: unknown = JSON.parse(decryptText(row.payload,key));
      if (row.key.startsWith('client:')) state.clients[row.key.slice(7)] = value as LocalState['clients'][string];
      else if (row.key.startsWith('matter:')) state.matters[row.key.slice(7)] = value as LocalState['matters'][string];
      else if (row.key.startsWith('operation:')) state.operations.push(value as LocalState['operations'][number]);
      else if (row.key==='assignments') state.assignments=value as LocalState['assignments'];
      else if (row.key==='members') state.members=value as LocalState['members'];
      else if (row.key==='legacy-links') state.legacyLinks=value as LocalState['legacyLinks'];
    }
    return state;
  };
  const transact = <T>(action: (state: LocalState) => T): Promise<T> => {
    const persist = async () => {
      const state = await read(); const result = action(state);
      const entries: [string,unknown][] = [...Object.entries(state.clients).map(([id,value]): [string,unknown] => [`client:${id}`,value]), ...Object.entries(state.matters).map(([id,value]): [string,unknown] => [`matter:${id}`,value]), ...state.operations.map(value => [`operation:${value.id}`,value] as [string,unknown]), ['assignments',state.assignments],['members',state.members],['legacy-links',state.legacyLinks]];
      // All encryption occurs BEFORE opening the IDB write transaction (no auto-commit gap).
      const rows = entries.map(([recordKey,value],order) => ({ key:recordKey, order, payload:encryptText(JSON.stringify(value),key,crypto.getRandomValues(new Uint8Array(12))) }));
      const tx = db.transaction('records','readwrite'); const done = txDone(tx); const records=tx.objectStore('records');
      records.clear(); rows.forEach(row => records.put(row,row.key)); await done; return result;
    };
    const task = queue.then(async (): Promise<T> => {
      if (!navigator.locks) throw new Error('هذا المتصفح لا يدعم قفل البيانات المحلية الآمن');
      return await navigator.locks.request(`maktabi-${scope}`, persist);
    });
    queue=task.catch(() => undefined); return task;
  };
  return { async read() { await queue; return read(); }, transact, async clear() { await transact(state => Object.assign(state,emptyState())); } };
}
