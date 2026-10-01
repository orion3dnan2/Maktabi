import { describe, expect, it } from 'vitest';
import type { Client, Matter } from '@maktabi/domain';
import type { RepositorySnapshot } from './mockRepositories';
import { prepareLegacyImport } from './legacyImport';
const client:Client={id:'old-c',officeId:'office-1',displayName:'عدنان',kind:'PERSON',phone:'+249900000001',whatsapp:'+249900000001',createdAt:'2026-09-30'};
const matter:Matter={id:'old-m',officeId:'office-1',reference:'FILE-001',title:'قضية قديمة',type:'CIVIL',status:'ACTIVE',authority:'محكمة',openedAt:'2026-09-30',details:{},parties:[{id:'old-p',matterId:'old-m',clientId:'old-c',displayName:'عدنان',role:'CLIENT',isPrimary:true}]};
const snapshot=():RepositorySnapshot=>({version:1,clients:[client],matters:[matter],profiles:[],workflows:[]});
const stable=async(key:string)=>`stable:${key}`;
describe('explicit legacy import planning',()=>{
  it('includes case dependencies, remaps every identity and preserves original data',async()=>{const original=snapshot();const copy=structuredClone(original);const plan=await prepareLegacyImport(original,[],['old-m'],[],[],'office-a','source-a',stable);expect(plan.clients).toHaveLength(1);expect(plan.matters[0]?.parties[0]?.clientId).toBe(plan.clients[0]?.id);expect(plan.matters[0]?.parties[0]?.matterId).toBe(plan.matters[0]?.id);expect(plan.clients[0]?.officeId).toBe('office-a');expect(original).toEqual(copy);});
  it('is idempotent and reconciles an exact existing client/case instead of duplicating',async()=>{const first=await prepareLegacyImport(snapshot(),[],['old-m'],[],[],'office-a','source-a',stable);const second=await prepareLegacyImport(snapshot(),[],['old-m'],first.clients,first.matters,'office-a','source-a',stable);expect(second.clients).toEqual([]);expect(second.matters).toEqual([]);expect(second.matterIds['old-m']).toBe(first.matters[0]?.id);});
  it('refuses to overwrite another case that shares its reference',async()=>{const existing={...matter,id:'other',officeId:'office-a',title:'قضية مختلفة'};await expect(prepareLegacyImport(snapshot(),[],['old-m'],[],[existing],'office-a','source-a',stable)).rejects.toThrow('لن يتم استبدالها');});
  it('imports no demo or other records without an explicit selection',async()=>{const plan=await prepareLegacyImport(snapshot(),[],[],[],[],'office-a','source-a',stable);expect(plan.clients).toEqual([]);expect(plan.matters).toEqual([]);});
  it('rejects invalid dependencies before any work is enqueued',async()=>{await expect(prepareLegacyImport({...snapshot(),clients:[]},[],['old-m'],[],[],'office-a','source-a',stable)).rejects.toThrow('غير موجود');});
});
