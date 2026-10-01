import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { I18nManager, View } from 'react-native';
import { useFonts, Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Tajawal_800ExtraBold } from '@expo-google-fonts/tajawal';
import { colors } from '@maktabi/ui';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { canOpen, homeFor } from '@/auth/access';
import { SyncStatus } from '@/features/shared/SyncStatus';
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

/** Sends every user to the part of the app their role allows. The server enforces the same rules (RLS). */
function RouteGuard() {
  const router = useRouter(); const segments = useSegments() as string[]; const { status, access } = useAuth();
  useEffect(() => {
    if (status === 'loading') return;
    const inAuth = segments[0] === '(auth)';
    if (status === 'signedOut' || !access) { if (!inAuth) router.replace('/login'); return; }
    if (!canOpen(access, segments)) router.replace(homeFor(access));
  }, [status, access, segments, router]);
  return <View style={{ flex: 1 }}><SyncStatus/><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: 'fade' }}/></View>;
}

export default function RootLayout() {
  const [loaded, fontError] = useFonts({ Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Tajawal_800ExtraBold });
  if (!loaded && !fontError) return <View style={{ flex: 1, backgroundColor: colors.navy950 }}/>;
  return <AuthProvider><StatusBar style="light"/><RouteGuard/></AuthProvider>;
}
