import { useMemo, useState } from "react";
import { FlatList, Pressable, SafeAreaView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { clientKinds, filterClients } from "@maktabi/domain";
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
  LoadingState,
  SearchInput,
} from "@maktabi/ui";
import {
  clientRepository,
  matterRepository,
  OFFICE_ID,
  profileRepository,
} from "@/data/mockRepositories";
import { demoNotice, money, useResource } from "../shared/hooks";
const fetchClients = async () => {
  const [clients, matters] = await Promise.all([
    clientRepository.listByOffice(OFFICE_ID),
    matterRepository.listByOffice(OFFICE_ID),
  ]);
  const profiles = new Map(
    await Promise.all(
      clients.map(
        async (c) => [c.id, await profileRepository.getByClient(c.id)] as const,
      ),
    ),
  );
  const counts = new Map<string, number>();
  for (const m of matters)
    if (m.status === "ACTIVE")
      for (const id of new Set(m.parties.map((p) => p.clientId)))
        if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  return { clients, profiles, counts };
};
export default function ClientListScreen() {
  const router = useRouter();
  const { data, error, loading, reload } = useResource(fetchClients);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const filtered = useMemo(
    () => filterClients(data?.clients ?? [], query, kind),
    [data, query, kind],
  );
  return (
    <SafeAreaView style={s.page}>
      <FlatList
        data={filtered}
        keyExtractor={(c) => c.id}
        contentContainerStyle={s.content}
        refreshing={loading && !!data}
        onRefresh={reload}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={s.gap}>
            <Text style={s.title}>العملاء</Text>
            <Button
              label="عميل جديد"
              onPress={() => router.push("/clients/new")}
            />
            <SearchInput
              placeholder="اسم العميل أو رقم الهاتف"
              value={query}
              onChangeText={setQuery}
            />
            <ChoiceField
              label="نوع العميل"
              value={kind}
              onChange={setKind}
              options={[
                { value: "", label: "كل العملاء" },
                ...choices(clientKinds),
              ]}
            />
            <BodyText muted>{demoNotice}</BodyText>
            {error ? <ErrorState message={error} onRetry={reload} /> : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <LoadingState />
          ) : (
            <EmptyState
              title="لا يوجد عملاء"
              message="أضف عميلاً جديداً أو غيّر البحث والتصفية."
            />
          )
        }
        renderItem={({ item }) => {
          const profile = data?.profiles.get(item.id);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`فتح ملف العميل ${item.displayName}`}
              onPress={() =>
                router.push({
                  pathname: "/clients/[id]",
                  params: { id: item.id },
                })
              }
            >
              <Card>
                <Text style={s.title}>{item.displayName}</Text>
                <Badge label={clientKinds[item.kind]} />
                <BodyText>
                  الهاتف: {item.phone} · واتساب: {item.whatsapp || "غير مسجل"}
                </BodyText>
                <BodyText>
                  الملفات النشطة: {data?.counts.get(item.id) ?? 0}
                </BodyText>
                {profile && profile.agreedFees > 0 ? (
                  <BodyText muted>
                    الأتعاب المتبقية:{" "}
                    {money(profile.agreedFees - profile.paidFees)}
                  </BodyText>
                ) : null}
                <BodyText muted>
                  {profile?.activity[0]
                    ? `${profile.activity[0].title} · ${profile.activity[0].date}`
                    : "لا يوجد نشاط بعد"}
                </BodyText>
              </Card>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}
