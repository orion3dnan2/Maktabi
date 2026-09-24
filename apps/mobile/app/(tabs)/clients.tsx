import { AppHeader } from '@/components/AppHeader';
import { EmptyState, ScreenContainer } from '@maktabi/ui';
import { View } from 'react-native';
export default function PlaceholderScreen() { return <View style={{ flex: 1 }}><AppHeader/><ScreenContainer><EmptyState title="العملاء" message="ستتوفر إدارة العملاء في الدفعة الثانية."/></ScreenContainer></View>; }
