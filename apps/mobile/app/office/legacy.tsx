import { useState } from 'react';
import { useRouter } from 'expo-router';
import { BodyText, Button, Card, FormPage, Input } from '@maktabi/ui';
import { useAuth } from '@/auth/AuthProvider';
import { isUnlocked, openUserVault } from '@/data/vault';
import { resetRepositories } from '@/data/repositories';
import { useOperation } from '@/features/shared/useOperation';
export default function LegacyScreen() {
  const {access}=useAuth(); const router=useRouter(); const [password,setPassword]=useState(''); const op=useOperation();
  return <FormPage title="فتح العمليات المحلية السابقة"><Card>
    <BodyText>العملاء والقضايا الجديدة تُزامن مع المكتب. الإجراءات والمالية والمرفقات السابقة ما زالت محفوظة على هذا الجهاز حتى نقلها.</BodyText>
    <BodyText>أدخل كلمة المرور التي كانت تفتح بيانات هذا الجهاز. تغيير كلمة مرور حسابك لا يحذف النسخة السابقة ولا يؤثر على العملاء والقضايا المشتركة.</BodyText>
    <Input label="كلمة مرور البيانات المحلية" value={password} onChangeText={setPassword} secureTextEntry/>
    <Button label="فتح البيانات المحلية" disabled={op.busy || !access?.phone} onPress={()=>void op.run(async()=>{await openUserVault(access!.user_id,access!.phone!,password);resetRepositories();setPassword('');router.back();},'تم فتح البيانات')}/>
    {isUnlocked()?<BodyText>البيانات المحلية مفتوحة.</BodyText>:null}
    {op.error?<BodyText>{op.error}</BodyText>:null}
    <Button label="رجوع" variant="secondary" onPress={()=>router.back()}/>
  </Card></FormPage>;
}
