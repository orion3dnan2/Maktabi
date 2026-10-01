import { openDatabaseAsync } from 'expo-sqlite';
import { getItemAsync, setItemAsync } from 'expo-secure-store';
import { getRandomBytesAsync } from 'expo-crypto';
import { bytesToHex, hexToBytes, encryptText, decryptText, type CipherEnvelope } from '../crypto';
import { emptyState, type LocalState, type OperationalStore } from './types';

const database = openDatabaseAsync('maktabi-operations-v1.db').then(async db => {
  await db.execAsync('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS operational_records (scope TEXT NOT NULL, key TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(scope,key));');
  return db;
});
const stores = new Map<string, Promise<OperationalStore>>();

export function operationalStore(userId: string, officeId: string): Promise<OperationalStore> {
  const scope = `${officeId}:${userId}`;
  if (!stores.has(scope)) stores.set(scope, create(scope));
  return stores.get(scope)!;
}
async function create(scope: string): Promise<OperationalStore> {
  const keyName = `maktabi.device-key.${scope.replace(/:/g, '.')}`;
  let keyHex = await getItemAsync(keyName);
  if (!keyHex) { keyHex = bytesToHex(await getRandomBytesAsync(32)); await setItemAsync(keyName, keyHex); }
  const key = hexToBytes(keyHex);
  const db = await database;
  let queue: Promise<unknown> = Promise.resolve();
  const readRows = (rows: { key: string; payload: string }[]) => {
    const state = emptyState();
    for (const row of rows) {
      const value: unknown = JSON.parse(decryptText(JSON.parse(row.payload) as CipherEnvelope, key));
      if (row.key.startsWith('client:')) state.clients[row.key.slice(7)] = value as LocalState['clients'][string];
      else if (row.key.startsWith('matter:')) state.matters[row.key.slice(7)] = value as LocalState['matters'][string];
      else if (row.key.startsWith('operation:')) state.operations.push(value as LocalState['operations'][number]);
      else if (row.key === 'assignments') state.assignments = value as LocalState['assignments'];
      else if (row.key === 'members') state.members = value as LocalState['members'];
      else if (row.key === 'legacy-links') state.legacyLinks = value as LocalState['legacyLinks'];
    }
    // Outbox order is persisted explicitly; timestamp ordering alone may collide.
    return state;
  };
  async function transact<T>(action: (state: LocalState) => T): Promise<T> {
    const task = queue.then(async () => {
      let result!: T;
      await db.withExclusiveTransactionAsync(async tx => {
        const rows = await tx.getAllAsync<{ key: string; payload: string }>('SELECT key,payload FROM operational_records WHERE scope=? ORDER BY rowid', scope);
        const state = readRows(rows); result = action(state);
        const entries: [string, unknown][] = [
          ...Object.entries(state.clients).map(([id, value]): [string, unknown] => [`client:${id}`, value]),
          ...Object.entries(state.matters).map(([id, value]): [string, unknown] => [`matter:${id}`, value]),
          ...state.operations.map((value): [string, unknown] => [`operation:${value.id}`, value]),
          ['assignments', state.assignments], ['members', state.members], ['legacy-links', state.legacyLinks],
        ];
        const encrypted = await Promise.all(entries.map(async ([recordKey, value]) => ({ recordKey, payload: JSON.stringify(encryptText(JSON.stringify(value), key, await getRandomBytesAsync(12))) })));
        await tx.runAsync('DELETE FROM operational_records WHERE scope=?', scope);
        for (const row of encrypted) await tx.runAsync('INSERT INTO operational_records(scope,key,payload) VALUES (?,?,?)', scope, row.recordKey, row.payload);
      });
      return result;
    });
    queue = task.catch(() => undefined); return task;
  }
  return {
    async read() { await queue; return readRows(await db.getAllAsync<{ key: string; payload: string }>('SELECT key,payload FROM operational_records WHERE scope=? ORDER BY rowid', scope)); },
    transact,
    async clear() { await transact(state => Object.assign(state, emptyState())); },
  };
}
