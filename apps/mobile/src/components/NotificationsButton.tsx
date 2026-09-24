import { Alert } from 'react-native';
import { IconButton } from '@maktabi/ui';

export function NotificationsButton({ unread = false }: { unread?: boolean }) {
  return <IconButton icon="notifications-outline" label="الإشعارات" dot={unread} onPress={() => Alert.alert('الإشعارات', 'سيتوفر مركز الإشعارات في دفعة لاحقة.')}/>;
}
