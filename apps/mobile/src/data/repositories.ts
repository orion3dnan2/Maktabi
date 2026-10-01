import { supabase } from '@/lib/supabase';
import { composeRepositories } from './composition';
import { createLocalRepositories } from './localRepositories';
import { createSupabaseClientRepository, type SupabaseClientRepository } from './supabase/clientRepository';
import { createSupabaseMatterRepository } from './supabase/matterRepository';
import { createSupabaseWorkflowRepository } from './supabase/workflowRepository';
import { isUnlocked, vaultStorage } from './vault';
export { OFFICE_ID, newId } from './ids';

/**
 * The app's data access. Screens use these objects only; none of them calls Supabase directly.
 * - clientRepository, matterRepository: Supabase, the single source of truth (RLS applies).
 * - workflowRepository, officeRepository: appointments, procedure stages, deadlines, notes,
 *   office procedure templates and matter activity in Supabase; documents, fees, receipts,
 *   expenses, trust and office settings still in the device's encrypted vault (keyed by the
 *   server's matter ids, not synchronized yet).
 */
const remoteClients = createSupabaseClientRepository(supabase);
const remoteMatters = createSupabaseMatterRepository(supabase);
const remoteWorkflow = createSupabaseWorkflowRepository(supabase);

let local = createLocalRepositories(vaultStorage, remoteMatters, remoteWorkflow);
export function resetRepositories() { local = createLocalRepositories(vaultStorage, remoteMatters, remoteWorkflow); }

const composed = composeRepositories({ server: remoteWorkflow, matters: remoteMatters, device: () => local, unlocked: isUnlocked });

export const clientRepository: SupabaseClientRepository = remoteClients;
export const { matterRepository, workflowRepository, officeRepository, profileRepository } = composed;
