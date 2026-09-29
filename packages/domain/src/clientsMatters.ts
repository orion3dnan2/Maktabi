import type { Client, ClientStatus, Matter, MatterStatus, MatterType } from "./index";
export const clientKinds = { PERSON: "فرد", ORGANIZATION: "شركة / مؤسسة" };
export const clientStatuses: Record<ClientStatus, string> = {
  ACTIVE: "نشط",
  INACTIVE: "غير نشط",
  ARCHIVED: "مؤرشف",
};
export const matterTypes: Record<MatterType, string> = {
  CRIMINAL: "جنائية",
  CIVIL: "مدنية",
  PERSONAL_STATUS: "شرعية / أحوال شخصية",
  LABOUR: "عمل",
  SPECIAL_COURT: "محكمة خاصة",
  COMMERCIAL_REGISTRY: "مسجل تجاري",
  LAND_REGISTRY: "مسجل عام الأراضي",
  NOTARIZATION: "توثيق",
  OTHER: "أخرى",
};
export const matterStatuses: Record<MatterStatus, string> = {
  ACTIVE: "نشط",
  ON_HOLD: "معلق",
  CLOSED: "مغلق",
  ARCHIVED: "مؤرشف",
};
export const typeFields: Record<MatterType, Record<string, string>> = {
  CRIMINAL: {
    charge: "التهمة / الاتهام",
    legalReference: "نص / مرجع المادة (إدخال المستخدم)",
    accused: "بيانات المتهم",
    complainant: "بيانات الشاكي",
  },
  LABOUR: {
    employer: "صاحب العمل",
    employmentStart: "بداية العمل YYYY-MM-DD",
    employmentEnd: "نهاية الخدمة YYYY-MM-DD",
    entitlements: "المستحقات المطالب بها",
  },
  PERSONAL_STATUS: { actionType: "نوع الدعوى", partyRoles: "صفات الأطراف" },
  SPECIAL_COURT: { courtName: "اسم المحكمة" },
  COMMERCIAL_REGISTRY: {
    entityName: "اسم المنشأة",
    applicationNumber: "رقم الطلب / المرجع",
  },
  LAND_REGISTRY: { plot: "رقم القطعة", block: "المربع", location: "الموقع" },
  CIVIL: {},
  NOTARIZATION: {},
  OTHER: {},
};
export function normalizeArabic(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670ـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[٠-٩]/g, (n) => String("٠١٢٣٤٥٦٧٨٩".indexOf(n)))
    .toLocaleLowerCase()
    .trim();
}
export function filterClients(clients: Client[], query: string, kind = "") {
  const q = normalizeArabic(query);
  return clients.filter(
    (c) =>
      (!kind || c.kind === kind) &&
      normalizeArabic(
        `${c.displayName} ${c.phone} ${c.whatsapp ?? ""} ${c.contactPerson ?? ""}`,
      ).includes(q),
  );
}
export type MatterFilters = {
  query: string;
  status: string;
  type: string;
  authority: string;
  sort: string;
};
export function filterMatters(matters: Matter[], filters: MatterFilters) {
  const q = normalizeArabic(filters.query);
  return matters
    .filter(
      (m) =>
        (!filters.status || m.status === filters.status) &&
        (!filters.type || m.type === filters.type) &&
        (!filters.authority || m.authority === filters.authority) &&
        normalizeArabic(
          `${m.reference} ${m.title} ${m.authority ?? ""} ${m.parties.map((p) => p.displayName).join(" ")}`,
        ).includes(q),
    )
    .sort((a, b) =>
      filters.sort === "reference"
        ? a.reference.localeCompare(b.reference, "ar", { numeric: true })
        : filters.sort === "next"
          ? (a.nextEventAt ?? "9999").localeCompare(b.nextEventAt ?? "9999")
          : b.openedAt.localeCompare(a.openedAt),
    );
}
export type FieldErrors = Record<string, string>;
export function validateClient(c: Client): FieldErrors {
  const e: FieldErrors = {};
  if (!c.displayName.trim()) e.displayName = "الاسم مطلوب";
  if (!Object.hasOwn(clientKinds, c.kind)) e.kind = "اختر نوع العميل";
  for (const key of ["phone", "whatsapp"] as const) {
    if (!c[key]?.trim()) e[key] = "الرقم مطلوب";
    else if (
      !/^\+?[\d\s()-]{7,25}$/.test(normalizeArabic(c[key]!)) ||
      !/^\d{7,15}$/.test(normalizeArabic(c[key]!).replace(/\D/g, ""))
    )
      e[key] = "أدخل رقماً صحيحاً";
  }
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email))
    e.email = "البريد الإلكتروني غير صحيح";
  // The Sudanese national number is digits only; mirrors the database rules
  // clients_national_id_digits and clients_identity_complete (3 to 50 characters).
  const nationalId = normalizeArabic(c.nationalId ?? "")
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\s+/g, "");
  if (nationalId && !/^[0-9]+$/.test(nationalId))
    e.nationalId = "الرقم الوطني أرقام فقط";
  else if (nationalId && (nationalId.length < 3 || nationalId.length > 50))
    e.nationalId = "الرقم الوطني من 3 إلى 50 رقماً";
  if (c.kind === "ORGANIZATION")
    for (const key of ["contactPerson", "email", "address"] as const)
      if (!c[key]?.trim()) e[key] = "هذا الحقل مطلوب للشركة";
  return e;
}
export function validDate(v: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !Number.isNaN(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v
  );
}
export function validateMatter(m: Matter): FieldErrors {
  const e: FieldErrors = {};
  for (const key of ["reference", "title", "authority"] as const)
    if (!m[key]?.trim()) e[key] = "هذا الحقل مطلوب";
  // Mirrors the database limit on matters.matter_number.
  if (m.reference.trim().length > 50) e.reference = "رقم الملف لا يتجاوز 50 حرفاً";
  if (!Object.hasOwn(matterTypes, m.type)) e.type = "اختر نوع الملف";
  if (!Object.hasOwn(matterStatuses, m.status)) e.status = "اختر حالة الملف";
  if (!validDate(m.openedAt))
    e.openedAt = "أدخل تاريخاً صحيحاً بصيغة YYYY-MM-DD";
  if (
    m.parties.filter((p) => p.isPrimary && p.role === "CLIENT" && p.clientId)
      .length !== 1 ||
    m.parties.filter((p) => p.isPrimary).length !== 1
  )
    e.parties = "اختر عميلاً أساسياً واحداً";
  if (m.parties.some((p) => !p.displayName.trim() || p.matterId !== m.id))
    e.parties = "تحقق من أسماء الأطراف وارتباطها بالملف";
  for (const key of ["employmentStart", "employmentEnd"])
    if (m.type === "LABOUR" && m.details[key] && !validDate(m.details[key]!))
      e[key] = "أدخل تاريخاً صحيحاً";
  if (
    m.type === "LABOUR" &&
    m.details.employmentStart &&
    m.details.employmentEnd &&
    m.details.employmentEnd < m.details.employmentStart
  )
    e.employmentEnd = "نهاية الخدمة يجب أن تلي بدايتها";
  return e;
}
