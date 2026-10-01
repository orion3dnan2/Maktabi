import { describe, expect, it } from 'vitest';
import { can } from './permissions';
import type { Access, OfficeRole } from './access';
const access=(role:OfficeRole):Access=>({user_id:'u',full_name:'x',phone:null,office:{id:'o',name:'office',status:'active'},role,is_active:true,client_id:null,platform_admin:false});
describe('office capabilities',()=>{
  it('allows only admins to assign and change office configuration',()=>{for(const role of ['admin','lawyer','employee','reception','client'] as OfficeRole[]){expect(can(access(role),'assign_cases')).toBe(role==='admin');expect(can(access(role),'manage_office_settings')).toBe(role==='admin');}});
  it('limits reception and rejects inactive offices',()=>{expect(can(access('reception'),'create_clients')).toBe(true);expect(can(access('reception'),'edit_cases')).toBe(false);expect(can({...access('admin'),is_active:false},'manage_team')).toBe(false);expect(can({...access('admin'),office:{id:'o',name:'x',status:'suspended'}},'manage_team')).toBe(false);});
});
