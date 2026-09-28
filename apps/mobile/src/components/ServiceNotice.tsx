import { useRouter } from 'expo-router';
import { BodyText, Button, Card, SectionHeader } from '@maktabi/ui';
import { serviceRequirements, type ServiceKey } from '@/data/readiness';
export function ServiceNotice({ service }: { service: ServiceKey }) {
  const router = useRouter(); const item = serviceRequirements[service];
  return <Card><SectionHeader title={`متطلبات المكتب · ${item.title}`}/><BodyText>{item.need}</BodyText><BodyText muted>{item.next}</BodyText><Button label="توفير متطلبات التفعيل" variant="secondary" onPress={() => router.push({ pathname: '/office/readiness', params: { service } })}/></Card>;
}
