import type { Matter } from '@maktabi/domain';
import { supabase } from '@/lib/supabase';
import { createLocalRepositories } from './localRepositories';
import { createSupabaseClientRepository, type SupabaseClientRepository } from './supabase/clientRepository';
import { createSupabaseMatterRepository, type SupabaseMatterRepository } from './supabase/matterRepository';
import { isUnlocked, vaultStorage } from './vault';
export { OFFICE_ID, newId } from './ids';

/**
 * The app's data access. Screens use these objects only; none of them calls Supabase directly.
 * - clientRepository, matterRepository: Supabase, the single source of truth (RLS applies).
 * - workflowRepository, officeRepository, profileRepository: device-local encrypted vault
 *   (appointments, documents, fees, receipts, procedure stages, office settings), keyed by the
 *   server's matter ids. Not synchronized yet.
 */
const remoteClients = createSupabaseClientRepository(supabase);
const remoteMatters = createSupabaseMatterRepository(supabase);

let local = createLocalRepositories(vaultStorage, remoteMatters);
export function resetRepositories() { local = createLocalRepositories(vaultStorage, remoteMatters); }
function dynamic<T extends object>(key: 'profileRepository' | 'workflowRepository' | 'officeRepository'): T { return new Proxy({} as T, { get: (_target, method) => async (...args: unknown[]) => { if (!isUnlocked()) throw new Error('سجل الدخول لفتح بيانات المكتب'); return Reflect.get(local[key], method)(...args); } }); }

/** Adds this device's next appointment and current stage to each matter; the matter itself is unchanged. */
const withProgress = async (matters: Matter[]) => (isUnlocked() ? local.progress(matters) : matters);

export const clientRepository: SupabaseClientRepository = remoteClients;
export const matterRepository: SupabaseMatterRepository = {
  ...remoteMatters,
  async getById(id) { const matter = await remoteMatters.getById(id); return matter && (await withProgress([matter]))[0]!; },
  listByOffice: async (officeId) => withProgress(await remoteMatters.listByOffice(officeId)),
  listByClient: async (clientId) => withProgress(await remoteMatters.listByClient(clientId)),
  listActive: async (officeId) => withProgress(await remoteMatters.listActive(officeId)),
};
export const profileRepository = dynamic<typeof local.profileRepository>('profileRepository');
export const workflowRepository = dynamic<typeof local.workflowRepository>('workflowRepository');
export const officeRepository = dynamic<typeof local.officeRepository>('officeRepository');
