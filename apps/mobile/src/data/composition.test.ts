import { describe, expect, it } from 'vitest';
import type { Matter } from '@maktabi/domain';
import { composeRepositories, mergeWorkflow } from './composition';
import { createLocalRepositories } from './localRepositories';
import type { ProcedureStage, ProcedureTemplate } from './office';
import type { SupabaseMatterRepository } from './supabase/matterRepository';
import type { ServerWorkflow, SupabaseWorkflowRepository } from './supabase/workflowRepository';
import { emptyWorkflow } from './workflow';
import { fakeMatterSource, fakeStageSource, serverMatter } from '../test/fakeMatters';

const serverWorkflow = (patch: Partial<ServerWorkflow> = {}): ServerWorkflow => ({ appointments: [], stages: [], deadlines: [], notes: [], activity: [], ...patch });

function setup(matters: Matter[], templates: ProcedureTemplate[] = []) {
  const calls: string[] = [];
  const source = fakeMatterSource(matters);
  const server = {
    getByMatter: async () => serverWorkflow({ activity: [{ title: 'جدولة موعد: جلسة', date: '2026-09-29T12:00:00Z' }], currentStage: 'قيد الدعوى' }),
    progress: async (ids: string[]) => new Map(ids.map((id) => [id, { nextEventAt: '2026-10-05T09:00:00Z' }])),
    listTemplates: async () => templates,
    appendProcedure: async (id: string, t: ProcedureTemplate) => { calls.push(`append:${id}:${t.id}`); },
    saveStage: async (id: string, s: ProcedureStage) => { calls.push(`saveStage:${id}:${s.id}`); },
    listRecentEvents: async (_limit: number, ids?: string[]) => (ids ?? []).map((id) => ({ id: '1', matterId: id, title: 'بدء مرحلة الإعلان', date: '2026-09-30T10:00:00Z' })),
    saveTemplate: async () => { calls.push('saveTemplate'); },
  } as unknown as SupabaseWorkflowRepository;
  const remoteMatters = {
    ...source.source,
    listByOffice: async () => matters,
    setStatus: async (id: string, status: string) => { calls.push(`setStatus:${id}:${status}`); },
  } as unknown as SupabaseMatterRepository;
  const data = new Map<string, string>();
  const device = createLocalRepositories({ async getItem(k) { return data.get(k) ?? null; }, async setItem(k, v) { data.set(k, v); } }, source.source, fakeStageSource());
  let unlocked = true;
  const composed = composeRepositories({ server, matters: remoteMatters, device: () => device, unlocked: () => unlocked });
  return { ...composed, device, calls, lock: () => { unlocked = false; } };
}

describe('repositories as the screens see them', () => {
  it('merges the server workflow with what is still on the device, newest activity first', () => {
    const merged = mergeWorkflow(
      serverWorkflow({ notes: [{ id: 'n', text: 'على الخادم', date: '2026-09-29T11:00:00Z' }], activity: [{ title: 'خادم', date: '2026-09-29T11:00:00Z' }] }),
      { ...emptyWorkflow(), agreedFees: 1000, notes: [{ id: 'old', text: 'قديمة على الجهاز', date: '2026-09-01T00:00:00Z' }], currentStage: 'قديم', activity: [{ title: 'جهاز', date: '2026-09-29T12:00:00Z' }] },
    );
    expect(merged).toMatchObject({ agreedFees: 1000, notes: [{ id: 'n' }], activity: [{ title: 'جهاز' }, { title: 'خادم' }] });
    expect(merged.currentStage).toBeUndefined();
  });
  it('adds server progress to matters without changing them', async () => {
    const r = setup([serverMatter('m1')]);
    expect(await r.matterRepository.listByOffice('ignored')).toMatchObject([{ id: 'm1', nextEventAt: '2026-10-05T09:00:00Z' }]);
  });
  it('appends only a procedure that fits the matter type, resolving built-in and office templates', async () => {
    const office: ProcedureTemplate = { id: 'office-path', name: 'مسار المكتب', types: ['CIVIL'], stages: [{ name: 'تسوية', authority: 'المكتب', requirements: [] }] };
    const r = setup([serverMatter('m1', 'CIVIL')], [office]);
    await expect(r.officeRepository.appendProcedure('m1', 'criminal')).rejects.toThrow('اختر مساراً مناسباً');
    await r.officeRepository.appendProcedure('m1', 'trial');
    await r.officeRepository.appendProcedure('m1', 'office-path');
    await expect(r.officeRepository.appendProcedure('missing', 'trial')).rejects.toThrow('القضية غير موجودة');
    expect(r.calls).toEqual(['append:m1:trial', 'append:m1:office-path']);
    expect((await r.officeRepository.listTemplates()).map((t) => t.id)).toContain('office-path');
    await expect(r.officeRepository.saveTemplate({ ...office, id: 'trial' })).rejects.toThrow('احفظ نسخة مخصصة');
  });
  it('lets a stage name only documents of the matter kept on this device', async () => {
    const r = setup([serverMatter('m1')]);
    const stage: ProcedureStage = { id: 's', name: 'قيد', authority: 'المحكمة', reference: '', date: '', status: 'PENDING', details: {}, requirements: [], documentIds: ['doc'], notes: '' };
    await expect(r.officeRepository.saveStage('m1', stage)).rejects.toThrow('اختر مستندات من القضية');
    await r.device.workflowRepository.addDocument('m1', { id: 'doc', title: 'العريضة', name: 'a.txt', mimeType: 'text/plain', dataUri: 'data:text/plain;base64,YQ==', date: '2026-09-29' });
    await r.officeRepository.saveStage('m1', stage);
    expect(r.calls).toEqual(['saveStage:m1:s']);
  });
  it('closes a matter on the server, where the database checks nothing is left open', async () => {
    const r = setup([serverMatter('m1')]);
    await r.workflowRepository.closeMatter('m1');
    expect(r.calls).toEqual(['setStatus:m1:CLOSED']);
  });
  it('needs the unlocked device for the device part, but not for server lists', async () => {
    const r = setup([serverMatter('m1')]);
    expect(await r.workflowRepository.getByMatter('m1')).toMatchObject({ currentStage: 'قيد الدعوى', activity: [{ title: 'جدولة موعد: جلسة' }] });
    r.lock();
    await expect(r.workflowRepository.getByMatter('m1')).rejects.toThrow('سجل الدخول');
    await expect(r.officeRepository.getSettings()).rejects.toThrow('سجل الدخول');
    expect(await r.matterRepository.listByOffice('ignored')).toHaveLength(1);
  });
  it('shows a client the server activity of their primary matters with the matter reference', async () => {
    const r = setup([serverMatter('m1', 'CIVIL', 'c1'), serverMatter('m2', 'CIVIL', 'c2')]);
    const profile = await r.profileRepository.getByClient('c1');
    expect(profile.activity).toEqual([{ title: 'REF-m1 · بدء مرحلة الإعلان', date: '2026-09-30T10:00:00Z' }]);
  });
});
