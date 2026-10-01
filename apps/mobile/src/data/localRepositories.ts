import { createMockRepositories, type RepositorySnapshot } from './mockRepositories';
import type { Client, Matter } from '@maktabi/domain';

export interface LocalStorage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
export const STORAGE_KEY = 'maktabi:office-1:v1';

/** Serialize writes and roll back memory if durable storage fails. Reads never see half a write. */
export function createLocalRepositories(storage: LocalStorage, shared?: () => Promise<{ clients: Client[]; matters: Matter[] }>) {
  const core = createMockRepositories();
  // Fixtures stay available for tests, but production workspaces initialize empty.
  if (shared) core.restore({ version: 1, clients: [], matters: [], profiles: [], workflows: [] });
  let loading: Promise<void> | undefined;
  let queue = Promise.resolve();
  const ready = () => loading ??= storage.getItem(STORAGE_KEY).then((raw) => {
    if (raw) core.restore(JSON.parse(raw) as RepositorySnapshot);
  });
  function persistent<T extends object>(repository: T): T {
    return new Proxy(repository, {
      get(target, key: string) {
        const method = Reflect.get(target, key) as (...args: unknown[]) => Promise<unknown>;
        if (typeof method !== 'function') return method;
        return async (...args: unknown[]) => {
          await ready();
          if (shared) {
            await queue;
            const current = await shared(); const snapshot = core.snapshot();
            const merge = <T extends { id: string }>(legacy: T[], incoming: T[]) => [...legacy.filter(r => !incoming.some(n => n.id === r.id)), ...incoming];
            const matters = current.matters.map(m => {
              const local = snapshot.matters.find(old => old.id === m.id);
              return { ...m, nextEventAt: local?.nextEventAt ?? m.nextEventAt, currentStage: local?.currentStage ?? m.currentStage };
            });
            core.restore({ ...snapshot, clients: merge(snapshot.clients, current.clients), matters: merge(snapshot.matters, matters) });
          }
          if (/^(get|list)/.test(key)) { await queue; return method(...args); }
          const operation = queue.then(async () => {
            const before = core.snapshot();
            try {
              const result = await method(...args);
              await storage.setItem(STORAGE_KEY, JSON.stringify(core.snapshot()));
              return result;
            } catch (error) { core.restore(before); throw error; }
          });
          queue = operation.then(() => undefined, () => undefined);
          return operation;
        };
      },
    });
  }
  return {
    clientRepository: persistent(core.clientRepository),
    matterRepository: persistent(core.matterRepository),
    profileRepository: persistent(core.profileRepository),
    workflowRepository: persistent(core.workflowRepository),
    officeRepository: persistent(core.officeRepository),
  };
}
