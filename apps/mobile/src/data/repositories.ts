import { supabase } from '@/lib/supabase';
import { composeRepositories } from './composition';
import { createLocalRepositories } from './localRepositories';
import { sharedClientRepository, sharedMatterRepository, sharedEngine } from './sharedRepositories';
import { createSupabaseWorkflowRepository } from './supabase/workflowRepository';
import { createScopedVaultStorage, isUnlocked } from './vault';
export { OFFICE_ID, newId } from './sharedRepositories';

/**
 * The app's data access. Screens use these objects only; none of them calls Supabase directly.
 * - clientRepository, matterRepository: encrypted offline cache/outbox → Supabase (RLS applies).
 * - workflowRepository, officeRepository: appointments, procedure stages, deadlines, notes,
 *   office procedure templates and matter activity in Supabase; documents, fees, receipts,
 *   expenses, trust and office settings still in the device's encrypted vault (keyed by the
 *   server's matter ids, not synchronized yet).
 */
const remoteMatters = sharedMatterRepository;
const remoteWorkflow = createSupabaseWorkflowRepository(supabase);
const legacyId = async (id: string) => {
  const state = await sharedEngine().store.read();
  // Only explicitly imported records or same-id records already scoped to this office.
  if (!state.matters[id]) return undefined;
  return state.legacyLinks.matters[id] ?? id;
};

let local = createLocalRepositories(createScopedVaultStorage(), remoteMatters, remoteWorkflow, legacyId);
export function resetRepositories() { local = createLocalRepositories(createScopedVaultStorage(), remoteMatters, remoteWorkflow, legacyId); }

const composed = composeRepositories({ server: remoteWorkflow, matters: remoteMatters, device: () => local, unlocked: isUnlocked });

export const clientRepository = sharedClientRepository;
export const { matterRepository, workflowRepository, officeRepository, profileRepository } = composed;
