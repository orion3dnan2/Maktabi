// Integration probe for explicitly provisioned temporary accounts. Never uses a service role.
// Fixture manifest is kept outside Git and contains six disposable accounts + two test offices.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
const fixture = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const env = Object.fromEntries(readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => { const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1).replace(/^['"]|['"]$/g,'')]; }));
const sessions=[];
const check = (result) => { if(result.error) throw new Error(`${result.error.code ?? ''}: ${result.error.message}`);return result.data; };
try {
  for(const phone of fixture.phones) {
    const api=createClient(env.EXPO_PUBLIC_SUPABASE_URL,env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(30000)})}});
    check(await api.auth.signInWithPassword({email:`p${phone.slice(1)}@phone.maktabi.invalid`,password:fixture.password}));
    sessions.push(api);
  }
  const [owner,admin,lawyer,employee,reception,other]=sessions;
  const access=check(await admin.rpc('my_access'));
  assert.equal(access.office.id,fixture.officeA);assert.equal(access.role,'admin');
  const member=check(await admin.from('office_members').select('*').eq('office_id',fixture.officeA).eq('user_id',fixture.users[1]).single());
  assert.equal(member.status,'active');
  assert.equal(check(await admin.from('offices').select('id,status').eq('id',fixture.officeA).single()).status,'active');
  assert.equal(check(await admin.from('profiles').select('id,role,is_active').eq('office_id',fixture.officeA)).length,4);
  const clientId=randomUUID(),matterId=randomUUID(),operation=randomUUID();
  const client={displayName:'TEMP API Client',kind:'PERSON',phone:'+249900000119',whatsapp:'+249900000119',nationalId:String(parseInt(clientId.replaceAll('-','').slice(0,12),16)),email:'temp@example.com'};
  const args={p_operation:operation,p_office:fixture.officeA,p_id:clientId,p_base_revision:0,p_data:client};
  assert.equal(check(await admin.rpc('sync_client',args)),1);assert.equal(check(await admin.rpc('sync_client',args)),1);
  const matter={reference:`TEMP-${matterId.slice(0,8)}`,title:'TEMP API Matter',type:'CIVIL',status:'ACTIVE',authority:'TEMP Court',openedAt:'2026-09-30',details:{},parties:[{id:randomUUID(),matterId,clientId,displayName:client.displayName,role:'CLIENT',isPrimary:true}]};
  assert.equal(check(await admin.rpc('sync_matter',{p_operation:randomUUID(),p_office:fixture.officeA,p_id:matterId,p_base_revision:0,p_data:matter})),1);
  assert.equal(check(await lawyer.from('matters').select('id').eq('id',matterId)).length,0);
  assert.equal(check(await admin.rpc('sync_assignment',{p_operation:randomUUID(),p_office:fixture.officeA,p_id:matterId,p_base_revision:1,p_data:{userId:fixture.users[2],isPrimary:true}})),2);
  for(const api of [lawyer,employee]) {
    assert.equal(check(await api.from('matters').select('*').eq('id',matterId)).length,1);
    assert.equal(check(await api.from('clients').select('*').eq('id',clientId)).length,1);
    assert.equal(check(await api.from('matter_parties').select('*').eq('matter_id',matterId)).length,1);
    assert.equal(check(await api.from('matter_assignments').select('*').eq('matter_id',matterId)).length,1);
  }
  assert.equal(check(await reception.from('matters').select('id').eq('id',matterId)).length,0);
  assert.equal(check(await reception.from('clients').select('id').eq('id',clientId)).length,1);
  for(const api of [other,owner]) {
    assert.equal(check(await api.from('matters').select('id').eq('id',matterId)).length,0);
    assert.equal(check(await api.from('clients').select('id').eq('id',clientId)).length,0);
    const denied=await api.rpc('sync_client',{...args,p_operation:randomUUID(),p_base_revision:1});assert.equal(denied.error?.code,'42501');
  }
  const stale=await admin.rpc('sync_client',{...args,p_operation:randomUUID(),p_base_revision:0});assert.equal(stale.error?.code,'PT409',JSON.stringify({status:stale.status,error:stale.error,data:stale.data}));assert.equal(stale.status,409);
  console.log('PASS: real Auth sessions + HTTP clients/cases/parties/assignments + collaboration + role/tenant isolation + idempotency + conflict');
} finally { await Promise.allSettled(sessions.map(api=>api.auth.signOut({scope:'local'}))); }
