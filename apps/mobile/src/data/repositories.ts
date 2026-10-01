import { createLocalRepositories } from './localRepositories';
import { isUnlocked, vaultStorage } from './vault';
import { sharedClientRepository, sharedMatterRepository, sharedEngine } from './sharedRepositories';
import type { Matter, MatterRepository } from '@maktabi/domain';
export { OFFICE_ID, newId } from './sharedRepositories';
const shared = async () => {
  const state = await sharedEngine().store.read();
  const clients = Object.values(state.clients).map(r => r.value); const matters = Object.values(state.matters).map(r => r.value);
  return { clients: [...clients, ...clients.filter(c => state.legacyLinks.clients[c.id]).map(c => ({ ...c, id: state.legacyLinks.clients[c.id]!, officeId: 'office-1' }))], matters: [...matters, ...matters.filter(m => state.legacyLinks.matters[m.id]).map(m => ({ ...m, id: state.legacyLinks.matters[m.id]!, officeId: 'office-1', parties: m.parties.map(p => ({ ...p, matterId: state.legacyLinks.matters[m.id]!, clientId: p.clientId ? state.legacyLinks.clients[p.clientId] ?? p.clientId : undefined })) }))] };
};
let repositories = createLocalRepositories(vaultStorage, shared);
export function resetRepositories() { repositories = createLocalRepositories(vaultStorage, shared); }
function dynamic<T extends object>(key: keyof typeof repositories): T { return new Proxy({} as T, { get: (_target, method) => async (...args: unknown[]) => {
  if (!isUnlocked()) throw new Error('افتح العمليات المحلية السابقة من شاشة المزيد');
  const state = await sharedEngine().store.read(); const id = args[0];
  if (typeof id === 'string' && (key === 'workflowRepository' || (key === 'officeRepository' && state.matters[id]))) {
    if (!state.matters[id]) throw new Error('القضية غير متاحة لهذا الحساب');
    args[0] = state.legacyLinks.matters[id] ?? id;
  }
  if (key === 'profileRepository' && typeof id === 'string') args[0] = state.legacyLinks.clients[id] ?? id;
  const result = await Reflect.get(repositories[key], method)(...args);
  if (method === 'closeMatter' && typeof id === 'string') { const matter = await sharedMatterRepository.getById(id); if (matter) await sharedMatterRepository.save({ ...matter, status: 'CLOSED' }); }
  return result;
} }); }
export const clientRepository = sharedClientRepository;
async function withLocalMetadata(matter: Matter): Promise<Matter> {
  if (!isUnlocked()) return matter;
  const state = await sharedEngine().store.read();
  const local = await repositories.matterRepository.getById(state.legacyLinks.matters[matter.id] ?? matter.id);
  return { ...matter, nextEventAt: local?.nextEventAt, currentStage: local?.currentStage };
}
export const matterRepository: MatterRepository = {
  async getById(id) { const matter = await sharedMatterRepository.getById(id); return matter ? withLocalMetadata(matter) : null; },
  async listByOffice(id) { return Promise.all((await sharedMatterRepository.listByOffice(id)).map(withLocalMetadata)); },
  async listByClient(id) { return Promise.all((await sharedMatterRepository.listByClient(id)).map(withLocalMetadata)); },
  async listActive(id) { return (await this.listByOffice(id)).filter(m => m.status === 'ACTIVE'); },
  save: sharedMatterRepository.save,
};
export const profileRepository = dynamic<typeof repositories.profileRepository>('profileRepository');
export const workflowRepository = dynamic<typeof repositories.workflowRepository>('workflowRepository');
export const officeRepository = dynamic<typeof repositories.officeRepository>('officeRepository');
