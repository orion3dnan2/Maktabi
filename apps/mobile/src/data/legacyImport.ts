import type { Client, Matter } from '@maktabi/domain';
import { normalizeArabic, validateClient, validateMatter } from '@maktabi/domain';
import type { RepositorySnapshot } from './mockRepositories';
import { canonicalClient } from './clientFields';

export interface ImportPlan { clients:Client[]; matters:Matter[]; clientIds:Record<string,string>; matterIds:Record<string,string> }
/** No writes here: validate the entire selection and reconcile exact identities before enqueueing. */
export async function prepareLegacyImport(snapshot:RepositorySnapshot, selectedClients:string[], selectedMatters:string[], existingClients:Client[], existingMatters:Matter[], officeId:string, source:string, stableId:(key:string)=>Promise<string>):Promise<ImportPlan> {
  const selectedCases=snapshot.matters.filter(m=>selectedMatters.includes(m.id));
  const requiredClients=new Set([...selectedClients,...selectedCases.flatMap(m=>m.parties.flatMap(p=>p.clientId?[p.clientId]:[]))]);
  const clientIds:Record<string,string>={}; const matterIds:Record<string,string>={}; const clients:Client[]=[]; const matters:Matter[]=[];
  for(const oldId of requiredClients){
    const old=snapshot.clients.find(c=>c.id===oldId);if(!old)throw new Error('عميل مرتبط بالقضية غير موجود في النسخة؛ أصلح البيانات قبل النقل');
    const id=await stableId(`${officeId}:${source}:client:${old.id}`);
    const value=canonicalClient({...old,id,officeId});
    const matches=existingClients.filter(c=>c.id===id || (normalizeArabic(c.displayName)===normalizeArabic(value.displayName) && c.phone===value.phone) || (!!value.nationalId && c.nationalId===value.nationalId) || (!!value.registration && c.registration===value.registration));
    if(matches.length>1)throw new Error(`توجد سجلات متكررة للعميل ${old.displayName}؛ تحتاج توفيقاً يدوياً`);
    const match=matches[0];clientIds[old.id]=match?.id??id;
    if(match)continue;if(Object.keys(validateClient(value)).length)throw new Error(`بيانات العميل ${old.displayName} غير مكتملة؛ أصلحها قبل النقل`);clients.push(value);
  }
  for(const old of selectedCases){
    const id=await stableId(`${officeId}:${source}:matter:${old.id}`);
    const primary=clientIds[old.parties.find(p=>p.isPrimary)?.clientId??''];
    const matches=existingMatters.filter(m=>m.id===id || normalizeArabic(m.reference)===normalizeArabic(old.reference));
    if(matches.length>1)throw new Error(`رقم الملف ${old.reference} يحتاج توفيقاً يدوياً`);
    const match=matches[0];
    if(match){if(match.parties.find(p=>p.isPrimary)?.clientId!==primary || normalizeArabic(match.title)!==normalizeArabic(old.title))throw new Error(`رقم الملف ${old.reference} مستخدم لقضية مختلفة؛ لن يتم استبدالها`);matterIds[old.id]=match.id;continue;}
    const parties=await Promise.all(old.parties.map(async p=>({...p,id:await stableId(`${officeId}:${source}:party:${p.id}`),matterId:id,clientId:p.clientId?clientIds[p.clientId]:undefined})));
    const value={...old,id,officeId,parties};if(Object.keys(validateMatter(value)).length)throw new Error(`بيانات القضية ${old.reference} غير مكتملة؛ أصلحها قبل النقل`);matterIds[old.id]=id;matters.push(value);
  }
  return {clients,matters,clientIds,matterIds};
}
