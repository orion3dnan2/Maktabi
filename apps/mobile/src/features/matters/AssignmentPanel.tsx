import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { BodyText, Button, ChoiceField, ErrorState, LoadingState } from '@maktabi/ui';
import { LuxeCard, SectionTitle } from '@/components/luxe';
import { useAuth } from '@/auth/AuthProvider';
import { can } from '@/auth/permissions';
import { assignmentRepository } from '@/data/sharedRepositories';
import { useResource } from '../shared/hooks';
import { useOperation } from '../shared/useOperation';
export function AssignmentPanel({matterId}:{matterId:string}) {
  const {access}=useAuth(); const resource=useResource(useCallback(async()=>({assignments:await assignmentRepository.list(matterId),members:await assignmentRepository.team()}),[matterId]));
  const [userId,setUserId]=useState(''); const [kind,setKind]=useState('primary'); const op=useOperation(resource.reload);
  return <LuxeCard><SectionTitle icon="people-outline" title="الفريق المكلّف بالقضية"/>
    {resource.error?<ErrorState message={resource.error} onRetry={resource.reload}/>:!resource.data?<LoadingState/>:<>
      {resource.data.assignments.filter(a=>!a.endedAt).map(a=><View key={a.id}><BodyText>{resource.data?.members.find(m=>m.id===a.userId)?.fullName??a.userId} · {a.isPrimary?'المسؤول الرئيسي':'مشارك'}</BodyText>{can(access,'assign_cases')?<Button label="إنهاء التعيين" variant="ghost" disabled={op.busy} onPress={()=>void op.run(()=>assignmentRepository.save(matterId,{userId:a.userId,isPrimary:a.isPrimary,remove:true}),'حُفظ إنهاء التعيين محلياً للمزامنة')}/>:null}</View>)}
      {can(access,'assign_cases')?<>
        <ChoiceField label="نوع التعيين" value={kind} onChange={setKind} options={[{value:'primary',label:'محامٍ مسؤول رئيسي'},{value:'support',label:'عضو مشارك'}]}/>
        <ChoiceField label="العضو" value={userId} onChange={setUserId} options={[{value:'',label:'اختر العضو'},...resource.data.members.filter(m=>m.status==='active' && (kind!=='primary' || ['admin','lawyer'].includes(m.role))).map(m=>({value:m.id,label:m.fullName}))]}/>
        <Button label="حفظ التعيين" disabled={op.busy || !userId} onPress={()=>void op.run(()=>assignmentRepository.save(matterId,{userId,isPrimary:kind==='primary'}),'حُفظ التعيين محلياً للمزامنة')}/>
      </>:null}
    </>}
    {op.error || op.message?<BodyText>{op.error || op.message}</BodyText>:null}
  </LuxeCard>;
}
