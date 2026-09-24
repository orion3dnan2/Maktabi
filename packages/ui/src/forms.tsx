import { useState, type ReactNode } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Button, Input } from "./primitives";
import { colors, layout, spacing, typography } from "./theme";
export const featureStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas },
  content: {
    width: "100%",
    maxWidth: layout.maxContentWidth,
    alignSelf: "center",
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  text: {
    textAlign: "right",
    writingDirection: "rtl",
    fontFamily: typography.regular,
    fontSize: 14,
    lineHeight: 23,
    color: colors.ink,
  },
  muted: {
    textAlign: "right",
    writingDirection: "rtl",
    color: colors.muted,
    fontSize: 12,
    lineHeight: 21,
  },
  title: {
    textAlign: "right",
    writingDirection: "rtl",
    fontFamily: typography.medium,
    color: colors.navy900,
    fontSize: 19,
    lineHeight: 29,
  },
  row: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: spacing.xs,
    alignItems: "center",
  },
  gap: { gap: spacing.sm },
  error: { color: colors.danger, textAlign: "right", writingDirection: "rtl" },
  item: {
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
export function BodyText({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <Text style={muted ? featureStyles.muted : featureStyles.text}>
      {children}
    </Text>
  );
}
export function ChoiceField({
  label,
  value,
  options,
  onChange,
  error,
  searchable = false,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  error?: string;
  searchable?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");
  return (
    <View style={featureStyles.gap}>
      <BodyText>{label}</BodyText>
      <Button
        label={options.find((o) => o.value === value)?.label ?? "اختر…"}
        variant="secondary"
        onPress={() => {
          setQuery("");
          setVisible(true);
        }}
      />
      {error ? (
        <Text accessibilityRole="alert" style={featureStyles.error}>
          {error}
        </Text>
      ) : null}
      <Modal
        visible={visible}
        animationType="slide"
        onRequestClose={() => setVisible(false)}
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={featureStyles.page}>
          <View style={featureStyles.content}>
            <Text style={featureStyles.title}>{label}</Text>
            <Button label="إغلاق" onPress={() => setVisible(false)} />
            {searchable ? (
              <Input label="بحث" value={query} onChangeText={setQuery} />
            ) : null}
          </View>
          <FlatList
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={featureStyles.content}
            data={options.filter((o) =>
              o.label
                .normalize("NFKC")
                .replace(/[أإآ]/g, "ا")
                .includes(query.normalize("NFKC").replace(/[أإآ]/g, "ا")),
            )}
            keyExtractor={(o) => o.value}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: item.value === value }}
                style={featureStyles.item}
                onPress={() => {
                  onChange(item.value);
                  setVisible(false);
                }}
              >
                <BodyText>
                  {item.value === value ? "✓ " : ""}
                  {item.label}
                </BodyText>
              </Pressable>
            )}
            ListEmptyComponent={<BodyText>لا توجد نتائج</BodyText>}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}
export function FormPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={featureStyles.page}>
      <KeyboardAvoidingView
        style={featureStyles.page}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={featureStyles.content}
        >
          <Text accessibilityRole="header" style={featureStyles.title}>
            {title}
          </Text>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export const choices = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

export function DiscardChangesDialog({
  visible,
  onStay,
  onDiscard,
}: {
  visible: boolean;
  onStay: () => void;
  onDiscard: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onStay}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          backgroundColor: "#071C3399",
          padding: spacing.lg,
        }}
      >
        <View
          style={{
            ...featureStyles.content,
            backgroundColor: colors.surface,
            borderRadius: 16,
          }}
        >
          <Text accessibilityRole="header" style={featureStyles.title}>
            تغييرات غير محفوظة
          </Text>
          <BodyText>هل تريد مغادرة النموذج وفقدان التغييرات؟</BodyText>
          <Button label="متابعة التعديل" onPress={onStay} />
          <Button
            label="تجاهل التغييرات"
            variant="secondary"
            onPress={onDiscard}
          />
        </View>
      </View>
    </Modal>
  );
}
