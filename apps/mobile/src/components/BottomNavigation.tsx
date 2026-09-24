import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { Tabs } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, elevation, fonts, gradients, type IconName, layout, rtl, spacing } from '@maktabi/ui';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** The five destinations, in Arabic reading order (right to left). `featured` is the raised centre item. */
export const TAB_ITEMS = [
  { name: 'index', title: 'الرئيسية', icon: 'home-outline', active: 'home' },
  { name: 'matters', title: 'الملفات', icon: 'folder-open-outline', active: 'folder-open' },
  { name: 'clients', title: 'العملاء', icon: 'people', active: 'people', featured: true },
  { name: 'calendar', title: 'التقويم', icon: 'calendar-outline', active: 'calendar' },
  { name: 'more', title: 'المزيد', icon: 'ellipsis-horizontal', active: 'ellipsis-horizontal' },
] as const satisfies readonly { name: string; title: string; icon: IconName; active: IconName; featured?: boolean }[];

export function BottomNavigation({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.xs) }]}>
    <View style={styles.items}>
      {TAB_ITEMS.map((item) => {
        const index = state.routes.findIndex((route) => route.name === item.name);
        const route = state.routes[index];
        if (!route) return null;
        const focused = state.index === index;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };
        const tint = focused ? colors.gold500 : colors.onDarkMuted;
        const featured = 'featured' in item && item.featured;
        return <Pressable key={item.name} accessibilityRole="tab" accessibilityLabel={item.title} accessibilityState={{ selected: focused }} onPress={onPress} style={styles.item}>
          {featured
            ? <LinearGradient colors={gradients.gold} style={[styles.featured, focused && styles.featuredActive]}><Ionicons name={item.active} size={26} color={colors.white}/></LinearGradient>
            : <Ionicons name={focused ? item.active : item.icon} size={24} color={tint}/>}
          <Text numberOfLines={1} style={[styles.label, { color: tint }, focused && styles.labelActive]}>{item.title}</Text>
          <View style={[styles.underline, focused && styles.underlineActive]}/>
        </Pressable>;
      })}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.navy950, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: spacing.xs, ...elevation.raised },
  items: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', minHeight: layout.tabBarHeight - spacing.xs, flexDirection: rtl.row, alignItems: 'flex-end' },
  item: { flex: 1, minHeight: layout.minTouchTarget, alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  featured: { width: 60, height: 60, marginTop: -30, borderRadius: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.navy950, ...elevation.raised },
  featuredActive: { borderColor: colors.gold300 },
  label: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 19 },
  labelActive: { fontFamily: fonts.bold },
  underline: { width: 26, height: 3, borderRadius: 2, backgroundColor: 'transparent' },
  underlineActive: { backgroundColor: colors.gold500 },
});
