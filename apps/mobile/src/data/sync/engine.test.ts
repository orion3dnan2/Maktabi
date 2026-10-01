import { describe, expect, it } from 'vitest';
import type { Client, Matter } from '@maktabi/domain';
import { SyncEngine } from './engine';
import { emptyState, SyncError, type CloudSnapshot, type OperationalStore, type Operation, type SyncTransport } from './types';

function memoryStore():OperationalStore {
  let state=emptyState();
  return { async read(){return structuredClone(state);}, async transact(action){const draft=structuredClone(state);const result=action(draft);state=draft;return result;},async clear(){state=emptyState();} };
}
const client = (id='c1'):Client=>({id,officeId:'o1',displayName:'عميل حقيقي',kind:'PERSON',phone:'+249900000001',whatsapp:'+249900000001',createdAt:'2026-09-30T00:00:00Z'});
const matter = ():Matter=>({id:'m1',officeId:'o1',reference:'001',title:'قضية',type:'CIVIL',status:'ACTIVE',authority:'محكمة',openedAt:'2026-09-30',details:{},parties:[{id:'p1',matterId:'m1',clientId:'c1',displayName:'عميل حقيقي',role:'CLIENT',isPrimary:true}]});
function cloud() {
  const snapshot:CloudSnapshot={clients:[],matters:[],assignments:[],members:[]}; const receipts=new Map<string,number>(); const calls:Operation[]=[];
  let offline=true; let dropAfterCommit=false;
  const transport:SyncTransport={
    async push(op){
      if(offline) throw new SyncError('offline','offline'); calls.push(structuredClone(op));
      if(receipts.has(op.id)) return receipts.get(op.id)!;
      const collection=op.kind==='client'?snapshot.clients:snapshot.matters;
      const existing=collection.find(r=>r.value.id===op.entityId);
      if((existing?.revision??0)!==op.baseRevision) throw new SyncError('conflict','stale revision');
      const revision=(existing?.revision??0)+1;
      if(op.kind==='client'){snapshot.clients=snapshot.clients.filter(r=>r.value.id!==op.entityId);snapshot.clients.push({value:op.payload as Client,revision,status:'synced'});}
      if(op.kind==='matter'){snapshot.matters=snapshot.matters.filter(r=>r.value.id!==op.entityId);snapshot.matters.push({value:op.payload as Matter,revision,status:'synced'});}
      if(op.kind==='assignment' && existing) existing.revision=revision;
      receipts.set(op.id,revision);
      if(dropAfterCommit){dropAfterCommit=false;throw new SyncError('offline','response lost');}
      return revision;
    },async pull(){if(offline)throw new SyncError('offline','offline');return structuredClone(snapshot);},
  };
  return {transport,snapshot,calls,setOnline(){offline=false;},dropResponse(){dropAfterCommit=true;}};
}
function setup(){const store=memoryStore();const remote=cloud();let sequence=0;const engine=new SyncEngine('o1',store,remote.transport,()=>`op-${++sequence}`);return {store,remote,engine};}
describe('offline office collaboration sync',()=>{
  it('persists an offline create and outbox before returning, without demo records',async()=>{
    const {engine,store}=setup();expect(await store.read()).toEqual(emptyState());
    await engine.save('client',client(),'c1');await engine.sync();
    const state=await store.read();expect(state.clients.c1?.value.displayName).toBe('عميل حقيقي');expect(state.operations).toHaveLength(1);expect(engine.summary().offline).toBe(true);
  });
  it('replays client then case then assignment from offline storage',async()=>{
    const {engine,store,remote}=setup();await engine.save('client',client(),'c1');await engine.sync();await engine.save('matter',matter(),'m1');await engine.sync();await engine.save('assignment',{userId:'lawyer',isPrimary:true},'m1');await engine.sync();
    expect((await store.read()).matters.m1?.value.assignedLawyerId).toBe('lawyer');
    remote.setOnline();await engine.sync();expect(remote.calls.map(o=>o.kind)).toEqual(['client','matter','assignment']);expect((await store.read()).operations).toHaveLength(0);expect(remote.snapshot.matters[0]?.revision).toBe(2);
  });
  it('retains operation ID after a server commit whose response was lost',async()=>{
    const {engine,store,remote}=setup();await engine.save('client',client(),'c1');await engine.sync();remote.setOnline();remote.dropResponse();await engine.sync();expect((await store.read()).operations).toHaveLength(1);
    await engine.sync();expect(remote.snapshot.clients).toHaveLength(1);expect(remote.snapshot.clients[0]?.revision).toBe(1);expect(remote.calls[0]?.id).toBe(remote.calls[1]?.id);
  });
  it('detects a second device edit, retains the local draft and blocks successor writes',async()=>{
    const {engine,store,remote}=setup();remote.setOnline();remote.snapshot.clients=[{value:client(),revision:1,status:'synced'}];await engine.sync();
    // Persist two edits while offline using a separate engine over the same durable state.
    const offline:SyncTransport={async push(){throw new SyncError('offline','offline');},async pull(){throw new SyncError('offline','offline');}};
    let n=0;const second=new SyncEngine('o1',store,offline,()=>`edit-${++n}`);await second.save('client',{...client(),displayName:'مسوّدة محلية'},'c1');await second.sync();await second.save('client',{...client(),displayName:'مسوّدة أحدث'},'c1');await second.sync();
    remote.snapshot.clients[0]={value:{...client(),displayName:'تعديل الجهاز الآخر'},revision:2,status:'synced'};await engine.sync();
    const state=await store.read();expect(state.clients.c1?.value.displayName).toBe('مسوّدة أحدث');expect(state.operations[0]?.status).toBe('conflict');expect(state.operations[1]?.status).toBe('pending');expect(remote.snapshot.clients[0]?.value.displayName).toBe('تعديل الجهاز الآخر');
    await expect(engine.save('client',client(),'c1')).rejects.toThrow('تعارض');
  });
  it('requires an online server read before discarding conflicts',async()=>{
    const {engine,store}=setup();await engine.save('client',client(),'c1');await engine.sync();await expect(engine.useServerVersion('client','c1')).rejects.toThrow('offline');expect((await store.read()).operations).toHaveLength(1);
  });
  it('previews server data without discarding a draft and detects changes after review',async()=>{
    const {engine,store,remote}=setup();await engine.save('client',client(),'c1');await engine.sync();remote.setOnline();
    remote.snapshot.clients=[{value:{...client(),displayName:'نسخة الخادم'},revision:2,status:'synced'}];
    const preview=await engine.previewServerVersion('client','c1');expect(preview.record?.revision).toBe(2);expect((await store.read()).operations).toHaveLength(1);
    remote.snapshot.clients[0]!.revision=3;
    await expect(engine.useServerVersion('client','c1',2)).rejects.toThrow('تغيرت');expect((await store.read()).operations).toHaveLength(1);
    await engine.useServerVersion('client','c1',3);expect((await store.read()).clients.c1?.value.displayName).toBe('نسخة الخادم');expect((await store.read()).operations).toHaveLength(0);
  });
  it('keeps a failed client from allowing its dependent case to sync',async()=>{
    const {engine,store}=setup();await engine.save('client',client(),'c1');await engine.sync();await engine.save('matter',matter(),'m1');await engine.sync();let pushedMatter=false;
    const failed=new SyncEngine('o1',store,{async push(op){if(op.kind==='matter')pushedMatter=true;throw new SyncError('invalid','duplicate client');},async pull(){return {clients:[],matters:[],assignments:[],members:[]};}},()=> 'unused');
    await failed.sync();expect(pushedMatter).toBe(false);expect((await store.read()).operations[0]?.status).toBe('failed');
  });
  it('removes formerly authorized server records when a pull excludes them',async()=>{
    const {engine,store,remote}=setup();remote.setOnline();remote.snapshot.clients=[{value:client(),revision:1,status:'synced'}];await engine.sync();remote.snapshot.clients=[];await engine.sync();expect((await store.read()).clients).toEqual({});
  });
  it('locks explicitly denied membership without deleting encrypted drafts and invalidates the offline lease',async()=>{
    const {store,engine:draftEngine}=setup();await draftEngine.save('client',client(),'c1');await draftEngine.sync();draftEngine.stop();
    let invalidated=false;
    const engine=new SyncEngine('o1',store,{async push(){throw new SyncError('forbidden','membership suspended');},async pull(){throw new SyncError('forbidden','membership suspended');}},()=> 'x',async()=>{invalidated=true;});
    await engine.sync();expect(()=>engine.assertAccess()).toThrow('عضوية');expect(invalidated).toBe(true);
    const state=await store.read();expect(state.clients.c1?.value.displayName).toBe('عميل حقيقي');expect(state.operations).toHaveLength(1);expect(engine.summary().offline).toBe(false);
  });
  it('rejects a tenant-forged local record before enqueueing',async()=>{
    const {engine,store}=setup();await expect(engine.save('client',{...client(),officeId:'o2'},'c1')).rejects.toThrow('المكتب');expect((await store.read()).operations).toHaveLength(0);
  });
  it('maintains sequential base revisions for repeated offline edits',async()=>{
    const {engine,remote}=setup();await engine.save('client',client(),'c1');await engine.sync();await engine.save('client',{...client(),displayName:'تعديل'},'c1');await engine.sync();remote.setOnline();await engine.sync();expect(remote.calls.map(o=>o.baseRevision)).toEqual([0,1]);expect(remote.snapshot.clients[0]?.value.displayName).toBe('تعديل');
  });
  it('keeps stores of different sessions isolated',async()=>{
    const a=setup();const b=setup();await a.engine.save('client',client(),'c1');await a.engine.sync();expect((await b.store.read()).clients).toEqual({});
  });
  it('stops a signed-out engine from mutating local data',async()=>{
    const {engine,store}=setup();engine.stop();await expect(engine.save('client',client(),'c1')).rejects.toThrow('Session ended');expect((await store.read()).clients).toEqual({});
  });
});
