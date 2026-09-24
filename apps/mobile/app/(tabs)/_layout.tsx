import { Tabs } from 'expo-router';
import { colors } from '@maktabi/ui';
import { BottomNavigation, TAB_ITEMS } from '@/components/BottomNavigation';

export default function TabLayout() {
  return <Tabs tabBar={(props) => <BottomNavigation {...props}/>} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.canvas } }}>
    {TAB_ITEMS.map((tab) => <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title }}/>)}
  </Tabs>;
}
