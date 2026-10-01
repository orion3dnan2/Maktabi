import type { Client, Matter } from '@maktabi/domain';
import { groupKey, SyncError, type AssignmentCommand, type Kind, type Operation, type OperationalStore, type SyncSummary, type SyncTransport } from './types';

/** Durable local-first writes; same entity commands replay in order with explicit conflicts. */
export class SyncEngine {
  private running?: Promise<void>;
  private listeners = new Set<() => void>();
  private state: SyncSummary = { pending: 0, failed: 0, conflicts: 0, offline: false, error: '' };
  private stopped = false;
  private revoked = false;
  constructor(readonly officeId: string, readonly store: OperationalStore, private cloud: SyncTransport, private uuid: () => string, private onRevoked?: () => Promise<void>) {}
  assertAccess() {
    if (this.stopped || this.revoked) throw new SyncError('forbidden', 'عضوية المكتب غير نشطة؛ سجل الدخول مجدداً');
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  summary = () => this.state;
  stop() { this.stopped = true; this.listeners.clear(); }
  private async publish() {
    if (this.stopped) return;
    const { operations } = await this.store.read();
    this.state = { ...this.state, pending: operations.filter(o => o.status === 'pending').length, failed: operations.filter(o => o.status === 'failed').length, conflicts: operations.filter(o => o.status === 'conflict').length };
    this.listeners.forEach(fn => fn());
  }
  async save(kind: Kind, payload: Client | Matter | AssignmentCommand, entityId: string) {
    if (this.stopped) throw new Error('Session ended');
    if (this.revoked) throw new SyncError('forbidden', 'عضوية المكتب غير نشطة؛ سجل الدخول مجدداً');
    if ('officeId' in payload && payload.officeId !== this.officeId) throw new SyncError('forbidden', 'المكتب غير صحيح');
    await this.store.transact(state => {
      const key = groupKey(kind, entityId);
      const before = state.operations.filter(o => groupKey(o.kind, o.entityId) === key);
      if (before.some(o => o.status !== 'pending')) throw new SyncError('conflict', 'عالج تعارض هذا السجل قبل تعديله');
      const collection = kind === 'client' ? state.clients : state.matters;
      const base = collection[entityId]?.revision ?? 0;
      const operation: Operation = { id: this.uuid(), kind, entityId, officeId: this.officeId, baseRevision: base + before.length, payload, status: 'pending', createdAt: new Date().toISOString() };
      if (kind === 'client') state.clients[entityId] = { value: payload as Client, revision: base, status: 'pending' };
      if (kind === 'matter') state.matters[entityId] = { value: payload as Matter, revision: base, status: 'pending' };
      if (kind === 'assignment') {
        if (!state.matters[entityId]) throw new SyncError('invalid', 'القضية غير موجودة');
        const command = payload as AssignmentCommand;
        const now = new Date().toISOString();
        state.assignments.forEach(a => { if (a.matterId === entityId && !a.endedAt && (a.userId === command.userId || (command.isPrimary && a.isPrimary))) a.endedAt = now; });
        if (!command.remove) state.assignments.push({ id: operation.id, matterId: entityId, userId: command.userId, isPrimary: command.isPrimary, assignedAt: now, endedAt: null });
        if (command.isPrimary && !command.remove) state.matters[entityId]!.value.assignedLawyerId = command.userId;
        else if (command.remove && state.matters[entityId]!.value.assignedLawyerId === command.userId) state.matters[entityId]!.value.assignedLawyerId = undefined;
        state.matters[entityId]!.status = 'pending';
      }
      state.operations.push(operation);
    });
    await this.publish();
    // The local commit is the save result. Server failure remains visible in the outbox.
    void this.sync().catch(() => undefined);
  }
  sync(): Promise<void> {
    if (this.stopped || this.revoked) return Promise.resolve();
    return this.running ??= this.perform().finally(() => { this.running = undefined; });
  }
  async importRecords(clients: Client[], matters: Matter[], source: string, links?: { clientIds: Record<string,string>; matterIds: Record<string,string> }) {
    if (this.stopped || this.revoked) throw new SyncError('forbidden', 'Session unavailable');
    if ([...clients, ...matters].some(r => r.officeId !== this.officeId)) throw new SyncError('forbidden', 'Wrong office');
    await this.store.transact(state => {
      if (links) {
        Object.entries(links.clientIds).forEach(([oldId,id]) => { state.legacyLinks.clients[id] = oldId; });
        Object.entries(links.matterIds).forEach(([oldId,id]) => { state.legacyLinks.matters[id] = oldId; });
      }
      for (const value of [...clients, ...matters]) {
        const kind = 'displayName' in value ? 'client' : 'matter';
        const collection = kind === 'client' ? state.clients : state.matters;
        if (collection[value.id]) continue;
        if (kind === 'client') state.clients[value.id] = { value: value as Client, revision: 0, status: 'pending' };
        else state.matters[value.id] = { value: value as Matter, revision: 0, status: 'pending' };
        state.operations.push({ id: this.uuid(), kind, entityId: value.id, officeId: this.officeId, baseRevision: 0, payload: value, source, status: 'pending', createdAt: new Date().toISOString() });
      }
    });
    await this.publish(); void this.sync().catch(() => undefined);
  }
  private async perform() {
    this.state = { ...this.state, offline: false, error: '' };
    try {
      const pending = (await this.store.read()).operations;
      const blocked = new Set(pending.filter(o => o.status !== 'pending').map(o => groupKey(o.kind, o.entityId)));
      // Creates of clients must precede dependent matters; same-entity order stays intact.
      const ordered = [...pending.filter(o => o.kind === 'client'), ...pending.filter(o => o.kind !== 'client')];
      for (const operation of ordered) {
        if (this.stopped) return;
        if (operation.status !== 'pending' || blocked.has(groupKey(operation.kind, operation.entityId))) continue;
        const local = await this.store.read();
        if (operation.kind === 'matter') {
          const clientIds = (operation.payload as Matter).parties.flatMap(p => p.clientId ? [p.clientId] : []);
          if (clientIds.some(id => local.operations.some(o => o.kind === 'client' && o.entityId === id))) { blocked.add(groupKey(operation.kind, operation.entityId)); continue; }
        }
        try {
          const revision = await this.cloud.push(operation);
          if (this.stopped) return;
          await this.store.transact(state => {
            state.operations = state.operations.filter(o => o.id !== operation.id);
            const record = operation.kind === 'client' ? state.clients[operation.entityId] : state.matters[operation.entityId];
            if (record) { record.revision = revision; record.status = state.operations.some(o => groupKey(o.kind, o.entityId) === groupKey(operation.kind, operation.entityId)) ? 'pending' : 'synced'; }
          });
        } catch (e) {
          if (!(e instanceof SyncError) || e.reason === 'offline') throw e;
          blocked.add(groupKey(operation.kind, operation.entityId));
          await this.store.transact(state => {
            const op = state.operations.find(o => o.id === operation.id);
            if (op) { op.status = e.reason === 'conflict' ? 'conflict' : 'failed'; op.error = e.message; }
            const record = operation.kind === 'client' ? state.clients[operation.entityId] : state.matters[operation.entityId];
            if (record) record.status = e.reason === 'conflict' ? 'conflict' : 'failed';
          });
        }
      }
      const snapshot = await this.cloud.pull();
      if (this.stopped) return;
      await this.store.transact(state => {
        const merge = <T extends Client | Matter>(kind: Kind, target: Record<string, { value: T; revision: number; status: 'synced' | 'pending' | 'conflict' | 'failed' }>, incoming: { value: T; revision: number; status: 'synced' | 'pending' | 'conflict' | 'failed' }[]) => {
          const dirty = new Set(state.operations.filter(o => groupKey(o.kind, o.entityId).startsWith(kind === 'client' ? 'client:' : 'matter:')).map(o => o.entityId));
          const visible = new Set(incoming.map(r => r.value.id));
          for (const id of Object.keys(target)) if (!dirty.has(id) && !visible.has(id)) delete target[id];
          incoming.forEach(record => { if (!dirty.has(record.value.id)) target[record.value.id] = record; });
        };
        merge('client', state.clients, snapshot.clients); merge('matter', state.matters, snapshot.matters);
        const dirtyCases = new Set(state.operations.filter(o => o.kind !== 'client').map(o => o.entityId));
        state.assignments = [...snapshot.assignments.filter(a => !dirtyCases.has(a.matterId)), ...state.assignments.filter(a => dirtyCases.has(a.matterId))];
        state.members = snapshot.members;
      });
    } catch (e) {
      if (e instanceof SyncError && e.reason === 'forbidden') {
        // Deny access immediately, but preserve encrypted drafts/outbox instead of destroying work.
        this.revoked = true; await this.onRevoked?.();
      }
      this.state = { ...this.state, offline: !(e instanceof SyncError) || e.reason === 'offline', error: e instanceof Error ? e.message : 'تعذرت المزامنة' };
    } finally { await this.publish(); }
  }
  async previewServerVersion(kind: Kind, id: string) {
    const snapshot = await this.cloud.pull();
    return { record: kind === 'client' ? snapshot.clients.find(r => r.value.id === id) : snapshot.matters.find(r => r.value.id === id), assignments: kind === 'client' ? [] : snapshot.assignments.filter(a => a.matterId === id) };
  }
  /** Explicitly discard pending edits for one entity and reload server data; UI confirmation is required. */
  async useServerVersion(kind: Kind, id: string, reviewedRevision?: number) {
    const snapshot = await this.cloud.pull(); // Never discard drafts while offline.
    const server = kind === 'client' ? snapshot.clients.find(r => r.value.id === id) : snapshot.matters.find(r => r.value.id === id);
    if (reviewedRevision !== undefined && (server?.revision ?? 0) !== reviewedRevision) throw new SyncError('conflict', 'تغيرت نسخة الخادم بعد المراجعة؛ افتحها مجدداً قبل التأكيد');
    if (this.stopped || this.revoked) throw new SyncError('forbidden', 'Session unavailable');
    await this.store.transact(state => {
      state.operations = state.operations.filter(o => groupKey(o.kind, o.entityId) !== groupKey(kind, id));
      if (kind === 'client') { delete state.clients[id]; const r = snapshot.clients.find(r => r.value.id === id); if (r) state.clients[id] = r; }
      else { delete state.matters[id]; const r = snapshot.matters.find(r => r.value.id === id); if (r) state.matters[id] = r; state.assignments = [...state.assignments.filter(a => a.matterId !== id), ...snapshot.assignments.filter(a => a.matterId === id)]; }
    });
    await this.publish();
  }
}
