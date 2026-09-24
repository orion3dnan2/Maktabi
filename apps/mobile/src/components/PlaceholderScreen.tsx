import { EmptyState, HeroScreen, type IconName } from '@maktabi/ui';
import { NotificationsButton } from './NotificationsButton';

/** Tab destinations whose features belong to later batches: reference hero plus an honest empty state. */
export function PlaceholderScreen({ title, subtitle, icon, message }: { title: string; subtitle: string; icon: IconName; message: string }) {
  return <HeroScreen hero={{ title, subtitle, action: <NotificationsButton/> }}>
    <EmptyState icon={icon} title="قريباً" message={message}/>
  </HeroScreen>;
}
