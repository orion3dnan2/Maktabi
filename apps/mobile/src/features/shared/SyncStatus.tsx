import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState, Text, View } from 'react-native';
import { Button, colors } from '@maktabi/ui';
import { sharedEngine } from '@/data/sharedRepositories';
import { useAuth } from '@/auth/AuthProvider';
import { useRouter } from 'expo-router';

export function SyncStatus() {
  const {access,status}=useAuth(); const router=useRouter();
  const engine=useMemo(()=>{
    if(status!=='ready' || !access?.office || access.role==='client') return undefined;
    try { return sharedEngine(); } catch { return undefined; }
  },[access,status]);
  const subscribe=useCallback((listener:()=>void)=>engine?.subscribe(listener)??(()=>undefined),[engine]);
  const snapshot=useCallback(()=>engine?.summary(),[engine]);
  const summary=useSyncExternalStore(subscribe,snapshot,snapshot);
  const sync=useCallback(()=>{ void engine?.sync(); },[engine]);
  useEffect(()=>{
    if(!engine) return;
    const timer=setInterval(()=>{ if(AppState.currentState==='active') void engine.sync(); },20000);
    const listener=AppState.addEventListener('change',state=>{ if(state==='active') void engine.sync(); });
    return ()=>{clearInterval(timer);listener.remove();};
  },[engine]);
  if(!summary) return null;
  return <View style={{padding:10,gap:6,backgroundColor:colors.gold50}}>
    <Text style={{textAlign:'right',color:colors.navy950}}>المزامنة: {summary.offline?'بانتظار الاتصال':summary.error?'تحتاج مراجعة':'متصل'} · معلّق {summary.pending} · تعارض {summary.conflicts} · فشل {summary.failed}</Text>
    {summary.error?<Text style={{textAlign:'right',color:colors.danger}}>{summary.error}</Text>:null}
    {summary.pending || summary.offline?<Button label="مزامنة الآن" variant="ghost" onPress={sync}/>:null}
    {summary.conflicts || summary.failed?<Button label="مراجعة العمليات" variant="ghost" onPress={()=>router.push('/office/sync')}/>:null}
  </View>;
}
