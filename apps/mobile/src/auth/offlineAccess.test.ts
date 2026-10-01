import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cachedAccess, forgetAccess, rememberAccess } from './offlineAccess';
import type { Access } from './access';
const values=vi.hoisted(()=>new Map<string,string>());
vi.mock('react-native',()=>({Platform:{OS:'ios'}}));
vi.mock('expo-secure-store',()=>({async getItemAsync(key:string){return values.get(key)??null;},async setItemAsync(key:string,value:string){values.set(key,value);},async deleteItemAsync(key:string){values.delete(key);}}));
const access:Access={user_id:'user-a',platform_admin:false,client_id:null,full_name:'عدنان',phone:'+249900000001',role:'admin',is_active:true,office:{id:'office-a',name:'مكتب اختبار',status:'active'}};
describe('bounded offline membership lease',()=>{
  beforeEach(()=>{values.clear();vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-30T10:00:00Z'));});afterEach(()=>vi.useRealTimers());
  it('recovers the last verified identity when token refresh cannot reach Auth',async()=>{await rememberAccess(access);expect(await cachedAccess()).toEqual(access);expect(await cachedAccess('other')).toBeUndefined();});
  it('expires after 24 hours and rejects future-dated verification',async()=>{await rememberAccess(access);vi.advanceTimersByTime(24*3600000);expect(await cachedAccess()).toBeUndefined();vi.setSystemTime(new Date('2026-09-30T09:00:00Z'));expect(await cachedAccess()).toBeUndefined();});
  it('forgets the active identity on signout without reusing another account lease',async()=>{await rememberAccess(access);await rememberAccess({...access,user_id:'user-b'});await forgetAccess('user-a');expect((await cachedAccess())?.user_id).toBe('user-b');await forgetAccess();expect(await cachedAccess()).toBeUndefined();expect(await cachedAccess('user-b')).toBeUndefined();});
  it('rejects a corrupted or mismatched lease',async()=>{await rememberAccess(access);values.set('maktabi.access.user-a','bad json');expect(await cachedAccess()).toBeUndefined();values.set('maktabi.access.user-a',JSON.stringify({access:{...access,user_id:'other'},verifiedAt:Date.now()}));expect(await cachedAccess()).toBeUndefined();});
});
