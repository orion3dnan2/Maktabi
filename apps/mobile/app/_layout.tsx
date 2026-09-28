import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { isUnlocked } from '@/data/vault';
import { StatusBar } from 'expo-status-bar';
import { I18nManager, View } from 'react-native';
import { useFonts, Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Tajawal_800ExtraBold } from '@expo-google-fonts/tajawal';
import { colors } from '@maktabi/ui';
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);
export default function RootLayout() {
  const router = useRouter(); const segments = useSegments();
  const [loaded, fontError] = useFonts({ Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Tajawal_800ExtraBold });
  useEffect(() => { if ((loaded || fontError) && !isUnlocked() && segments[0] !== '(auth)' && !(segments[0] === 'office' && segments[1] === 'backup')) router.replace('/login'); }, [loaded, fontError, segments, router]);
  if (!loaded && !fontError) return <View style={{ flex: 1, backgroundColor: colors.navy950 }}/>;
  return <><StatusBar style="light"/><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: 'fade' }}/></>;
}
