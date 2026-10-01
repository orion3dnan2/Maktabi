import { createLocalStore, type MatterSource, type StageSource } from './localStore';

export interface LocalStorage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
export const STORAGE_KEY = 'maktabi:office-1:v1';

/**
 * The device-local store with durable storage. Writes are serialized and memory is rolled back
 * if durable storage fails, so reads never see half a write. Matters and their procedure stages
 * come from `matters` and `stages` (Supabase in the app).
 */
export function createLocalRepositories(storage: LocalStorage, matters: MatterSource, stages: StageSource) {
  const core = createLocalStore(matters, stages);
  let loading: Promise<void> | undefined;
  let queue = Promise.resolve();
  const ready = () => loading ??= storage.getItem(STORAGE_KEY).then((raw) => {
    if (raw) core.restore(JSON.parse(raw));
  });
  const read = <A extends unknown[], R>(method: (...args: A) => Promise<R>) => async (...args: A): Promise<R> => {
    await ready(); await queue; return method(...args);
  };
  const write = <A extends unknown[], R>(method: (...args: A) => Promise<R>) => async (...args: A): Promise<R> => {
    await ready();
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
  function persistent<T extends object>(repository: T): T {
    return new Proxy(repository, {
      get(target, key: string) {
        const method = Reflect.get(target, key) as (...args: unknown[]) => Promise<unknown>;
        if (typeof method !== 'function') return method;
        return (/^(get|list)/.test(key) ? read : write)(method);
      },
    });
  }
  return {
    profileRepository: persistent(core.profileRepository),
    workflowRepository: persistent(core.workflowRepository),
    officeRepository: persistent(core.officeRepository),
  };
}
