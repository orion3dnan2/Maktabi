import { createLocalRepositories } from './localRepositories';
import { isUnlocked, vaultStorage } from './vault';
export { OFFICE_ID, newId } from './mockRepositories';
let repositories = createLocalRepositories(vaultStorage);
export function resetRepositories() { repositories = createLocalRepositories(vaultStorage); }
function dynamic<T extends object>(key: keyof typeof repositories): T { return new Proxy({} as T, { get: (_target, method) => async (...args: unknown[]) => { if (!isUnlocked()) throw new Error('سجل الدخول لفتح بيانات المكتب'); return Reflect.get(repositories[key], method)(...args); } }); }
export const clientRepository = dynamic<typeof repositories.clientRepository>('clientRepository');
export const matterRepository = dynamic<typeof repositories.matterRepository>('matterRepository');
export const profileRepository = dynamic<typeof repositories.profileRepository>('profileRepository');
export const workflowRepository = dynamic<typeof repositories.workflowRepository>('workflowRepository');
export const officeRepository = dynamic<typeof repositories.officeRepository>('officeRepository');
