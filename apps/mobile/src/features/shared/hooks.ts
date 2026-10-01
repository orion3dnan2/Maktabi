import { createElement, useEffect, useState } from "react";
import { useNavigation, useRouter } from "expo-router";
import { DiscardChangesDialog } from "@maktabi/ui";
import { sharedEngine } from '@/data/sharedRepositories';
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
  useEffect(() => {
    if (!isFocused) return;
    try { return sharedEngine().subscribe(() => setRevision(r => r + 1)); }
    catch { return; } // Authentication/platform screens have no office sync engine.
  }, [isFocused]);
  useEffect(() => {
    if (!isFocused) return;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return undefined;
      setLoading(true);
      setError("");
      return fetcher();
    })
      .then((result) => {
        if (active && result !== undefined) setData(result);
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : "تعذر قراءة البيانات. حاول مرة أخرى.");
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
  "العملاء والقضايا تُحفظ محلياً وتُزامن مع المكتب؛ بقية العمليات المحلية لم تُنقل بعد.";

