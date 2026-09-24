import { useEffect } from 'react';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { colors, Emblem, gradients, HeroDecoration, spacing, type } from '@maktabi/ui';

export default function SplashScreen() {
  useEffect(() => { const timer = setTimeout(() => router.replace('/login'), 900); return () => clearTimeout(timer); }, []);
  return <LinearGradient colors={gradients.hero} style={styles.screen}>
    <HeroDecoration/>
    <Emblem size={112}/>
    <View style={styles.brand}>
      <Text style={[type.display, styles.center, styles.name]}>مكتبي</Text>
      <Text style={[type.body, styles.center, { color: colors.onDarkMuted }]}>مساحتك القانونية، منظمة في مكان واحد</Text>
    </View>
    <View style={styles.line}/>
  </LinearGradient>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xl, padding: spacing.xl },
  brand: { alignItems: 'center', gap: spacing.xxs },
  name: { fontSize: 38, lineHeight: 56, color: colors.gold300 },
  center: { textAlign: 'center' },
  line: { width: 44, height: 3, borderRadius: 3, backgroundColor: colors.gold500 },
});
