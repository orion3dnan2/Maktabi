import { useCallback, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { clientKinds, matterStatuses, matterTypes } from "@maktabi/domain";
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
import {
  clientRepository,
  matterRepository,
  profileRepository,
} from "@/data/repositories";
import { demoNotice, money, useResource } from "../shared/hooks";
import { isUnlocked } from '@/data/vault';
import { useAuth } from '@/auth/AuthProvider';
import { can } from '@/auth/permissions';
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
  const { access } = useAuth();
  const [section, setSection] = useState("overview");
  const fetchProfile = useCallback(async () => {
    const [client, matters, profile] = await Promise.all([
      clientRepository.getById(id),
      matterRepository.listByClient(id),
      isUnlocked() ? profileRepository.getByClient(id) : Promise.resolve(null),
    ]);
    if (!client) throw new Error("العميل غير موجود");
    return { client, matters, profile };
  }, [id]);
  const { data, error, loading, reload } = useResource(fetchProfile);
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
  if (!profile) return <FormPage title="ملف العميل"><Card><SectionHeader title={client.displayName}/><BodyText>الهاتف: {client.phone}</BodyText><BodyText>العملاء والقضايا مشتركة عبر المزامنة. المالية والمرفقات السابقة تحتاج فتح بيانات هذا الجهاز حتى تُنقل.</BodyText>
    <Button label="فتح العمليات المحلية" onPress={() => router.push('/office/legacy')}/>
    <Button label="تعديل العميل" variant="secondary" onPress={() => router.push({ pathname: '/clients/[id]/edit', params: { id } })}/>
    {can(access,'edit_cases') ? <Button label="قضية جديدة" onPress={() => router.push({ pathname: '/matters/new', params: { clientId: id } })}/> : null}
    {matters.map(m => <Button key={m.id} label={`${m.reference} · ${m.title}`} variant="secondary" onPress={() => router.push({ pathname: '/matters/[id]', params: { id: m.id } })}/>)}
    <Button label="العودة للعملاء" variant="secondary" onPress={() => router.replace('/(tabs)/clients')}/>
  </Card></FormPage>;
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
        الأمانات منفصلة عن الأتعاب والمصروفات. القيم المحلية بالجنيه السوداني.
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
        {client.contactPerson ? (
          <BodyText>المسؤول: {client.contactPerson}</BodyText>
        ) : null}
        <BodyText>الهاتف: {client.phone}</BodyText>
        <BodyText>واتساب: {client.whatsapp || "غير مسجل"}</BodyText>
        <View style={s.row}>
          <Button
            label="تعديل العميل"
            onPress={() =>
              router.push({ pathname: "/clients/[id]/edit", params: { id } })
            }
          />
          <Button
            label="ملف جديد"
            onPress={() =>
              router.push({
                pathname: "/matters/new",
                params: { clientId: id },
              })
            }
          />
          <Button
            label="واتساب"
            variant="secondary"
            onPress={() =>
              Alert.alert(
                "معاينة واتساب",
                `الرقم: ${client.whatsapp || client.phone}\nإرسال الرسائل من التطبيق لم يُفعّل بعد.`,
              )
            }
          />
          <Button
            label="اتصال"
            variant="secondary"
            onPress={() =>
              Alert.alert(
                "معاينة الاتصال",
                `رقم الهاتف: ${client.phone}\nفتح الاتصال من التطبيق لم يُفعّل بعد.`,
              )
            }
          />
        </View>
      </Card>
      <BodyText muted>{demoNotice}</BodyText>
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
        matters.length ? (
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

