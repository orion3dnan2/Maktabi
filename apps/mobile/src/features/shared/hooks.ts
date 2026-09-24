import { createElement, useEffect, useState } from "react";
import { useNavigation, useRouter } from "expo-router";
import { DiscardChangesDialog } from "@maktabi/ui";
import {
  useIsFocused,
  usePreventRemove,
  type NavigationAction,
} from "@react-navigation/native";
export function useResource<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isFocused) return;
    let active = true;
    setLoading(true);
    setError("");
    fetcher()
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setError("تعذر قراءة البيانات. حاول مرة أخرى.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetcher, revision, isFocused]);
  return { data, error, loading, reload: () => setRevision((r) => r + 1) };
}
export function useUnsavedChanges(dirty: boolean) {
  const router = useRouter();
  const navigation = useNavigation();
  const [pendingAction, setPendingAction] = useState<NavigationAction>();
  usePreventRemove(dirty, ({ data }) => setPendingAction(data.action));
  const cancel = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/clients");
  };
  const confirmation = createElement(DiscardChangesDialog, {
    visible: !!pendingAction,
    onStay: () => setPendingAction(undefined),
    onDiscard: () => {
      if (pendingAction) navigation.dispatch(pendingAction);
      setPendingAction(undefined);
    },
  });
  return { cancel, confirmation };
}
export const money = (minor: number) =>
  `${new Intl.NumberFormat("ar-SD").format(minor / 100)} ج.س`;
export const demoNotice =
  "بيانات خيالية • الحفظ تجريبي خلال الجلسة فقط؛ إعادة تشغيل التطبيق تعيد البيانات الأصلية.";
