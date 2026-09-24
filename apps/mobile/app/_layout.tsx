import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { I18nManager } from 'react-native';
import { colors } from '@maktabi/ui';
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);
export default function RootLayout() { return <><StatusBar style="light" backgroundColor={colors.navy950}/><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: 'fade' }}/></>; }
