import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text } from "react-native";
import {
  clientKinds,
  validateClient,
  type Client,
  type FieldErrors,
} from "@maktabi/domain";
import {
  BodyText,
  Button,
  ChoiceField,
  choices,
  ErrorState,
  featureStyles as s,
  FormPage,
  Input,
  LoadingState,
} from "@maktabi/ui";
import { clientRepository, newId, OFFICE_ID } from "@/data/mockRepositories";
import { demoNotice, useResource, useUnsavedChanges } from "../shared/hooks";
export default function ClientFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const fetchClient = useCallback(async () => {
    if (id) {
      const existing = await clientRepository.getById(id);
      if (!existing) throw new Error("غير موجود");
      return existing;
    }
    return {
      id: newId(),
      officeId: OFFICE_ID,
      displayName: "",
      kind: "PERSON",
      phone: "",
      whatsapp: "",
      createdAt: new Date().toISOString(),
    } as Client;
  }, [id]);
  const resource = useResource(fetchClient);
  const [client, setClient] = useState<Client>();
  const [original, setOriginal] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  useEffect(() => {
    if (resource.data && !client) {
      setClient(resource.data);
      setOriginal(JSON.stringify(resource.data));
    }
  }, [resource.data, client]);
  const { cancel, confirmation } = useUnsavedChanges(
    !saved && !!client && JSON.stringify(client) !== original,
  );
  useEffect(() => {
    if (saved && client)
      router.replace({ pathname: "/clients/[id]", params: { id: client.id } });
  }, [saved, client, router]);
  if (resource.error)
    return (
      <FormPage title="بيانات العميل">
        {confirmation}
        <ErrorState message={resource.error} onRetry={resource.reload} />
        <Button label="رجوع" onPress={cancel} />
      </FormPage>
    );
  if (!client) return <LoadingState />;
  const update = (key: keyof Client, value: string) =>
    setClient({ ...client, [key]: value });
  const fields: [keyof Client, string][] = [
    [
      "displayName",
      client.kind === "PERSON" ? "الاسم الكامل *" : "اسم الشركة / المؤسسة *",
    ],
    ...(client.kind === "ORGANIZATION"
      ? ([["contactPerson", "الشخص المسؤول *"]] as [keyof Client, string][])
      : []),
    ["phone", "رقم الهاتف *"],
    ["whatsapp", "رقم واتساب *"],
    [
      "email",
      client.kind === "ORGANIZATION"
        ? "البريد الإلكتروني *"
        : "البريد الإلكتروني (اختياري)",
    ],
    [
      client.kind === "PERSON" ? "nationalId" : "registration",
      client.kind === "PERSON"
        ? "الرقم الوطني (اختياري)"
        : "رقم التسجيل / المرجع (اختياري)",
    ],
    [
      "address",
      client.kind === "ORGANIZATION" ? "العنوان *" : "العنوان (اختياري)",
    ],
    ["notes", "ملاحظات (اختياري)"],
  ];
  const save = async () => {
    if (saving) return;
    const clean = Object.fromEntries(
      Object.entries(client).map(([k, v]) => [
        k,
        typeof v === "string" ? v.trim() : v,
      ]),
    ) as unknown as Client;
    const e = validateClient(clean);
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    setSaveError("");
    try {
      await clientRepository.save(clean);
      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  };
  return (
    <FormPage title={id ? "تعديل العميل" : "عميل جديد"}>
      {confirmation}
      <BodyText muted>{demoNotice}</BodyText>
      <ChoiceField
        label="نوع العميل"
        value={client.kind}
        options={choices(clientKinds)}
        onChange={(v) => update("kind", v)}
      />
      {fields.map(([key, label]) => (
        <Input
          key={key}
          label={label}
          accessibilityLabel={label}
          editable={!saving}
          value={String(client[key] ?? "")}
          onChangeText={(v) => update(key, v)}
          error={errors[key]}
          keyboardType={
            key === "phone" || key === "whatsapp"
              ? "phone-pad"
              : key === "email"
                ? "email-address"
                : "default"
          }
          autoCapitalize={key === "email" ? "none" : "sentences"}
          multiline={key === "notes" || key === "address"}
        />
      ))}
      {saveError ? (
        <Text accessibilityRole="alert" style={s.error}>
          {saveError}
        </Text>
      ) : null}
      <Button
        label={saving ? "جارٍ الحفظ…" : "حفظ العميل"}
        disabled={saving}
        onPress={() => void save()}
      />
      <Button
        label="إلغاء"
        variant="secondary"
        disabled={saving}
        onPress={cancel}
      />
    </FormPage>
  );
}
