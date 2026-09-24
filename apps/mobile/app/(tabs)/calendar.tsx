import { AppHeader } from '@/components/AppHeader';
import { EmptyState, ScreenContainer } from '@maktabi/ui';
import { View } from 'react-native';
export default function PlaceholderScreen() { return <View style={{ flex: 1 }}><AppHeader/><ScreenContainer><EmptyState title="التقويم" message="سيُبنى تقويم الجلسات في دفعة لاحقة."/></ScreenContainer></View>; }
