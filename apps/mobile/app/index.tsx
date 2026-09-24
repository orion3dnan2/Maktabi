import { useEffect } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@maktabi/ui';
import { BrandMark } from '@/components/BrandMark';
export default function SplashScreen() {
  useEffect(() => { const timer = setTimeout(() => router.replace('/login'), 900); return () => clearTimeout(timer); }, []);
  return <View style={styles.screen}><BrandMark inverse/><Text style={styles.message}>مساحتك القانونية، منظمة وآمنة</Text><View style={styles.line}/></View>;
}
const styles = StyleSheet.create({ screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xl, padding: spacing.xl, backgroundColor: colors.navy950 }, message: { color: '#D9DFE6', textAlign: 'center', writingDirection: 'rtl', fontSize: 13 }, line: { width: 42, height: 3, borderRadius: 3, backgroundColor: colors.gold500 } });
