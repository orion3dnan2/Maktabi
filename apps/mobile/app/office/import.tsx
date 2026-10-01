import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';
import { BodyText, Button, Card, FormPage, ErrorState, LoadingState } from '@maktabi/ui';
import { useAuth } from '@/auth/AuthProvider';
import { can } from '@/auth/permissions';
import { isUnlocked, vaultStorage } from '@/data/vault';
import { STORAGE_KEY } from '@/data/localRepositories';
import type { RepositorySnapshot } from '@/data/mockRepositories';
import { prepareLegacyImport } from '@/data/legacyImport';
import { sharedEngine } from '@/data/sharedRepositories';
import { useResource } from '@/features/shared/hooks';
import { useOperation } from '@/features/shared/useOperation';

async function stableId(key:string){const hash=await digestStringAsync(CryptoDigestAlgorithm.SHA256,key);return `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;}
export default function ImportScreen(){
  const router=useRouter();const {access}=useAuth();const [clients,setClients]=useState<string[]>([]);const [matters,setMatters]=useState<string[]>([]);const [confirmed,setConfirmed]=useState(false);
  const resource=useResource(useCallback(async()=>{if(!isUnlocked())throw new Error('افتح البيانات المحلية القديمة أولاً');const raw=await vaultStorage.getItem(STORAGE_KEY);if(!raw)throw new Error('لا توجد بيانات محلية');const snapshot=JSON.parse(raw) as RepositorySnapshot;if(snapshot.version!==1 || !Array.isArray(snapshot.clients) || !Array.isArray(snapshot.matters))throw new Error('صيغة النسخة غير صحيحة');return snapshot;},[]));
  const op=useOperation();const toggle=(id:string,current:string[],set:(ids:string[])=>void)=>{set(current.includes(id)?current.filter(value=>value!==id):[...current,id]);setConfirmed(false);};
  if(!can(access,'manage_team'))return <FormPage title="نقل البيانات السابقة"><BodyText>النقل متاح لمدير المكتب فقط.</BodyText></FormPage>;
  return <FormPage title="نقل العملاء والقضايا السابقة"><Button label="رجوع" variant="secondary" onPress={()=>router.back()}/>
    <BodyText>حدد السجلات الحقيقية فقط. قد تحتوي النسخة القديمة على بيانات تجريبية. نقل قضية يشمل العملاء المرتبطين بها. المالية والمرفقات والإجراءات لا تُرفع في هذه الخطوة، وتبقى النسخة القديمة محفوظة.</BodyText>
    {resource.error?<><ErrorState message={resource.error} onRetry={resource.reload}/><Button label="فتح البيانات المحلية" onPress={()=>router.push('/office/legacy')}/></>:!resource.data?<LoadingState/>:<>
      <Card><BodyText>العملاء</BodyText>{resource.data.clients.filter(c=>c.officeId==='office-1').map(c=><Button key={c.id} label={`${clients.includes(c.id)?'✓ ':''}${c.displayName} · ${c.phone}`} variant="secondary" onPress={()=>toggle(c.id,clients,setClients)}/>)}</Card>
      <Card><BodyText>القضايا</BodyText>{resource.data.matters.filter(m=>m.officeId==='office-1').map(m=><Button key={m.id} label={`${matters.includes(m.id)?'✓ ':''}${m.reference} · ${m.title}`} variant="secondary" onPress={()=>toggle(m.id,matters,setMatters)}/>)}</Card>
      <Button label={confirmed?'✓ أؤكد أن السجلات المختارة حقيقية':'تأكيد مراجعة السجلات المختارة'} variant="secondary" onPress={()=>setConfirmed(!confirmed)}/>
      <Button label="حفظ خطة النقل في طابور المزامنة" disabled={op.busy || !confirmed || (!clients.length && !matters.length)} onPress={()=>void op.run(async()=>{
        const engine=sharedEngine();await engine.sync();const existing=await engine.store.read();
        const plan=await prepareLegacyImport(resource.data!,clients,matters,Object.values(existing.clients).map(r=>r.value),Object.values(existing.matters).map(r=>r.value),access!.office!.id,`legacy:${access!.user_id}`,stableId);
        await engine.importRecords(plan.clients,plan.matters,`legacy:${access!.user_id}`,plan);
        setConfirmed(false);setClients([]);setMatters([]);
      },'حُفظت السجلات محلياً للمزامنة؛ راجع حالة العمليات لتأكيد قبول الخادم')}/>
    </>}
    {op.error || op.message?<BodyText>{op.error || op.message}</BodyText>:null}
  </FormPage>;
}
