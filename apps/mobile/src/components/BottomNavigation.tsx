import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, elevation, gradients, typography } from '@maktabi/ui';
import { row } from './luxe';

export const tabs = {
  index: { title: 'الرئيسية', icon: 'home-outline', active: 'home' },
  matters: { title: 'القضايا', icon: 'scale-balance', active: 'scale-balance' },
  clients: { title: 'العملاء', icon: 'add', active: 'people' },
  calendar: { title: 'المواعيد', icon: 'calendar-outline', active: 'calendar' },
  more: { title: 'المزيد', icon: 'ellipsis-horizontal', active: 'ellipsis-horizontal' },
} as const;
export type TabName = keyof typeof tabs;

export function BottomNavigation({ selected, onNavigate }: { selected: TabName; onNavigate: (name: TabName) => void }) {
  const insets = useSafeAreaInsets();
  const [scale] = useState(() => new Animated.Value(1));
  const spring = (toValue: number) => Animated.spring(scale, { toValue, useNativeDriver: true, friction: 6, tension: 220 }).start();
  return <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
    <LinearGradient colors={gradients.navy} style={StyleSheet.absoluteFill}/>
    <View style={[styles.items, { flexDirection: row }]}>
      {(Object.keys(tabs) as TabName[]).map((name) => {
        const tab = tabs[name]; const active = selected === name; const center = name === 'clients';
        const Icon = name === 'matters' ? MaterialCommunityIcons : Ionicons;
        return <Pressable key={name} accessibilityRole="tab" accessibilityLabel={tab.title} accessibilityState={{ selected: active }} onPress={() => onNavigate(name)} onPressIn={() => center && spring(0.93)} onPressOut={() => center && spring(1)} style={({ pressed }) => [styles.item, pressed && !center && { opacity: 0.65 }]}>
          {center ? <Animated.View style={[styles.fab, { transform: [{ scale }] }]}><LinearGradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 32 }]}/><Ionicons name={active ? 'people' : 'add'} size={32} color={colors.white}/></Animated.View> : <Icon name={(active ? tab.active : tab.icon) as never} size={26} color={active ? colors.gold400 : colors.white}/>}
          <Text style={[styles.label, active && styles.active]}>{tab.title}</Text>
          <View style={[styles.indicator, { opacity: active ? 1 : 0 }]}/>
        </Pressable>;
      })}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  bar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingTop: 10, backgroundColor: colors.navy950, ...elevation.raised },
  items: { width: '100%', maxWidth: 680, alignSelf: 'center', alignItems: 'flex-end' },
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', minHeight: 57, gap: 5 },
  label: { color: colors.white, fontFamily: typography.medium, fontSize: 13 },
  active: { color: colors.gold400, fontFamily: typography.bold },
  indicator: { width: 38, height: 2, borderRadius: 2, backgroundColor: colors.gold400 },
  fab: { position: 'absolute', top: -35, width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#FFF1D0', alignItems: 'center', justifyContent: 'center', ...elevation.gold },
});
