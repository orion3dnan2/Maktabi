import type { Matter, MatterType } from '@maktabi/domain';
import type { MatterSource, StageSource } from '../data/localStore';

/** A matter as the server would return it (the primary client comes from matters.client_id). */
export const serverMatter = (id: string, type: MatterType = 'CIVIL', clientId = 'client-1'): Matter => ({
  id, officeId: 'office-test', reference: `REF-${id}`, title: `قضية ${id}`, type, status: 'ACTIVE', openedAt: '2026-09-01',
  authority: 'جهة اختبار', details: {},
  parties: [{ id: `primary:${id}`, matterId: id, clientId, displayName: 'عميل اختبار', role: 'CLIENT', isPrimary: true }],
});

/** Stand-in for the Supabase matter repository: an in-memory set of the matters the user can see. */
export function fakeMatterSource(matters: Matter[]) {
  const rows = new Map(matters.map((m) => [m.id, structuredClone(m)]));
  const calls: string[] = [];
  const source: MatterSource = {
    async getById(id) { calls.push(`getById:${id}`); const m = rows.get(id); return m ? structuredClone(m) : null; },
    async listByClient(clientId) { calls.push(`listByClient:${clientId}`); return [...rows.values()].filter((m) => m.parties.some((p) => p.clientId === clientId)).map((m) => structuredClone(m)); },
  };
  return { source, rows, calls };
}

/** Stand-in for the server's procedure stages: the stage ids of each matter. */
export function fakeStageSource(stages: Record<string, string[]> = {}): StageSource {
  return { async stageIds(matterId) { return stages[matterId] ?? []; } };
}
