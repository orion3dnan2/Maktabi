import {
  validateClient,
  validateMatter,
  type Client,
  type ClientRepository,
  type Matter,
  type MatterRepository,
  type MatterType,
} from "@maktabi/domain";
import { emptyWorkflow, paidTotal, trustBalance, type MatterWorkflow, type DeviceWorkflowRepository } from './workflow';
import { defaultOffice, type OfficeData } from './office';
import { createOfficeOperations } from './legacyOfficeOperations';
export const OFFICE_ID = "office-1";
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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
  getByClient(id: string): Promise<ClientProfileData>;
}
export interface RepositorySnapshot { version: 1; clients: Client[]; matters: Matter[]; profiles: [string, ClientProfileData][]; workflows: [string, MatterWorkflow][]; office?: OfficeData }
export function createMockRepositories() {
  let office = defaultOffice();
  const clients: Client[] = [
    {
      id: "c1",
      officeId: OFFICE_ID,
      displayName: "أمجد الطيب عثمان",
      kind: "PERSON",
      phone: "+249000000101",
      whatsapp: "+249000000101",
      address: "أم درمان — عنوان تجريبي",
      notes: "شخصية خيالية للتجربة",
      createdAt: "2026-08-01T09:00:00Z",
    },
    {
      id: "c2",
      officeId: OFFICE_ID,
      displayName: "شركة روافد السهول الافتراضية",
      kind: "ORGANIZATION",
      contactPerson: "سلمى محجوب — شخصية خيالية",
      phone: "+249000000102",
      whatsapp: "+249000000102",
      email: "office@example.test",
      address: "بورتسودان — عنوان تجريبي",
      registration: "DEMO-102",
      createdAt: "2026-08-02T09:00:00Z",
    },
    {
      id: "c3",
      officeId: OFFICE_ID,
      displayName: "هالة عبد الرحمن إدريس",
      kind: "PERSON",
      phone: "+249000000103",
      whatsapp: "+249000000103",
      createdAt: "2026-08-03T09:00:00Z",
    },
    {
      id: "c4",
      officeId: OFFICE_ID,
      displayName: "مؤسسة آفاق الجزيرة الافتراضية",
      kind: "ORGANIZATION",
      contactPerson: "معتز النور — شخصية خيالية",
      phone: "+249000000104",
      whatsapp: "+249000000104",
      email: "contact@example.test",
      address: "كسلا — عنوان تجريبي",
      createdAt: "2026-08-04T09:00:00Z",
    },
  ];
  const types: MatterType[] = [
    "CIVIL",
    "LABOUR",
    "CRIMINAL",
    "PERSONAL_STATUS",
    "SPECIAL_COURT",
    "COMMERCIAL_REGISTRY",
    "LAND_REGISTRY",
    "NOTARIZATION",
    "OTHER",
  ];
  const titles = [
    "مطالبة بقيمة توريد",
    "مستحقات عمل",
    "دفاع أولي تجريبي",
    "طلب أحوال شخصية",
    "طلب لدى محكمة خاصة",
    "تحديث بيانات منشأة",
    "طلب تسجيل قطعة",
    "توثيق اتفاق",
    "استشارة تعاقدية",
  ];
  const matters: Matter[] = types.map((type, i) => {
    const client = clients[i % 3]!;
    const id = `m${i + 1}`;
    return {
      id,
      officeId: OFFICE_ID,
      reference: `MK-2026-${String(i + 1).padStart(3, "0")}`,
      title: titles[i]!,
      type,
      authority:
        i % 2
          ? "جهة التسجيل الافتراضية — بورتسودان"
          : "محكمة أم درمان التجريبية",
      status: i === 7 ? "CLOSED" : i === 8 ? "ON_HOLD" : "ACTIVE",
      openedAt: `2026-09-${String(i + 1).padStart(2, "0")}`,
      nextEventAt:
        i < 4
          ? `2026-10-${String(i + 1).padStart(2, "0")}T09:00:00Z`
          : undefined,
      currentStage: i < 4 ? "جمع المستندات — وصف تجريبي" : undefined,
      details: {},
      notes: "بيانات خيالية، لا تمثل قاعدة أو إجراء قانونياً.",
      parties: [
        {
          id: `p${i}`,
          matterId: id,
          clientId: client.id,
          displayName: client.displayName,
          role: "CLIENT",
          isPrimary: true,
        },
        ...(i === 0
          ? [
              {
                id: "p-secondary",
                matterId: id,
                clientId: "c2",
                displayName: clients[1]!.displayName,
                role: "CLIENT" as const,
                isPrimary: false,
              },
            ]
          : []),
      ],
    };
  });
  const profiles = new Map<string, ClientProfileData>(
    clients.slice(0, 3).map((c, i) => [
      c.id,
      {
        agreedFees: (i + 1) * 18000000,
        paidFees: (i + 1) * 6000000,
        trustBalance: (i + 1) * 2500000,
        expenses: (i + 1) * 1000000,
        receipts: [
          {
            number: `RC-DEMO-${i + 1}`,
            amount: (i + 1) * 6000000,
            date: "2026-09-20",
          },
        ],
        documents: [
          { title: "اتفاق أتعاب تجريبي", date: "2026-09-10" },
          { title: "مستندات العميل — سجل تجريبي", date: "2026-09-15" },
        ],
        activity: [{ title: "استلام مستندات تجريبية", date: "2026-09-20" }],
      },
    ]),
  );
  const workflows = new Map<string, MatterWorkflow>();
  const requireMatter = (id: string) => {
    const matter = matters.find((m) => m.id === id);
    if (!matter) throw new Error('القضية غير موجودة');
    return matter;
  };
  const getWorkflow = (id: string) => {
    const m = requireMatter(id); const value = { ...emptyWorkflow(), ...workflows.get(id) };
    if (!workflows.has(id) && m.nextEventAt) value.appointments.push({ id: `initial-${id}`, title: 'جلسة القضية', startsAt: m.nextEventAt, status: 'SCHEDULED', kind: 'COURT_SESSION' });
    return copy(value);
  };
  const commitWorkflow = (id: string, value: MatterWorkflow, title: string) => {
    value.activity.unshift({ title, date: new Date().toISOString() });
    workflows.set(id, copy(value));
    const m = requireMatter(id);
    const next = value.appointments.filter((a) => a.status === 'SCHEDULED').sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
    m.nextEventAt = next?.startsAt;
  };
  const writable = (id: string) => {
    const m = requireMatter(id);
    if (m.status === 'CLOSED' || m.status === 'ARCHIVED') throw new Error('القضية مغلقة؛ لا يمكن إضافة عمليات جديدة');
    return getWorkflow(id);
  };
  const workflowRepository: DeviceWorkflowRepository & {
    addAppointment(id:string,item:{title:string;startsAt:string}):Promise<void>;
    setAppointmentStatus(id:string,appointmentId:string,status:'COMPLETED'|'CANCELLED'):Promise<void>;
    addNote(id:string,text:string):Promise<void>; closeMatter(id:string):Promise<void>;
  } = {
    async getByMatter(id) { return getWorkflow(id); },
    async addAppointment(id, item) {
      if (!item.title.trim() || !Number.isFinite(Date.parse(item.startsAt))) throw new Error('عنوان الموعد وتاريخه مطلوبان');
      const w = writable(id);
      w.appointments.push({ ...item, title: item.title.trim(), startsAt: new Date(item.startsAt).toISOString(), id: newId(), status: 'SCHEDULED', kind: 'COURT_SESSION' });
      commitWorkflow(id, w, `جدولة موعد: ${item.title.trim()}`);
    },
    async setAppointmentStatus(id, appointmentId, status) {
      const w = writable(id); const a = w.appointments.find((a) => a.id === appointmentId);
      if (!a || !['SCHEDULED', 'COMPLETED', 'CANCELLED'].includes(status)) throw new Error('الموعد أو الحالة غير صحيحة');
      a.status = status;
      commitWorkflow(id, w, `${status === 'COMPLETED' ? 'إتمام' : status === 'CANCELLED' ? 'إلغاء' : 'إعادة جدولة'} الموعد: ${a.title}`);
    },
    async setFees(id, amount) {
      const w = writable(id);
      if (!Number.isSafeInteger(amount) || amount <= 0 || amount < paidTotal(w)) throw new Error('الأتعاب يجب أن تكون موجبة ولا تقل عن المدفوع');
      w.agreedFees = amount;
      commitWorkflow(id, w, 'تسجيل اتفاق الأتعاب');
    },
    async recordPayment(id, receipt) {
      const w = writable(id);
      if (w.receipts.some((r) => r.id === receipt.id)) return;
      if (!receipt.id || !receipt.number.trim() || !receipt.method.trim() || !Number.isFinite(Date.parse(receipt.date))) throw new Error('بيانات الإيصال غير مكتملة');
      if ([...workflows.values()].some((v) => v.receipts.some((r) => r.number === receipt.number))) throw new Error('رقم الإيصال مستخدم بالفعل');
      if (!Number.isSafeInteger(receipt.amount) || receipt.amount <= 0 || receipt.amount > w.agreedFees - paidTotal(w)) throw new Error('الدفعة يجب أن تكون موجبة ولا تتجاوز الأتعاب المتبقية');
      w.receipts.push(copy(receipt));
      commitWorkflow(id, w, `تسجيل دفعة وإصدار الإيصال ${receipt.number}`);
    },
    async addDocument(id, document) {
      const w = writable(id);
      if (!document.title.trim() || !document.name.trim() || !/^data:[\w.+/-]+;base64,[A-Za-z0-9+/]*={0,2}$/.test(document.dataUri) || document.dataUri.length > 1500000) throw new Error('اختر مستنداً صالحاً بحجم لا يتجاوز 1 ميجابايت');
      if (w.documents.some((d) => d.id === document.id)) return;
      w.documents.push(copy(document));
      commitWorkflow(id, w, `إرفاق مستند: ${document.title}`);
    },
    async addNote(id, text) {
      if (!text.trim()) throw new Error('اكتب الملاحظة أولاً');
      const w = writable(id); w.notes.unshift({ id: newId(), text: text.trim(), date: new Date().toISOString() });
      if (!w.stages.length) requireMatter(id).currentStage = text.trim();
      commitWorkflow(id, w, 'إضافة ملاحظة متابعة');
    },
    async closeMatter(id) {
      const w = writable(id);
      if (w.appointments.some((a) => a.status === 'SCHEDULED')) throw new Error('أكمل أو ألغِ المواعيد المعلقة قبل إغلاق القضية');
      if (w.deadlines.some((d) => !d.completed) || w.stages.some((s) => s.status === 'ACTIVE' || s.status === 'PENDING')) throw new Error('أنهِ مراحل الإجراءات والمواعيد النهائية قبل الإغلاق');
      requireMatter(id).status = 'CLOSED';
      commitWorkflow(id, w, 'إغلاق القضية');
    },
  };
  const clientRepository: ClientRepository = {
    async setStatus(id,status) { const c=clients.find(c=>c.id===id); if(!c) throw new Error('العميل غير موجود'); c.status=status; },
    async getById(id) {
      return copy(clients.find((c) => c.id === id) ?? null);
    },
    async listByOffice(id) {
      return copy(clients.filter((c) => c.officeId === id));
    },
    async save(client) {
      if (Object.keys(validateClient(client)).length)
        throw new Error("تحقق من بيانات العميل");
      if (client.officeId !== OFFICE_ID) throw new Error("المكتب غير صحيح");
      const idx = clients.findIndex((c) => c.id === client.id);
      if (idx < 0) clients.push(copy(client));
      else clients[idx] = copy(client);
      for (const m of matters)
        for (const p of m.parties)
          if (p.clientId === client.id) p.displayName = client.displayName;
      const profile = profiles.get(client.id) ?? {
        agreedFees: 0,
        paidFees: 0,
        trustBalance: 0,
        expenses: 0,
        receipts: [],
        documents: [],
        activity: [],
      };
      profile.activity.unshift({
        title: idx < 0 ? "إضافة العميل" : "تعديل بيانات العميل",
        date: new Date().toISOString().slice(0, 10),
      });
      profiles.set(client.id, profile);
    },
  };
  const matterRepository: MatterRepository = {
    async setStatus(id,status) { requireMatter(id).status=status; },
    async getById(id) {
      return copy(matters.find((m) => m.id === id) ?? null);
    },
    async listByOffice(id) {
      return copy(matters.filter((m) => m.officeId === id));
    },
    async listByClient(id) {
      return copy(
        matters.filter((m) => m.parties.some((p) => p.clientId === id)),
      );
    },
    async listActive(id) {
      return copy(
        matters.filter((m) => m.officeId === id && m.status === "ACTIVE"),
      );
    },
    async save(matter) {
      if (Object.keys(validateMatter(matter)).length)
        throw new Error("تحقق من بيانات الملف والعميل الأساسي");
      if (
        matter.officeId !== OFFICE_ID ||
        matter.parties.some(
          (p) =>
            p.clientId &&
            !clients.some(
              (c) => c.id === p.clientId && c.officeId === matter.officeId,
            ),
        )
      )
        throw new Error("أحد العملاء غير موجود في المكتب");
      if (
        matters.some(
          (m) =>
            m.id !== matter.id &&
            m.officeId === matter.officeId &&
            m.reference.trim().toLocaleLowerCase() ===
              matter.reference.trim().toLocaleLowerCase(),
        )
      )
        throw new Error("رقم الملف مستخدم بالفعل");
      const saved = copy(matter);
      saved.parties.forEach((p) => {
        if (p.clientId)
          p.displayName = clients.find((c) => c.id === p.clientId)!.displayName;
      });
      const idx = matters.findIndex((m) => m.id === saved.id);
      if (idx < 0) matters.push(saved);
      else matters[idx] = saved;
      for (const id of new Set(
        saved.parties.flatMap((p) => (p.clientId ? [p.clientId] : [])),
      )) {
        const profile = copy(profiles.get(id) ?? { agreedFees: 0, paidFees: 0, trustBalance: 0, expenses: 0, receipts: [], documents: [], activity: [] });
        profile.activity.unshift({
          title: `إنشاء / تحديث الملف ${saved.reference}`,
          date: new Date().toISOString().slice(0, 10),
        });
        profiles.set(id, profile);
      }
    },
  };
  const profileRepository: ProfileRepository = {
    async getByClient(id) {
      const result = copy(
        profiles.get(id) ?? {
          agreedFees: 0,
          paidFees: 0,
          trustBalance: 0,
          expenses: 0,
          receipts: [],
          documents: [],
          activity: [],
        },
      );
      for (const m of matters.filter((m) => m.parties.some((p) => p.isPrimary && p.clientId === id))) {
        const w = workflows.has(m.id) ? getWorkflow(m.id) : undefined;
        if (!w) continue;
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
  const officeRepository = createOfficeOperations({ get: () => copy(office), set: (value) => { office = copy(value); }, id: newId, matter: requireMatter, read: getWorkflow, write: writable, commit: commitWorkflow });
  return { clientRepository, matterRepository, profileRepository, workflowRepository, officeRepository,
    snapshot: (): RepositorySnapshot => copy({ version: 1, clients, matters, profiles: [...profiles], workflows: [...workflows], office }),
    restore: (snapshot: RepositorySnapshot) => {
      if (snapshot.version !== 1 || !Array.isArray(snapshot.clients) || !Array.isArray(snapshot.matters) || !Array.isArray(snapshot.profiles) || !Array.isArray(snapshot.workflows)) throw new Error('تعذر قراءة البيانات المحلية');
      clients.splice(0, clients.length, ...copy(snapshot.clients));
      matters.splice(0, matters.length, ...copy(snapshot.matters));
      profiles.clear(); snapshot.profiles.forEach(([id, value]) => profiles.set(id, copy(value)));
      workflows.clear(); snapshot.workflows.forEach(([id, value]) => workflows.set(id, copy(value)));
      office = copy(snapshot.office ?? defaultOffice());
    },
  };
}
// Session-local mock persistence. Reloading the application restores the fictional fixtures.
export const { clientRepository, matterRepository, profileRepository } =
  createMockRepositories();
