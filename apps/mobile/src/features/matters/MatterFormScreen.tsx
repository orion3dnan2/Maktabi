import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  matterStatuses,
  matterTypes,
  typeFields,
  validateMatter,
  type FieldErrors,
  type Matter,
  type MatterParty,
  type MatterStatus,
  type MatterType,
} from "@maktabi/domain";
import {
  BodyText,
  Button,
  Card,
  ChoiceField,
  choices,
  ErrorState,
  featureStyles as s,
  FormPage,
  Input,
  LoadingState,
} from "@maktabi/ui";
import { useAuth } from "@/auth/AuthProvider";
import { canReassignMatters, canUseMatters } from "@/auth/access";
import {
  clientRepository,
  matterRepository,
  newId,
  OFFICE_ID,
} from "@/data/repositories";
import { userMessage } from "@/data/supabase/errors";
import { serverNotice, useResource, useUnsavedChanges } from "../shared/hooks";
const stepNames = [
  "المعلومات الأساسية",
  "العملاء والأطراف",
  "نوع الملف",
  "بيانات الجهة",
  "التواريخ والملاحظات",
  "المراجعة والإنشاء",
];
const roles = {
  CLIENT: "عميل إضافي",
  OPPONENT: "طرف مقابل",
  WITNESS: "شاهد",
  OTHER: "طرف آخر",
};
const openStatuses = { ACTIVE: matterStatuses.ACTIVE, ON_HOLD: matterStatuses.ON_HOLD };
export default function MatterFormScreen() {
  const router = useRouter();
  const { clientId, id } = useLocalSearchParams<{ clientId?: string; id?: string }>();
  const { access } = useAuth();
  const allowed = canUseMatters(access);
  const editing = !!id;
  const fetchForm = useCallback(async () => {
    if (!allowed) return null;
    const [clients, existing, lawyers] = await Promise.all([
      clientRepository.listByOffice(OFFICE_ID),
      id ? matterRepository.getById(id) : Promise.resolve(null),
      matterRepository.listAssignableLawyers(),
    ]);
    if (id && !existing) throw new Error("القضية غير موجودة أو لا تملك صلاحية الوصول إليها");
    return { clients, existing, lawyers };
  }, [id, allowed]);
  const resource = useResource(fetchForm);
  const [matter, setMatter] = useState<Matter>(() => ({
    id: newId(),
    officeId: OFFICE_ID,
    reference: "",
    title: "",
    type: "CIVIL",
    authority: "",
    status: "ACTIVE",
    openedAt: new Date().toISOString().slice(0, 10),
    parties: [],
    details: {},
    notes: "",
  }));
  const [step, setStep] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [partyName, setPartyName] = useState("");
  const [partyRole, setPartyRole] = useState<MatterParty["role"]>("OPPONENT");
  const [additionalClient, setAdditionalClient] = useState("");
  const [initialized, setInitialized] = useState(false);
  const { cancel, confirmation } = useUnsavedChanges(
    !saved && (dirty || !!partyName.trim()),
  );
  // Initialise once, while rendering, when the form data first loads: the saved matter, or a preselected client.
  if (resource.data && !initialized) {
    const c = resource.data.clients.find((c) => c.id === clientId);
    if (resource.data.existing) setMatter(resource.data.existing);
    else
      setMatter((m) => ({
        ...m,
        // Decided here, once the signed-in role is known: a lawyer's new matter is always
        // assigned to themselves (the database enforces this) and an admin starts with themselves.
        assignedLawyerId: access?.role === "lawyer" || access?.role === "admin" ? access.user_id : undefined,
        parties: c
          ? [
              {
                id: newId(),
                matterId: m.id,
                clientId: c.id,
                displayName: c.displayName,
                role: "CLIENT",
                isPrimary: true,
              },
            ]
          : m.parties,
      }));
    setInitialized(true);
  }
  useEffect(() => {
    if (saved && editing) router.replace({ pathname: '/matters/[id]', params: { id: matter.id } });
    else if (saved) router.replace({ pathname: '/matters/[id]/workflow', params: { id: matter.id } });
  }, [saved, editing, router, matter.id]);
  const update = (patch: Partial<Matter>) => {
    setMatter((m) => ({ ...m, ...patch }));
    setDirty(true);
    setSaveError("");
  };
  const primary = matter.parties.find((p) => p.isPrimary)?.clientId ?? "";
  const setPrimary = (id: string) => {
    const client = resource.data?.clients.find((c) => c.id === id);
    if (client)
      update({
        parties: [
          ...matter.parties.filter((p) => !p.isPrimary && p.clientId !== id),
          {
            id: newId(),
            matterId: matter.id,
            clientId: id,
            displayName: client.displayName,
            role: "CLIENT",
            isPrimary: true,
          },
        ],
      });
  };
  const validateStep = () => {
    const all = validateMatter(matter);
    const keys =
      step === 0
        ? ["reference", "title", "status"]
        : step === 1
          ? ["parties"]
          : step === 2
            ? ["type", "employmentStart", "employmentEnd"]
            : step === 3
              ? ["authority"]
              : step === 4
                ? ["openedAt"]
                : Object.keys(all);
    const visible = Object.fromEntries(
      Object.entries(all).filter(([k]) => keys.includes(k)),
    );
    if (step === 1 && partyName.trim())
      visible.parties = "أضف الطرف المكتوب أو امسح اسمه قبل المتابعة";
    setErrors(visible);
    return Object.keys(visible).length === 0;
  };
  const create = async () => {
    if (saving || !validateStep()) return;
    setSaving(true);
    setSaveError("");
    try {
      await matterRepository.save({
        ...matter,
        reference: matter.reference.trim(),
        title: matter.title.trim(),
        authority: matter.authority?.trim(),
      });
      setSaved(true);
    } catch (e) {
      setSaveError(userMessage(e, editing ? "تعذر حفظ التعديلات" : "تعذر إنشاء الملف"));
    } finally {
      setSaving(false);
    }
  };
  const pageTitle = editing ? "تعديل القضية" : "ملف جديد";
  if (!allowed)
    return (
      <FormPage title={pageTitle}>
        <BodyText>لا تملك صلاحية إنشاء القضايا أو تعديلها. تواصل مع مدير المكتب.</BodyText>
        <Button label="رجوع" onPress={cancel} />
      </FormPage>
    );
  if (resource.error)
    return (
      <FormPage title={pageTitle}>
        {confirmation}
        <ErrorState message={resource.error} onRetry={resource.reload} />
        <Button label="إلغاء" onPress={cancel} />
      </FormPage>
    );
  if (!resource.data || !initialized) return <LoadingState />;
  const { clients, lawyers, existing } = resource.data;
  // Only an admin may reassign a saved matter; a lawyer's new matter stays assigned to themselves.
  const canPickLawyer = editing ? canReassignMatters(access) : access?.role !== "lawyer";
  const lawyerName = lawyers.find((l) => l.id === matter.assignedLawyerId)?.fullName ?? matter.assignedLawyerName;
  const statusOptions = !editing ? matterStatuses : existing && (existing.status === "ACTIVE" || existing.status === "ON_HOLD") ? openStatuses : undefined;
  if (!clients.length)
    return (
      <FormPage title={pageTitle}>
        <BodyText>أضف عميلاً قبل إنشاء الملف.</BodyText>
        <Button
          label="عميل جديد"
          onPress={() => router.replace("/clients/new")}
        />
        <Button label="إلغاء" onPress={cancel} />
      </FormPage>
    );
  return (
    <FormPage title={pageTitle}>
      {confirmation}
      <BodyText muted>{serverNotice}</BodyText>
      <Text accessibilityRole="header" style={s.title}>
        {step + 1} / 6 · {stepNames[step]}
      </Text>
      {step === 0 ? (
        <>
          <Input
            label="رقم الملف / المرجع الداخلي *"
            value={matter.reference}
            onChangeText={(v) => update({ reference: v })}
            error={errors.reference}
          />
          <Input
            label="عنوان / وصف الملف *"
            multiline
            value={matter.title}
            onChangeText={(v) => update({ title: v })}
            error={errors.title}
          />
          {statusOptions ? (
            <ChoiceField
              label="الحالة"
              value={matter.status}
              options={choices(statusOptions)}
              onChange={(v) => update({ status: v as MatterStatus })}
            />
          ) : (
            <BodyText>الحالة: {matterStatuses[matter.status]}</BodyText>
          )}
          {editing && statusOptions ? (
            <BodyText muted>إغلاق القضية يتم من مسار القضية بعد إنهاء مواعيدها ومراحلها.</BodyText>
          ) : null}
          {canPickLawyer ? (
            <ChoiceField
              label="المحامي المسؤول"
              value={matter.assignedLawyerId ?? ""}
              searchable
              options={[
                { value: "", label: "غير مُسند" },
                ...lawyers.map((l) => ({ value: l.id, label: l.fullName })),
              ]}
              onChange={(v) =>
                update({
                  assignedLawyerId: v || undefined,
                  assignedLawyerName: lawyers.find((l) => l.id === v)?.fullName,
                })
              }
            />
          ) : (
            <BodyText>المحامي المسؤول: {lawyerName ?? "غير مُسند"}</BodyText>
          )}
        </>
      ) : null}
      {step === 1 ? (
        <>
          <ChoiceField
            label="العميل الأساسي *"
            value={primary}
            searchable
            options={clients.map((c) => ({
              value: c.id,
              label: c.displayName,
            }))}
            onChange={setPrimary}
            error={errors.parties}
          />
          <Card>
            <BodyText>عملاء إضافيون (اختياري)</BodyText>
            <ChoiceField
              label="اختر عميلاً مسجلاً"
              value={additionalClient}
              searchable
              options={clients
                .filter((c) => !matter.parties.some((p) => p.clientId === c.id))
                .map((c) => ({ value: c.id, label: c.displayName }))}
              onChange={setAdditionalClient}
            />
            <Button
              label="إضافة العميل"
              disabled={
                !additionalClient ||
                matter.parties.some((p) => p.clientId === additionalClient)
              }
              onPress={() => {
                const c = clients.find((c) => c.id === additionalClient);
                if (c)
                  update({
                    parties: [
                      ...matter.parties,
                      {
                        id: newId(),
                        matterId: matter.id,
                        clientId: c.id,
                        displayName: c.displayName,
                        role: "CLIENT",
                        isPrimary: false,
                      },
                    ],
                  });
                setAdditionalClient("");
              }}
            />
          </Card>
          <Card>
            <Input
              label="اسم طرف آخر (اختياري)"
              value={partyName}
              onChangeText={setPartyName}
            />
            <ChoiceField
              label="صفة الطرف"
              value={partyRole}
              options={choices({
                OPPONENT: roles.OPPONENT,
                WITNESS: roles.WITNESS,
                OTHER: roles.OTHER,
              })}
              onChange={(v) => setPartyRole(v as MatterParty["role"])}
            />
            <Button
              label="إضافة الطرف"
              disabled={!partyName.trim()}
              onPress={() => {
                update({
                  parties: [
                    ...matter.parties,
                    {
                      id: newId(),
                      matterId: matter.id,
                      displayName: partyName.trim(),
                      role: partyRole,
                      isPrimary: false,
                    },
                  ],
                });
                setPartyName("");
              }}
            />
          </Card>
          {matter.parties
            .filter((p) => !p.isPrimary)
            .map((p) => (
              <Card key={p.id}>
                <BodyText>
                  {p.displayName} · {roles[p.role]}
                </BodyText>
                <Button
                  label="إزالة الطرف"
                  variant="secondary"
                  onPress={() =>
                    update({
                      parties: matter.parties.filter(
                        (other) => other.id !== p.id,
                      ),
                    })
                  }
                />
              </Card>
            ))}
        </>
      ) : null}
      {step === 2 ? (
        <>
          <ChoiceField
            label="نوع الملف *"
            value={matter.type}
            options={choices(matterTypes)}
            onChange={(v) => {
              update({ type: v as MatterType, details: {} });
              setErrors({});
            }}
          />
          <BodyText muted>
            الحقول التالية اختيارية. تغيير النوع يمسح بيانات النوع السابق.
            المراجع القانونية نصوص يدوّنها المستخدم ولا تُعد إرشاداً قانونياً.
          </BodyText>
          {Object.entries(typeFields[matter.type]).map(([key, label]) => (
            <Input
              key={key}
              label={label}
              value={matter.details[key] ?? ""}
              error={errors[key]}
              onChangeText={(v) =>
                update({ details: { ...matter.details, [key]: v } })
              }
            />
          ))}
        </>
      ) : null}
      {step === 3 ? (
        <Input
          label="المحكمة / الجهة / المؤسسة *"
          value={matter.authority}
          error={errors.authority}
          onChangeText={(v) => update({ authority: v })}
        />
      ) : null}
      {step === 4 ? (
        <>
          <Input
            label="تاريخ الفتح * (YYYY-MM-DD)"
            placeholder="2026-09-24"
            value={matter.openedAt}
            error={errors.openedAt}
            onChangeText={(v) => update({ openedAt: v })}
          />
          <Input
            label="ملاحظات (اختياري)"
            multiline
            value={matter.notes}
            onChangeText={(v) => update({ notes: v })}
          />
        </>
      ) : null}
      {step === 5 ? (
        <>
          <Card>
            <BodyText>
              {matter.reference} · {matter.title}
            </BodyText>
            <BodyText>
              {matterTypes[matter.type]} · {matterStatuses[matter.status]}
            </BodyText>
            <BodyText>الجهة: {matter.authority}</BodyText>
            <BodyText>تاريخ الفتح: {matter.openedAt}</BodyText>
            <BodyText>المحامي المسؤول: {lawyerName ?? "غير مُسند"}</BodyText>
            <BodyText>الملاحظات: {matter.notes || "لا توجد"}</BodyText>
          </Card>
          <Card>
            <BodyText>الأطراف</BodyText>
            {matter.parties.map((p) => (
              <BodyText key={p.id}>
                {p.displayName} ·{" "}
                {p.isPrimary ? "العميل الأساسي" : roles[p.role]}
              </BodyText>
            ))}
          </Card>
          {Object.keys(matter.details).length ? (
            <Card>
              {Object.entries(matter.details).map(([k, v]) => (
                <BodyText key={k}>
                  {typeFields[matter.type][k]}: {v || "غير مسجل"}
                </BodyText>
              ))}
            </Card>
          ) : null}
          {Object.entries(errors).map(([key, value]) => (
            <Text key={key} style={s.error}>
              {value}
            </Text>
          ))}
          {!editing ? (
            <BodyText muted>
              بعد الإنشاء ستنتقل إلى المواعيد والمستندات والأتعاب ومتابعة القضية.
            </BodyText>
          ) : null}
        </>
      ) : null}
      {saveError ? (
        <Text accessibilityRole="alert" style={s.error}>
          {saveError}
        </Text>
      ) : null}
      <View style={s.gap}>
        {step === 5 ? (
          <Button
            label={saving ? "جارٍ الحفظ…" : editing ? "حفظ التعديلات" : "إنشاء الملف"}
            disabled={saving}
            onPress={() => void create()}
          />
        ) : (
          <Button
            label="التالي"
            onPress={() => {
              if (validateStep()) setStep(step + 1);
            }}
          />
        )}
        {step > 0 ? (
          <Button
            label="السابق"
            variant="secondary"
            disabled={saving}
            onPress={() => {
              setErrors({});
              setStep(step - 1);
            }}
          />
        ) : null}
        <Button
          label="إلغاء"
          variant="secondary"
          disabled={saving}
          onPress={cancel}
        />
      </View>
    </FormPage>
  );
}

