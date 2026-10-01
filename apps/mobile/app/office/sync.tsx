import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BodyText, Button, Card, ErrorState, FormPage, LoadingState } from '@maktabi/ui';
import { sharedEngine } from '@/data/sharedRepositories';
import { useResource } from '@/features/shared/hooks';
import { useOperation } from '@/features/shared/useOperation';
import type { Operation } from '@/data/sync/types';
export default function SyncScreen() {
  const router=useRouter(); const resource=useResource(useCallback(()=>sharedEngine().store.read(),[])); const op=useOperation(resource.reload);
  const [selected,setSelected]=useState<Operation>();
  const [preview,setPreview]=useState<Awaited<ReturnType<ReturnType<typeof sharedEngine>['previewServerVersion']>>>();
  const statuses = { pending: 'بانتظار المزامنة', failed: 'فشل الحفظ على الخادم', conflict: 'تعارض نسخ' };
  return <FormPage title="حالة المزامنة"><Button label="رجوع" variant="secondary" onPress={()=>router.back()}/>
    <Button label="مزامنة الآن" disabled={op.busy} onPress={()=>void op.run(()=>sharedEngine().sync(),'اكتملت محاولة المزامنة')}/>
    <BodyText>الحفظ المحلي لا يعني قبول الخادم. تعارض النسخ يحتاج مراجعة؛ لن نكتب فوق تعديل جهاز آخر تلقائياً.</BodyText>
    {resource.error?<ErrorState message={resource.error} onRetry={resource.reload}/>:!resource.data?<LoadingState/>:resource.data.operations.map(item=><Card key={item.id}>
      <BodyText>{item.kind==='client'?'عميل':item.kind==='matter'?'قضية':'تعيين'} · {statuses[item.status]} · نسخة الأساس {item.baseRevision}</BodyText>
      <BodyText>{'displayName' in item.payload?item.payload.displayName:'title' in item.payload?item.payload.title:item.entityId}</BodyText>
      {item.error?<BodyText>{item.error}</BodyText>:null}
      <Text selectable>{JSON.stringify(item.payload,null,2)}</Text>
      {item.status!=='pending'?<Button label="مراجعة نسخة الخادم" disabled={op.busy} variant="secondary" onPress={()=>void op.run(async()=>{const server=await sharedEngine().previewServerVersion(item.kind,item.entityId);setPreview(server);setSelected(item);})}/>:null}
    </Card>)}
    {selected&&preview?<Card><BodyText>نسخة الخادم الحالية: {preview.record?.revision ?? 'السجل غير موجود أو غير متاح'}</BodyText><Text selectable>{JSON.stringify(preview,null,2)}</Text><BodyText>اعتماد نسخة الخادم يلغي التعديلات المعلّقة لهذا السجل. يمكنك نسخ المسوّدة أعلاه قبل المتابعة. إذا كان عميلاً عليه قضايا معلّقة، راجعها أيضاً.</BodyText>
      <View style={{gap:8}}><Button label="أؤكد إلغاء التعديلات المحلية واعتماد الخادم" disabled={op.busy} onPress={()=>void op.run(async()=>{await sharedEngine().useServerVersion(selected.kind,selected.entityId,preview.record?.revision??0);setSelected(undefined);setPreview(undefined);},'تم تحميل نسخة الخادم')}/><Button label="احتفظ بالمسوّدة" variant="secondary" onPress={()=>{setSelected(undefined);setPreview(undefined);}}/></View>
    </Card>:null}
    {op.error?<BodyText>{op.error}</BodyText>:null}
  </FormPage>;
}
