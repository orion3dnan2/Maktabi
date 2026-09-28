import { useEffect } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '@maktabi/ui';
import { Emblem, HeroBackdrop } from '@/components/luxe';
export default function SplashScreen() {
  useEffect(() => { const timer = setTimeout(() => router.replace('/login'), 900); return () => clearTimeout(timer); }, []);
  return <HeroBackdrop style={styles.screen} scales={false}><Emblem size={120}/><Text style={styles.name}>مكتبي</Text><Text style={styles.message}>مساحتك القانونية، منظمة وآمنة</Text><View style={styles.line}/></HeroBackdrop>;
}
const styles = StyleSheet.create({ screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }, name: { color: colors.gold400, fontFamily: typography.black, fontSize: 44, lineHeight: 60 }, message: { color: '#D9DFE6', textAlign: 'center', writingDirection: 'rtl', fontFamily: typography.medium, fontSize: 15 }, line: { width: 42, height: 3, borderRadius: 3, backgroundColor: colors.gold500 } });
