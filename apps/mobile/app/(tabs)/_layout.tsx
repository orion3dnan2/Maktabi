import type { ComponentProps } from 'react';
import { Tabs } from 'expo-router';
import { BottomNavigation, tabs, type TabName } from '@/components/BottomNavigation';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];
function TabBar({ state, navigation }: TabBarProps) {
  return <BottomNavigation selected={state.routes[state.index]!.name as TabName} onNavigate={(name) => {
    const route = state.routes.find((r) => r.name === name)!;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!event.defaultPrevented) navigation.navigate(name);
  }}/>;
}
export default function TabLayout() {
  return <Tabs tabBar={(props) => <TabBar {...props}/>} screenOptions={{ headerShown: false, animation: 'fade' }}>
    {Object.entries(tabs).map(([name, tab]) => <Tabs.Screen key={name} name={name} options={{ title: tab.title }}/>)}
  </Tabs>;
}
