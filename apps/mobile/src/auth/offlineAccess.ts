import { Platform } from 'react-native';
import { getItemAsync, setItemAsync, deleteItemAsync } from 'expo-secure-store';
import type { Access } from './access';
const leaseMs = 24 * 60 * 60 * 1000;
const name = (userId:string) => `maktabi.access.${userId}`;
const currentKey = 'maktabi.access.current-user';
const read = (key:string) => Platform.OS==='web'?Promise.resolve(localStorage.getItem(key)):getItemAsync(key);
const write = (key:string,value:string) => Platform.OS==='web'?Promise.resolve(localStorage.setItem(key,value)):setItemAsync(key,value);
const remove = (key:string) => Platform.OS==='web'?Promise.resolve(localStorage.removeItem(key)):deleteItemAsync(key);
export async function rememberAccess(access:Access) {
  const raw=JSON.stringify({access,verifiedAt:Date.now()});
  await write(name(access.user_id),raw); await write(currentKey,access.user_id);
}
export async function cachedAccess(userId?:string):Promise<Access | undefined> {
  userId ??= (await read(currentKey)) ?? undefined;
  if(!userId) return;
  const raw=await read(name(userId));
  if(!raw) return;
  try { const value=JSON.parse(raw) as {access:Access;verifiedAt:number}; if(value.access.user_id===userId && Number.isFinite(value.verifiedAt) && Date.now()>=value.verifiedAt && Date.now()-value.verifiedAt<leaseMs) return value.access; } catch { return; }
}
export async function forgetAccess(userId?:string) {
  const current=await read(currentKey); userId ??= current ?? undefined;
  if(userId) await remove(name(userId));
  if(current===userId) await remove(currentKey);
}
