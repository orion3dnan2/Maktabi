import {
  validateClient,
  validateMatter,
  type Client,
  type ClientRepository,
  type Matter,
  type MatterRepository,
  type MatterType,
} from "@maktabi/domain";
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
export function createMockRepositories() {
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
  const clientRepository: ClientRepository = {
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
        const profile = await profileRepository.getByClient(id);
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
      return copy(
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
    },
  };
  return { clientRepository, matterRepository, profileRepository };
}
// Session-local mock persistence. Reloading the application restores the fictional fixtures.
export const { clientRepository, matterRepository, profileRepository } =
  createMockRepositories();
