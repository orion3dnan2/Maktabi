import { AppHeader } from '@/components/AppHeader';
import { EmptyState, ScreenContainer } from '@maktabi/ui';
import { View } from 'react-native';
export default function PlaceholderScreen() { return <View style={{ flex: 1 }}><AppHeader/><ScreenContainer><EmptyState title="المزيد" message="ستظهر وحدات مكتبي الإضافية هنا لاحقاً."/></ScreenContainer></View>; }
