import { useCallback, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { clientKinds, clientStatuses, matterStatuses, matterTypes } from "@maktabi/domain";
import {
  Badge,
  BodyText,
  Button,
  Card,
  ChoiceField,
  choices,
  EmptyState,
  ErrorState,
  featureStyles as s,
  FormPage,
  LoadingState,
  SectionHeader,
} from "@maktabi/ui";
import { useAuth } from "@/auth/AuthProvider";
import { canEditClientDetails, canUseMatters } from "@/auth/access";
import {
  clientRepository,
  matterRepository,
  profileRepository,
} from "@/data/repositories";
import { deviceNotice, money, serverNotice, useResource } from "../shared/hooks";
import { useOperation } from "../shared/useOperation";
const sections = {
  overview: "نظرة عامة",
  matters: "الملفات",
  accounts: "الحسابات",
  documents: "المستندات",
  receipts: "الإيصالات",
  activity: "النشاط",
};
export default function ClientProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [section, setSection] = useState("overview");
  const { access } = useAuth();
  const mattersAllowed = canUseMatters(access);
  const canEdit = canEditClientDetails(access);
  const fetchProfile = useCallback(async () => {
    const [client, matters] = await Promise.all([
      clientRepository.getById(id),
      mattersAllowed ? matterRepository.listByClient(id) : Promise.resolve([]),
    ]);
    if (!client) throw new Error("العميل غير موجود أو لا تملك صلاحية الوصول إليه");
    const profile = await profileRepository.getByClient(id, matters);
    // The client record's own creation date comes from the server.
    profile.activity.push({ title: "إضافة العميل", date: client.createdAt.slice(0, 10) });
    return { client, matters, profile };
  }, [id, mattersAllowed]);
  const { data, error, loading, reload } = useResource(fetchProfile);
  const op = useOperation(reload);
  const [archiving, setArchiving] = useState(false);
  if (error)
    return (
      <FormPage title="ملف العميل">
        <ErrorState message={error} onRetry={reload} />
        <Button
          label="العملاء"
          onPress={() => router.replace("/(tabs)/clients")}
        />
      </FormPage>
    );
  if (!data) return <LoadingState />;
  const { client, matters, profile } = data;
  const finances = (
    <Card>
      <SectionHeader title="أتعاب المحامي" />
      <BodyText>المتفق عليها: {money(profile.agreedFees)}</BodyText>
      <BodyText>المدفوعة: {money(profile.paidFees)}</BodyText>
      <BodyText>
        المتبقية: {money(profile.agreedFees - profile.paidFees)}
      </BodyText>
      <SectionHeader title="أمانات العميل" />
      <BodyText>رصيد الأمانات: {money(profile.trustBalance)}</BodyText>
      <SectionHeader title="المصروفات" />
      <BodyText>إجمالي المصروفات: {money(profile.expenses)}</BodyText>
      <BodyText muted>
        الأمانات منفصلة عن الأتعاب والمصروفات. المبالغ بالجنيه السوداني.
      </BodyText>
      <BodyText muted>
        {deviceNotice}
      </BodyText>
    </Card>
  );
  const receipts = (
    <Card>
      <SectionHeader title="الإيصالات الأخيرة" />
      {profile.receipts.length ? (
        profile.receipts.map((r) => (
          <View key={r.number} style={s.item}>
            <BodyText>
              {r.number} · {money(r.amount)}
            </BodyText>
            <BodyText muted>{r.date} · دفعة أتعاب</BodyText>
          </View>
        ))
      ) : (
        <BodyText muted>لا توجد إيصالات بعد</BodyText>
      )}
    </Card>
  );
  const documents = (
    <Card>
      <SectionHeader title="المستندات الأخيرة" />
      {profile.documents.length ? (
        profile.documents.map((d) => (
          <View key={d.title} style={s.item}>
            <BodyText>{d.title}</BodyText>
            <BodyText muted>{d.date}</BodyText>
          </View>
        ))
      ) : (
        <BodyText muted>لا توجد مستندات بعد</BodyText>
      )}
    </Card>
  );
  return (
    <FormPage title="ملف العميل">
      <Button
        label="العودة إلى العملاء"
        variant="secondary"
        onPress={() => router.replace("/(tabs)/clients")}
      />
      <Card>
        <Text style={s.title}>{client.displayName}</Text>
        <Badge label={clientKinds[client.kind]} />
        {client.status && client.status !== "ACTIVE" ? (
          <Badge label={clientStatuses[client.status]} tone="danger" />
        ) : null}
        {client.contactPerson ? (
          <BodyText>المسؤول: {client.contactPerson}</BodyText>
        ) : null}
        <BodyText>الهاتف: {client.phone}</BodyText>
        <BodyText>واتساب: {client.whatsapp || "غير مسجل"}</BodyText>
        <View style={s.row}>
          <Button
            label={canEdit ? "تعديل العميل" : "تعديل بيانات التواصل"}
            onPress={() =>
              router.push({ pathname: "/clients/[id]/edit", params: { id } })
            }
          />
          {mattersAllowed && client.status !== "ARCHIVED" ? (
            <Button
              label="ملف جديد"
              onPress={() =>
                router.push({
                  pathname: "/matters/new",
                  params: { clientId: id },
                })
              }
            />
          ) : null}
          <Button
            label="واتساب"
            variant="secondary"
            onPress={() =>
              Alert.alert(
                "معاينة واتساب",
                `الرقم: ${client.whatsapp || client.phone}\nإرسال الرسائل عبر واتساب غير مفعّل بعد في التطبيق.`,
              )
            }
          />
          <Button
            label="اتصال"
            variant="secondary"
            onPress={() =>
              Alert.alert(
                "معاينة الاتصال",
                `الرقم: ${client.phone}\nالاتصال المباشر غير مفعّل بعد في التطبيق.`,
              )
            }
          />
        </View>
      </Card>
      {canEdit ? (
        client.status === "ARCHIVED" ? (
          <Button
            label="استعادة العميل"
            variant="secondary"
            disabled={op.busy}
            onPress={() => void op.run(() => clientRepository.setStatus(id, "ACTIVE"), "تمت استعادة العميل")}
          />
        ) : archiving ? (
          <Card>
            <BodyText>الأرشفة تخفي العميل من القائمة وتحتفظ بكل بياناته وقضاياه، ويمكن استعادته لاحقاً.</BodyText>
            <Button
              label="تأكيد أرشفة العميل"
              disabled={op.busy}
              onPress={() => void op.run(async () => { await clientRepository.setStatus(id, "ARCHIVED"); setArchiving(false); }, "تمت أرشفة العميل")}
            />
            <Button label="إلغاء" variant="secondary" onPress={() => setArchiving(false)} />
          </Card>
        ) : (
          <Button label="أرشفة العميل" variant="secondary" onPress={() => setArchiving(true)} />
        )
      ) : null}
      {op.error || op.message ? (
        <Text accessibilityLiveRegion="polite" style={op.error ? s.error : s.text}>
          {op.error || op.message}
        </Text>
      ) : null}
      <BodyText muted>{serverNotice}</BodyText>
      <ChoiceField
        label="أقسام العميل"
        value={section}
        onChange={setSection}
        options={choices(sections)}
      />
      {section === "overview" ? (
        <>
          <Card>
            <BodyText>إجمالي الملفات: {matters.length}</BodyText>
            <BodyText>
              الملفات النشطة:{" "}
              {matters.filter((m) => m.status === "ACTIVE").length}
            </BodyText>
            <BodyText>
              آخر نشاط:{" "}
              {profile.activity[0]
                ? `${profile.activity[0].title} · ${profile.activity[0].date}`
                : "لا يوجد نشاط بعد"}
            </BodyText>
            {client.email ? <BodyText>البريد: {client.email}</BodyText> : null}
            {client.address ? (
              <BodyText>العنوان: {client.address}</BodyText>
            ) : null}
            {client.notes ? <BodyText>ملاحظات: {client.notes}</BodyText> : null}
          </Card>
          {finances}
          {receipts}
          {documents}
        </>
      ) : null}
      {section === "accounts" ? finances : null}
      {section === "receipts" ? receipts : null}
      {section === "documents" ? documents : null}
      {section === "matters" ? (
        !mattersAllowed ? (
          <EmptyState
            title="لا تملك صلاحية الاطلاع على القضايا"
            message="يستطيع موظف الاستقبال إدارة بيانات العملاء فقط."
          />
        ) : matters.length ? (
          matters.map((m) => (
            <Card key={m.id}>
              <BodyText>
                {m.reference} · {m.title}
              </BodyText>
              <BodyText muted>
                {matterTypes[m.type]} · {matterStatuses[m.status]}
              </BodyText>
              <BodyText muted>{m.authority}</BodyText>
              <Button label={`متابعة الملف ${m.reference}`} onPress={() => router.push({ pathname: '/matters/[id]/workflow', params: { id: m.id } })}/>
              <Button label="تفاصيل القضية" variant="secondary" onPress={() => router.push({ pathname: '/matters/[id]', params: { id: m.id } })}/>
            </Card>
          ))
        ) : (
          <EmptyState
            title="لا توجد ملفات"
            message="يمكنك إنشاء أول ملف لهذا العميل."
          />
        )
      ) : null}
      {section === "activity" ? (
        <Card>
          <SectionHeader title="سجل النشاط" />
          {profile.activity.length ? (
            profile.activity.map((a, i) => (
              <View key={`${a.date}-${i}`} style={s.item}>
                <BodyText>{a.title}</BodyText>
                <BodyText muted>{a.date}</BodyText>
              </View>
            ))
          ) : (
            <BodyText muted>لا يوجد نشاط بعد</BodyText>
          )}
        </Card>
      ) : null}
      <Button
        label={loading ? "جارٍ التحديث…" : "تحديث"}
        disabled={loading}
        variant="secondary"
        onPress={reload}
      />
    </FormPage>
  );
}

