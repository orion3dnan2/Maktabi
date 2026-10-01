import type { Matter } from '@maktabi/domain';
import { newId } from './ids';
import { emptyWorkflow, paidTotal, trustBalance, type DeviceWorkflowRepository, type MatterWorkflow } from './workflow';
import { defaultOffice, type OfficeData } from './office';
import { createOfficeOperations } from './officeOperations';

/**
 * Device-local office data: each matter's documents, fees, receipts, expenses and trust deposits
 * (with their activity lines), and the office settings. It lives in the user's encrypted vault on
 * this device and is not synchronized yet.
 *
 * Clients, matters, appointments, procedure stages, deadlines and notes are NOT stored here:
 * Supabase is their only source of truth. Workflows are keyed by the server's matter id, and every
 * write first reads the matter from the server, so a workflow can only be changed for a matter the
 * user can currently see, in its current status.
 */
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export interface ClientProfileData {
  agreedFees: number;
  paidFees: number;
  trustBalance: number;
  expenses: number;
  receipts: { number: string; amount: number; date: string }[];
  documents: { title: string; date: string }[];
  activity: { title: string; date: string }[];
}
export interface ProfileRepository {
  /** Totals from the workflows of the matters where the client is the primary client. Pass `matters` when already loaded. */
  getByClient(id: string, matters?: Matter[]): Promise<ClientProfileData>;
}

/** What the local store needs from the server-side matters. */
export interface MatterSource {
  getById(id: string): Promise<Matter | null>;
  listByClient(clientId: string): Promise<Matter[]>;
}
/** Procedure stages live on the server; fees and expenses may name one of them. */
export interface StageSource { stageIds(matterId: string): Promise<string[]> }

/** Version 1 (before Phase 2) also held clients, matters and profiles, and workflows keyed by device-made matter ids. */
export interface LegacyLocalRecords { clients: unknown[]; matters: unknown[]; profiles: unknown[]; workflows: unknown[] }
export interface LocalSnapshot {
  version: 2;
  workflows: [string, MatterWorkflow][];
  office: OfficeData;
  /** Version-1 records, kept encrypted and unread so nothing typed on the device is lost. They are not shown or synchronized. */
  legacy?: LegacyLocalRecords;
}

const isArray = (value: unknown): value is unknown[] => Array.isArray(value);
type Stored = Record<string, unknown>;
/** Accepts a stored snapshot of either version; anything else is refused rather than replaced with an empty office. */
export function parseSnapshot(value: unknown): LocalSnapshot {
  const s = (value ?? {}) as Stored;
  if (s.version === 2 && isArray(s.workflows) && s.office && typeof s.office === 'object') return copy(s as unknown as LocalSnapshot);
  if (s.version === 1 && isArray(s.clients) && isArray(s.matters) && isArray(s.profiles) && isArray(s.workflows)) {
    const legacy: LegacyLocalRecords = { clients: s.clients, matters: s.matters, profiles: s.profiles, workflows: s.workflows };
    const empty = !legacy.clients.length && !legacy.matters.length && !legacy.profiles.length && !legacy.workflows.length;
    return copy({ version: 2, workflows: [], office: (s.office as OfficeData | undefined) ?? defaultOffice(), ...(empty ? {} : { legacy }) });
  }
  throw new Error('تعذر قراءة البيانات المحلية');
}
/** True for data a backup may contain (version 1 or 2). */
export function isLocalSnapshot(value: unknown): boolean {
  try { parseSnapshot(value); return true; } catch { return false; }
}
export const emptySnapshot = (): LocalSnapshot => ({ version: 2, workflows: [], office: defaultOffice() });

