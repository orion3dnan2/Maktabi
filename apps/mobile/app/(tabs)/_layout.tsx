import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { colors, layout, typography } from '@maktabi/ui';
const tabs = [
  { name: 'index', title: 'الرئيسية', icon: 'home-outline', active: 'home' },
  { name: 'matters', title: 'الملفات', icon: 'folder-open-outline', active: 'folder-open' },
  { name: 'calendar', title: 'التقويم', icon: 'calendar-outline', active: 'calendar' },
  { name: 'clients', title: 'العملاء', icon: 'people-outline', active: 'people' },
  { name: 'more', title: 'المزيد', icon: 'menu-outline', active: 'menu' },
] as const;
export default function TabLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.gold600, tabBarInactiveTintColor: colors.muted, tabBarLabelStyle: { fontFamily: typography.medium, fontSize: 10 }, tabBarStyle: { height: 68, paddingTop: 6, paddingBottom: 8, borderTopColor: colors.border, backgroundColor: colors.surface }, tabBarItemStyle: { minHeight: layout.minTouchTarget } }}>{tabs.map((tab) => <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title, tabBarAccessibilityLabel: tab.title, tabBarIcon: ({ focused, color, size }) => <Ionicons name={(focused ? tab.active : tab.icon) as never} size={size} color={color}/> }}/>)}</Tabs>;
}
