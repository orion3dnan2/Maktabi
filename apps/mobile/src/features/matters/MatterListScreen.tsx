import { useMemo, useState } from "react";
import { FlatList, Modal, SafeAreaView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  filterMatters,
  matterStatuses,
  matterTypes,
  type MatterFilters,
} from "@maktabi/domain";
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
  SearchInput,
} from "@maktabi/ui";
import { matterRepository, OFFICE_ID } from "@/data/mockRepositories";
import { demoNotice, useResource } from "../shared/hooks";
const fetchMatters = () => matterRepository.listByOffice(OFFICE_ID);
const initial: MatterFilters = {
  query: "",
  status: "",
  type: "",
  authority: "",
  sort: "recent",
};
export default function MatterListScreen() {
  const router = useRouter();
  const { data, error, loading, reload } = useResource(fetchMatters);
  const [filters, setFilters] = useState(initial);
  const [visible, setVisible] = useState(false);
  const rows = useMemo(
    () => filterMatters(data ?? [], filters),
    [data, filters],
  );
  const authorities = [
    ...new Set(data?.flatMap((m) => (m.authority ? [m.authority] : [])) ?? []),
  ];
  const count = [filters.status, filters.type, filters.authority].filter(
    Boolean,
  ).length;
  const set = (key: keyof MatterFilters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));
  return (
    <SafeAreaView style={s.page}>
      <FlatList
        data={rows}
        keyExtractor={(m) => m.id}
        contentContainerStyle={s.content}
        refreshing={loading && !!data}
        onRefresh={reload}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={s.gap}>
            <Text style={s.title}>الملفات</Text>
            <Button
              label="ملف جديد"
              onPress={() => router.push("/matters/new")}
            />
            <SearchInput
              placeholder="رقم الملف، العنوان أو الطرف"
              value={filters.query}
              onChangeText={(v) => set("query", v)}
            />
            <Button
              label={`تصفية وترتيب${count ? ` (${count})` : ""}`}
              variant="secondary"
              onPress={() => setVisible(true)}
            />
            <BodyText muted>
              {rows.length} ملف · {demoNotice}
            </BodyText>
            {error ? <ErrorState message={error} onRetry={reload} /> : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <LoadingState />
          ) : (
            <EmptyState
              title="لا توجد ملفات مطابقة"
              message="غيّر التصفية أو أنشئ ملفاً جديداً."
            />
          )
        }
        renderItem={({ item: m }) => (
          <Card>
            <View style={s.row}>
              <Badge
                label={matterStatuses[m.status]}
                tone={m.status === "ACTIVE" ? "success" : "neutral"}
              />
              <BodyText muted>{m.reference}</BodyText>
            </View>
            <Text style={s.title}>{m.title}</Text>
            <BodyText>
              {m.parties.find((p) => p.isPrimary)?.displayName}
            </BodyText>
            <BodyText muted>
              {matterTypes[m.type]} · {m.authority || "الجهة غير مسجلة"}
            </BodyText>
            {m.currentStage ? (
              <BodyText muted>المرحلة: {m.currentStage}</BodyText>
            ) : null}
            <BodyText muted>
              {m.nextEventAt
                ? `الموعد القادم: ${m.nextEventAt.slice(0, 10)}`
                : "لا يوجد موعد قادم مسجل"}
            </BodyText>
          </Card>
        )}
      />
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setVisible(false)}
      >
        <FormPage title="تصفية الملفات">
          <ChoiceField
            label="الحالة"
            value={filters.status}
            onChange={(v) => set("status", v)}
            options={[
              { value: "", label: "كل الحالات" },
              ...choices(matterStatuses),
            ]}
          />
          <ChoiceField
            label="النوع"
            value={filters.type}
            onChange={(v) => set("type", v)}
            options={[
              { value: "", label: "كل الأنواع" },
              ...choices(matterTypes),
            ]}
          />
          <ChoiceField
            label="المحكمة / الجهة"
            value={filters.authority}
            onChange={(v) => set("authority", v)}
            searchable
            options={[
              { value: "", label: "كل الجهات" },
              ...authorities.map((a) => ({ value: a, label: a })),
            ]}
          />
          <ChoiceField
            label="ترتيب"
            value={filters.sort}
            onChange={(v) => set("sort", v)}
            options={choices({
              recent: "الأحدث فتحاً",
              reference: "رقم الملف",
              next: "الموعد الأقرب",
            })}
          />
          <Button
            label={`عرض النتائج (${rows.length})`}
            onPress={() => setVisible(false)}
          />
          <Button
            label="مسح التصفية"
            variant="secondary"
            onPress={() => setFilters({ ...initial, query: filters.query })}
          />
        </FormPage>
      </Modal>
    </SafeAreaView>
  );
}
