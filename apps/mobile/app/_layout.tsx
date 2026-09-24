import { useEffect } from 'react';
import { NotoSansArabic_400Regular } from '@expo-google-fonts/noto-sans-arabic/400Regular';
import { NotoSansArabic_500Medium } from '@expo-google-fonts/noto-sans-arabic/500Medium';
import { NotoSansArabic_700Bold } from '@expo-google-fonts/noto-sans-arabic/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { I18nManager } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@maktabi/ui';

// Native RTL takes effect from the next launch; layout tokens in @maktabi/ui keep Arabic order correct either way.
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({ NotoSansArabic_400Regular, NotoSansArabic_500Medium, NotoSansArabic_700Bold });
  const ready = loaded || !!error;
  useEffect(() => { if (ready) void SplashScreen.hideAsync(); }, [ready]);
  if (!ready) return null;
  // Every screen opens on a dark navy hero, so light status-bar content is correct throughout.
  return <SafeAreaProvider><StatusBar style="light"/><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: 'fade' }}/></SafeAreaProvider>;
}
