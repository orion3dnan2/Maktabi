import type { Matter } from '@maktabi/domain';
import type { createLocalRepositories } from './localRepositories';
import { builtinProcedures, type ProcedureStage, type ProcedureTemplate } from './office';
import type { SupabaseMatterRepository } from './supabase/matterRepository';
import type { ServerWorkflow, SupabaseWorkflowRepository } from './supabase/workflowRepository';
import type { MatterWorkflow } from './workflow';
import { emptyWorkflow } from './workflow';
import { RepositoryError } from './supabase/errors';

type Device = ReturnType<typeof createLocalRepositories>;
type DeviceOffice = Device['officeRepository'];

const newestFirst = (a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date);

/** One matter's workflow as the screens see it: the server's part plus what is still on this device. */
export function mergeWorkflow(server: ServerWorkflow, device: MatterWorkflow): MatterWorkflow {
  const { currentStage, ...rest } = device;
  void currentStage; // the device value predates the move of stages and notes to the server
  return {
    ...rest,
    appointments: server.appointments, stages: server.stages, deadlines: server.deadlines, notes: server.notes,
    activity: [...server.activity, ...device.activity].sort(newestFirst),
    ...(server.currentStage ? { currentStage: server.currentStage } : {}),
  };
}

export interface CompositionSources {
  server: SupabaseWorkflowRepository;
  matters: SupabaseMatterRepository;
  /** The device store of the signed-in user (it changes when another user unlocks the device). */
  device: () => Device;
  unlocked: () => boolean;
}

/**
 * The repositories the screens use. Appointments, procedure stages, deadlines, notes, office
 * templates and matter activity come from Supabase; documents, fees, receipts, expenses, trust
 * and office settings are still in the encrypted vault on this device (next slices).
 */
export function composeRepositories({ server, matters, device, unlocked }: CompositionSources) {
  const onDevice = () => {
    if (!unlocked()) throw new Error('سجل الدخول لفتح بيانات المكتب');
    return device();
  };
  /** A device office operation, looked up when called (after sign-in unlocked the vault). */
  const deviceOffice = <K extends keyof DeviceOffice>(key: K): DeviceOffice[K] =>
    (async (...args: unknown[]) => (onDevice().officeRepository[key] as (...a: unknown[]) => Promise<unknown>)(...args)) as unknown as DeviceOffice[K];

  /** Adds each matter's next scheduled appointment and current stage (server); the matter itself is unchanged. */
  const withProgress = async (list: Matter[]): Promise<Matter[]> => {
    try {
      const progress = await server.progress(list.map((m) => m.id));
      return list.map((m) => ({ ...m, ...progress.get(m.id) }));
    } catch (error) {
      if (error instanceof RepositoryError && error.kind === 'connection') return list;
      throw error;
    }
  };

  const matterRepository: SupabaseMatterRepository = {
    ...matters,
    async getById(id) { const matter = await matters.getById(id); return matter && (await withProgress([matter]))[0]!; },
    listByOffice: async (officeId) => withProgress(await matters.listByOffice(officeId)),
    listByClient: async (clientId) => withProgress(await matters.listByClient(clientId)),
    listActive: async (officeId) => withProgress(await matters.listActive(officeId)),
  };

  const listTemplates = async (): Promise<ProcedureTemplate[]> => [...builtinProcedures, ...(await server.listTemplates())];

  const workflowRepository = {
    async getByMatter(id: string): Promise<MatterWorkflow> {
      if (!await matters.getById(id)) throw new Error('القضية غير موجودة أو لا تملك صلاحية الوصول إليها');
      const [remote, onThisDevice] = await Promise.all([server.getByMatter(id), unlocked() ? device().workflowRepository.getByMatter(id) : emptyWorkflow()]);
      return mergeWorkflow(remote, onThisDevice);
    },
    /** Only the part kept on this device (fees, receipts, documents): for totals over many matters. */
    getOnDevice: async (id: string) => unlocked() ? device().workflowRepository.getByMatter(id) : emptyWorkflow(),
    addAppointment: server.addAppointment,
    setAppointmentStatus: server.setAppointmentStatus,
    finishSession: server.finishSession,
    addNote: server.addNote,
    /** The database refuses while an appointment, a deadline or a stage is still open. */
    closeMatter: (id: string) => matters.setStatus(id, 'CLOSED'),
    listScheduled: server.listScheduled,
    listOpenDeadlines: server.listOpenDeadlines,
    listRecentEvents: server.listRecentEvents,
    setFees: async (id: string, amount: number) => onDevice().workflowRepository.setFees(id, amount),
    recordPayment: async (...args: Parameters<Device['workflowRepository']['recordPayment']>) => onDevice().workflowRepository.recordPayment(...args),
    addDocument: async (...args: Parameters<Device['workflowRepository']['addDocument']>) => onDevice().workflowRepository.addDocument(...args),
  };

  const officeRepository = {
    listTemplates,
    async saveTemplate(template: ProcedureTemplate) {
      if (builtinProcedures.some((t) => t.id === template.id)) throw new Error('احفظ نسخة مخصصة من القالب الأساسي');
      await server.saveTemplate(template);
    },
    async appendProcedure(matterId: string, templateId: string) {
      const [matter, templates] = await Promise.all([matters.getById(matterId), listTemplates()]);
      if (!matter) throw new Error('القضية غير موجودة أو لا تملك صلاحية الوصول إليها');
      const template = templates.find((t) => t.id === templateId);
      if (!template || !template.types.includes(matter.type)) throw new Error('اختر مساراً مناسباً لنوع القضية');
      await server.appendProcedure(matterId, template);
    },
    /** Documents are still on this device, so the stage may only name documents of this matter found here. */
    async saveStage(matterId: string, stage: ProcedureStage) {
      if (stage.documentIds.length) {
        const { documents } = await onDevice().workflowRepository.getByMatter(matterId);
        if (stage.documentIds.some((id) => !documents.some((d) => d.id === id))) throw new Error('اختر مستندات من القضية');
      }
      await server.saveStage(matterId, stage);
    },
    transitionStage: server.transitionStage,
    addDeadline: server.addDeadline,
    completeDeadline: server.completeDeadline,
    listReadiness: deviceOffice('listReadiness'),
    submitReadiness: deviceOffice('submitReadiness'),
    getSettings: deviceOffice('getSettings'),
    saveSettings: deviceOffice('saveSettings'),
    saveInstallments: deviceOffice('saveInstallments'),
    issueReceipt: deviceOffice('issueReceipt'),
    cancelReceipt: deviceOffice('cancelReceipt'),
    depositTrust: deviceOffice('depositTrust'),
    recordExpense: deviceOffice('recordExpense'),
    voidExpense: deviceOffice('voidExpense'),
  };

  const profileRepository = {
    /** Fees, receipts and documents from this device; activity from both, for matters where the client is primary. */
    async getByClient(clientId: string, known?: Matter[]) {
      const list = known ?? (await matters.listByClient(clientId));
      const profile = await onDevice().profileRepository.getByClient(clientId, list);
      const primary = list.filter((m) => m.parties.some((p) => p.isPrimary && p.clientId === clientId));
      const reference = new Map(primary.map((m) => [m.id, m.reference]));
      const events = await server.listRecentEvents(50, primary.map((m) => m.id));
      profile.activity = [...events.map((e) => ({ title: `${reference.get(e.matterId)} · ${e.title}`, date: e.date })), ...profile.activity].sort(newestFirst);
      return profile;
    },
  };

  return { matterRepository, workflowRepository, officeRepository, profileRepository };
}
