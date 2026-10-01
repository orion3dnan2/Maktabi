import { describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { operationalStore } from './store';
import type { Client } from '@maktabi/domain';

const sqlite = vi.hoisted(()=>({db:undefined as DatabaseSync | undefined}));
vi.mock('expo-sqlite',()=>({async openDatabaseAsync(){
  const db = new DatabaseSync(':memory:'); sqlite.db=db;
  const methods={
    async execAsync(sql:string){db.exec(sql);},
    async runAsync(sql:string,...params:(string|number)[]){return db.prepare(sql).run(...params);},
    async getAllAsync(sql:string,...params:(string|number)[]){return db.prepare(sql).all(...params);},
    async withExclusiveTransactionAsync(action:(tx:unknown)=>Promise<void>){db.exec('BEGIN');try{await action(methods);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}},
  };return methods;
}}));
vi.mock('expo-secure-store',()=>{const values=new Map<string,string>();return {async getItemAsync(key:string){return values.get(key)??null;},async setItemAsync(key:string,value:string){values.set(key,value);}};});
vi.mock('expo-crypto',()=>({async getRandomBytesAsync(size:number){return crypto.getRandomValues(new Uint8Array(size));}}));
const client:Client={id:'c',officeId:'office-a',displayName:'سجل قانوني حساس',kind:'PERSON',phone:'+249900000001',createdAt:'2026-09-30'};
describe('encrypted SQLite operational store',()=>{
  it('stores encrypted records, round-trips after reopening and separates tenant/user partitions',async()=>{
    const a=await operationalStore('user-a','office-a');
    await a.transact(state=>{state.clients.c={value:client,revision:1,status:'synced'};});
    expect((await a.read()).clients.c?.value.displayName).toBe(client.displayName);
    const rows=sqlite.db!.prepare('SELECT payload FROM operational_records').all();expect(JSON.stringify(rows)).not.toContain(client.displayName);expect(JSON.stringify(rows)).not.toContain(client.phone);
    const b=await operationalStore('user-b','office-a');const c=await operationalStore('user-a','office-b');expect((await b.read()).clients).toEqual({});expect((await c.read()).clients).toEqual({});
    expect((await (await operationalStore('user-a','office-a')).read()).clients.c?.value.displayName).toBe(client.displayName);
  });
  it('rolls back both record and queued operation when durable storage fails',async()=>{
    const store=await operationalStore('rollback-user','office-a');
    sqlite.db!.exec("CREATE TRIGGER reject_test_write BEFORE INSERT ON operational_records WHEN NEW.scope='office-a:rollback-user' BEGIN SELECT RAISE(ABORT,'disk write failure'); END;");
    await expect(store.transact(state=>{state.clients.c={value:client,revision:0,status:'pending'};state.operations.push({id:'op',kind:'client',entityId:'c',officeId:'office-a',baseRevision:0,payload:client,status:'pending',createdAt:'now'});})).rejects.toThrow('disk write failure');
    expect((await store.read()).clients).toEqual({});expect((await store.read()).operations).toEqual([]);
    sqlite.db!.exec('DROP TRIGGER reject_test_write');
  });
});
