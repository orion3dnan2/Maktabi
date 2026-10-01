import type { Client, Matter, MatterParty, MatterType } from '@maktabi/domain';
import { matterTypes } from '@maktabi/domain';
import { supabase } from '@/lib/supabase';
import type { Database, Json } from '@/lib/database.types';
import { SyncError, type CloudSnapshot, type Operation, type SyncTransport, type TeamMember } from './types';
type ClientRow = Database['public']['Tables']['clients']['Row'];
type MatterRow = Database['public']['Tables']['matters']['Row'];
type PartyRow = Database['public']['Tables']['matter_parties']['Row'];

export function cloudError(error: { code?: string; message: string; details?: string }): SyncError {
  if (error.code === 'PT409' || error.code === '40001') return new SyncError('conflict','تم تعديل السجل من جهاز آخر؛ راجع النسختين قبل المتابعة');
  if (error.code === '42501' || error.code === 'PGRST301') return new SyncError('forbidden','لم تعد لديك صلاحية لهذه العملية');
  if (!error.code || /fetch|network|timeout|connection/i.test(error.message)) return new SyncError('offline','بانتظار الاتصال للمزامنة');
  return new SyncError('invalid',error.message);
}
export function clientFromRow(row: ClientRow): Client {
  return { id:row.id,officeId:row.office_id,displayName:row.full_name,kind:row.client_type==='individual'?'PERSON':'ORGANIZATION',phone:row.phone??'',whatsapp:row.whatsapp??'',email:row.email??undefined,address:row.address??undefined,contactPerson:row.contact_person??undefined,registration:row.registration_number??undefined,nationalId:row.id_type==='national_id'?row.civil_id??undefined:undefined,notes:row.notes??undefined,status:row.status.toUpperCase() as Client['status'],createdAt:row.created_at };
}
export function matterFromRow(row: MatterRow, parties: PartyRow[], clients: Client[]): Matter {
  const type = row.matter_type.toUpperCase();
  const stringDetails = Object.fromEntries(Object.entries(row.details ?? {}).filter((entry): entry is [string,string] => typeof entry[1]==='string'));
  const mapped = parties.filter(p => p.matter_id===row.id).map(p => ({ id:p.id,matterId:row.id,clientId:p.client_id??undefined,displayName:clients.find(c => c.id===p.client_id)?.displayName??p.display_name??'',role:p.party_role.toUpperCase() as MatterParty['role'],isPrimary:p.is_primary }));
  if (!mapped.some(p => p.isPrimary)) {
    const existing = mapped.find(p => p.clientId===row.client_id && p.role==='CLIENT');
    if (existing) existing.isPrimary=true;
    else mapped.unshift({ id:row.id,matterId:row.id,clientId:row.client_id,displayName:clients.find(c => c.id===row.client_id)?.displayName??'',role:'CLIENT',isPrimary:true });
  }
  return { id:row.id,officeId:row.office_id,reference:row.matter_number,title:row.title,type:Object.hasOwn(matterTypes,type)?type as MatterType:'OTHER',parties:mapped,authority:row.court_name??'',status:row.status==='open'?'ACTIVE':row.status.toUpperCase() as Matter['status'],openedAt:row.opened_at,notes:row.description??undefined,details:stringDetails,assignedLawyerId:row.assigned_lawyer_id??undefined };
}
async function pages<T>(fetch: (offset:number) => PromiseLike<{ data: T[] | null; error: { message:string; code?:string } | null }>): Promise<T[]> {
  const result:T[]=[];
  for (let offset=0; ;offset+=500) { const {data,error}=await fetch(offset); if(error) throw cloudError(error); result.push(...data??[]); if(!data || data.length<500) return result; }
}
export function cloudTransport(officeId:string,userId:string): SyncTransport {
  return {
    async push(op:Operation) {
      const {data,error}=await supabase.rpc(op.kind==='client'?'sync_client':op.kind==='matter'?'sync_matter':'sync_assignment', { p_operation:op.id,p_office:officeId,p_id:op.entityId,p_base_revision:op.baseRevision,p_data:JSON.parse(JSON.stringify(op.payload)) as Json });
      if(error) throw cloudError(error); if(typeof data!=='number') throw new SyncError('invalid','لم يؤكد الخادم الحفظ'); return data;
    },
    async pull():Promise<CloudSnapshot> {
      const {data:membership,error:membershipError}=await supabase.from('office_members').select('role,status').eq('office_id',officeId).eq('user_id',userId).maybeSingle();
      if(membershipError) throw cloudError(membershipError);
      const {data:office,error:officeError}=await supabase.from('offices').select('status').eq('id',officeId).maybeSingle();
      if(officeError) throw cloudError(officeError);
      if(membership?.status!=='active' || office?.status!=='active') throw new SyncError('forbidden','عضوية المكتب غير نشطة');
      const [clientRows,matterRows,partyRows,assignments,profiles,memberships] = await Promise.all([
        pages(offset=>supabase.from('clients').select('*').eq('office_id',officeId).order('id').range(offset,offset+499)),
        pages(offset=>supabase.from('matters').select('*').eq('office_id',officeId).order('id').range(offset,offset+499)),
        pages(offset=>supabase.from('matter_parties').select('*').eq('office_id',officeId).order('id').range(offset,offset+499)),
        pages(offset=>supabase.from('matter_assignments').select('*').eq('office_id',officeId).order('id').range(offset,offset+499)),
        pages(offset=>supabase.from('profiles').select('id,full_name,role,is_active').eq('office_id',officeId).neq('role','client').order('id').range(offset,offset+499)),
        pages(offset=>supabase.from('office_members').select('user_id,role,status').eq('office_id',officeId).order('user_id').range(offset,offset+499)),
      ]);
      const clients=clientRows.map(clientFromRow);
      return { clients:clientRows.map((row,i)=>({value:clients[i]!,revision:row.revision,status:'synced'})),matters:matterRows.map(row=>({value:matterFromRow(row,partyRows,clients),revision:row.revision,status:'synced'})),assignments:assignments.map(a=>({id:a.id,matterId:a.matter_id,userId:a.user_id,isPrimary:a.is_primary,assignedAt:a.assigned_at,endedAt:a.ended_at})),members:profiles.flatMap(p=>{
        const membership=memberships.find(m=>m.user_id===p.id);
        const status:TeamMember['status']=membership?.status==='invited'?'invited':p.is_active && (!membership || membership.status==='active')?'active':'suspended';
        return p.role?[{id:p.id,fullName:p.full_name,role:membership?.role??p.role,status}]:[];
      }) };
    },
  };
}
