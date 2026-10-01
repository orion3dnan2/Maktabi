import { randomUUID } from 'expo-crypto';
import { validateClient, validateMatter, type ClientRepository, type MatterRepository } from '@maktabi/domain';
import type { Access } from '@/auth/access';
import { can } from '@/auth/permissions';
import { cloudTransport } from './sync/cloud';
import { operationalStore } from './sync/store';
import { SyncEngine } from './sync/engine';
import type { AssignmentCommand } from './sync/types';
import { canonicalClient } from './clientFields';
import { forgetAccess } from '../auth/offlineAccess';

export let OFFICE_ID = '';
let active: { engine: SyncEngine; access: Access } | undefined;
export const newId = randomUUID;
export function sharedEngine(): SyncEngine { if(!active) throw new Error('سجل الدخول إلى المكتب أولاً'); active.engine.assertAccess(); return active.engine; }
export function sharedAccess() { return active?.access; }
export function clearSharedSession() { active?.engine.stop(); active=undefined; OFFICE_ID=''; }
export async function initializeSharedSession(access:Access) {
  clearSharedSession();
  if(!access.office || !access.role || access.role==='client') return;
  OFFICE_ID=access.office.id;
  const store=await operationalStore(access.user_id,OFFICE_ID);
  const engine=new SyncEngine(OFFICE_ID,store,cloudTransport(OFFICE_ID,access.user_id),randomUUID,()=>forgetAccess(access.user_id));
  active={engine,access}; await engine.sync(); engine.assertAccess();
}
const requireOffice = (officeId:string) => { if(officeId!==OFFICE_ID || !active) throw new Error('المكتب غير صحيح'); return sharedEngine(); };
export const sharedClientRepository:ClientRepository = {
  async getById(id) { return (await sharedEngine().store.read()).clients[id]?.value??null; },
  async listByOffice(id) { return Object.values((await requireOffice(id).store.read()).clients).map(r=>r.value); },
  async save(client) {
    if(!can(active?.access,'create_clients')) throw new Error('لا تملك صلاحية حفظ العميل');
    client = canonicalClient(client);
    if(Object.keys(validateClient(client)).length) throw new Error('تحقق من بيانات العميل');
    await requireOffice(client.officeId).save('client',client,client.id);
  },
};
export const sharedMatterRepository:MatterRepository = {
  async getById(id) { return (await sharedEngine().store.read()).matters[id]?.value??null; },
  async listByOffice(id) { return Object.values((await requireOffice(id).store.read()).matters).map(r=>r.value); },
  async listByClient(id) { return Object.values((await sharedEngine().store.read()).matters).map(r=>r.value).filter(m=>m.parties.some(p=>p.clientId===id)); },
  async listActive(id) { return (await this.listByOffice(id)).filter(m=>m.status==='ACTIVE'); },
  async save(matter) {
    if(!can(active?.access,'edit_cases')) throw new Error('لا تملك صلاحية حفظ القضية');
    if(Object.keys(validateMatter(matter)).length) throw new Error('تحقق من بيانات القضية');
    const state=await requireOffice(matter.officeId).store.read();
    if(matter.parties.some(p=>p.clientId && !state.clients[p.clientId])) throw new Error('العميل غير موجود في المكتب');
    if(Object.values(state.matters).some(r=>r.value.id!==matter.id && r.value.reference.trim().toLocaleLowerCase()===matter.reference.trim().toLocaleLowerCase())) throw new Error('رقم الملف مستخدم بالفعل');
    await sharedEngine().save('matter',matter,matter.id);
  },
};
export const assignmentRepository = {
  async list(matterId:string) { return (await sharedEngine().store.read()).assignments.filter(a=>a.matterId===matterId); },
  async team() { return (await sharedEngine().store.read()).members; },
  async save(matterId:string,command:AssignmentCommand) {
    if(!can(active?.access,'assign_cases')) throw new Error('تعيين القضايا متاح لمدير المكتب فقط');
    const state=await sharedEngine().store.read();
    const member=state.members.find(m=>m.id===command.userId && m.status==='active');
    if(!command.remove && (!member || (command.isPrimary && !['admin','lawyer'].includes(member.role)))) throw new Error('اختر عضواً نشطاً؛ المسؤول الرئيسي محامٍ أو مدير');
    await sharedEngine().save('assignment',command,matterId);
  },
};