export function createLocalStore(matters: MatterSource, stages: StageSource, legacyId?: (id: string) => Promise<string | undefined>) {
  let office = defaultOffice();
  let legacy: LegacyLocalRecords | undefined;
  const workflows = new Map<string, MatterWorkflow>();
  // Matters read from the server for the operation in progress.
  const current = new Map<string, Matter>();

  const load = async (id: string) => {
    const matter = await matters.getById(id);
    if (!matter) throw new Error('القضية غير موجودة أو لا تملك صلاحية الوصول إليها');
    current.set(id, matter);
    if (!workflows.has(id) && legacy && legacyId) {
      const oldId = await legacyId(id);
      const entry = legacy.workflows.find((row) => Array.isArray(row) && row[0] === oldId);
      if (Array.isArray(entry) && entry[1] && typeof entry[1] === 'object') {
        // Preserve the original in legacy; new writes use the verified shared matter id.
        workflows.set(id, copy({ ...emptyWorkflow(), ...entry[1] }));
      }
    }
    return matter;
  };
  const requireMatter = (id: string) => {
    const matter = current.get(id);
    if (!matter) throw new Error('القضية غير موجودة');
    return matter;
  };
  const getWorkflow = (id: string) => copy({ ...emptyWorkflow(), ...workflows.get(id) });
  const commitWorkflow = (id: string, value: MatterWorkflow, title: string) => {
    value.activity.unshift({ title, date: new Date().toISOString() });
    workflows.set(id, copy(value));
  };
  const writable = (id: string) => {
    const m = requireMatter(id);
    if (m.status === 'CLOSED' || m.status === 'ARCHIVED') throw new Error('القضية مغلقة؛ لا يمكن إضافة عمليات جديدة');
    return getWorkflow(id);
  };
  /** Every workflow write reads the matter from the server first (existence, access and current status). */
  const scoped = <A extends unknown[], R>(operation: (id: string, ...rest: A) => Promise<R>) =>
    async (id: string, ...rest: A): Promise<R> => { await load(id); return operation(id, ...rest); };

  const workflowRepository: DeviceWorkflowRepository = {
    async getByMatter(id) { await load(id); return getWorkflow(id); },
    setFees: scoped(async (id, amount: number) => {
      const w = writable(id);
      if (!Number.isSafeInteger(amount) || amount <= 0 || amount < paidTotal(w)) throw new Error('الأتعاب يجب أن تكون موجبة ولا تقل عن المدفوع');
      w.agreedFees = amount;
      commitWorkflow(id, w, 'تسجيل اتفاق الأتعاب');
    }),
    recordPayment: scoped(async (id, receipt: Parameters<DeviceWorkflowRepository['recordPayment']>[1]) => {
      const w = writable(id);
      if (w.receipts.some((r) => r.id === receipt.id)) return;
      if (!receipt.id || !receipt.number.trim() || !receipt.method.trim() || !Number.isFinite(Date.parse(receipt.date))) throw new Error('بيانات الإيصال غير مكتملة');
      if ([...workflows.values()].some((v) => v.receipts.some((r) => r.number === receipt.number))) throw new Error('رقم الإيصال مستخدم بالفعل');
      if (!Number.isSafeInteger(receipt.amount) || receipt.amount <= 0 || receipt.amount > w.agreedFees - paidTotal(w)) throw new Error('الدفعة يجب أن تكون موجبة ولا تتجاوز الأتعاب المتبقية');
      w.receipts.push(copy(receipt));
      commitWorkflow(id, w, `تسجيل دفعة وإصدار الإيصال ${receipt.number}`);
    }),
    addDocument: scoped(async (id, document: Parameters<DeviceWorkflowRepository['addDocument']>[1]) => {
      const w = writable(id);
      if (!document.title.trim() || !document.name.trim() || !/^data:[\w.+/-]+;base64,[A-Za-z0-9+/]*={0,2}$/.test(document.dataUri) || document.dataUri.length > 1500000) throw new Error('اختر مستنداً صالحاً بحجم لا يتجاوز 1 ميجابايت');
      if (w.documents.some((d) => d.id === document.id)) return;
      w.documents.push(copy(document));
      commitWorkflow(id, w, `إرفاق مستند: ${document.title}`);
    }),
  };

  const operations = createOfficeOperations({ get: () => copy(office), set: (value) => { office = copy(value); }, id: newId, matter: requireMatter, read: getWorkflow, write: writable, commit: commitWorkflow, stageIds: stages.stageIds });
  const officeRepository = {
    ...operations,
    saveInstallments: scoped(operations.saveInstallments),
    issueReceipt: scoped(operations.issueReceipt),
    cancelReceipt: scoped(operations.cancelReceipt),
    depositTrust: scoped(operations.depositTrust),
    recordExpense: scoped(operations.recordExpense),
    voidExpense: scoped(operations.voidExpense),
  };

  const profileRepository: ProfileRepository = {
    async getByClient(id, known) {
      const list = known ?? await matters.listByClient(id);
      const result: ClientProfileData = { agreedFees: 0, paidFees: 0, trustBalance: 0, expenses: 0, receipts: [], documents: [], activity: [] };
      for (const m of list.filter((m) => m.parties.some((p) => p.isPrimary && p.clientId === id))) {
        await load(m.id);
        if (!workflows.has(m.id)) continue;
        const w = getWorkflow(m.id);
        result.agreedFees += w.agreedFees;
        result.paidFees += paidTotal(w);
        result.trustBalance += trustBalance(w);
        result.expenses += w.expenses.reduce((n, e) => n + (e.voidReason ? 0 : e.amount), 0);
        result.receipts.push(...w.receipts);
        result.documents.push(...w.documents);
        result.activity.push(...w.activity.map((a) => ({ ...a, title: `${m.reference} · ${a.title}` })));
      }
      result.activity.sort((a, b) => b.date.localeCompare(a.date));
      return result;
    },
  };

  return {
    workflowRepository, officeRepository, profileRepository,
    snapshot: (): LocalSnapshot => copy({ version: 2, workflows: [...workflows], office, ...(legacy ? { legacy } : {}) }),
    restore: (value: unknown) => {
      const snapshot = parseSnapshot(value);
      workflows.clear(); snapshot.workflows.forEach(([id, w]) => workflows.set(id, w));
      office = snapshot.office;
      legacy = snapshot.legacy;
      current.clear();
    },
  };
}
