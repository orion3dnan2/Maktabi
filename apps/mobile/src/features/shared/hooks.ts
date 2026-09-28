import { createElement, useEffect, useState } from "react";
import { useNavigation, useRouter } from "expo-router";
import { DiscardChangesDialog } from "@maktabi/ui";
import {
  useIsFocused,
  usePreventRemove,
  type NavigationAction,
} from "expo-router/react-navigation";
export function useResource<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const isFocused = useIsFocused();
  // Reset while rendering, not in the effect, whenever the effect below is about to fetch again.
  const [requested, setRequested] = useState({ fetcher, revision, isFocused });
  if (requested.fetcher !== fetcher || requested.revision !== revision || requested.isFocused !== isFocused) {
    setRequested({ fetcher, revision, isFocused });
    if (isFocused) {
      setLoading(true);
      setError("");
    }
  }
  useEffect(() => {
    if (!isFocused) return;
    let active = true;
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
  "نسخة محلية • تُحفظ البيانات على هذا الجهاز دون مزامنة مع خادم.";

