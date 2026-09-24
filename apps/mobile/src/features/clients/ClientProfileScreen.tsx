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
} from "@/data/mockRepositories";
import { demoNotice, money, useResource } from "../shared/hooks";
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
  const fetchProfile = useCallback(async () => {
    const [client, matters, profile] = await Promise.all([
      clientRepository.getById(id),
      matterRepository.listByClient(id),
      profileRepository.getByClient(id),
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
        الأمانات منفصلة عن الأتعاب والمصروفات. القيم التجريبية بالجنيه السوداني.
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
            <BodyText muted>{r.date} · دفعة أتعاب تجريبية</BodyText>
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
            <BodyText muted>{d.date} · سجل توضيحي، لا يوجد ملف مرفق</BodyText>
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
                `الرقم: ${client.whatsapp || client.phone}\nلا يتم إرسال رسائل أو فتح محادثات للأرقام التجريبية.`,
              )
            }
          />
          <Button
            label="اتصال"
            variant="secondary"
            onPress={() =>
              Alert.alert(
                "معاينة الاتصال",
                `رقم تجريبي: ${client.phone}\nالاتصال الفعلي غير مفعّل في هذا النموذج.`,
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
