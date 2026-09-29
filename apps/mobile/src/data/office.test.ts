import { describe, expect, it } from 'vitest';
import { createLocalRepositories } from './localRepositories';
import { paidTotal, trustBalance } from './workflow';
import { fakeMatterSource, serverMatter } from '../test/fakeMatters';

function fixture() {
  let saved: string | null = null; let fail = false;
  const storage = { async getItem() { return saved; }, async setItem(_key: string, value: string) { if (fail) throw new Error('storage full'); saved = value; } };
  const server = fakeMatterSource([serverMatter('m1', 'CIVIL'), serverMatter('m2', 'LABOUR'), serverMatter('m3', 'CRIMINAL'), serverMatter('m5', 'SPECIAL_COURT'), serverMatter('m6', 'COMMERCIAL_REGISTRY')]);
  return { server, r: createLocalRepositories(storage, server.source), reload: () => createLocalRepositories(storage, server.source), fail: (v: boolean) => { fail = v; } };
}
const payment = (id: string, amount: number) => ({ id, amount, date: '2026-09-27T10:00:00Z', method: 'بنكك', receiver: 'المحاسب' });
describe('office procedures and accounting', () => {
  it('retains authority numbers through stages and synchronizes the calendar appointment', async () => {
    const { r, reload, server } = fixture(); await r.officeRepository.appendProcedure('m3', 'criminal');
    let w = await r.workflowRepository.getByMatter('m3'); const first = w.stages[0]!;
    await expect(r.officeRepository.transitionStage('m3', w.stages[1]!.id, 'ACTIVE')).rejects.toThrow();
    await r.officeRepository.transitionStage('m3', first.id, 'ACTIVE');
    await expect(r.officeRepository.transitionStage('m3', first.id, 'COMPLETED')).rejects.toThrow();
    await r.officeRepository.saveStage('m3', { ...first, reference: 'POL-15', date: '2026-09-27', nextAt: '2026-09-29T09:00:00Z', details: { officer: 'ضابط اختبار' } });
    await r.officeRepository.transitionStage('m3', first.id, 'COMPLETED');
    await r.officeRepository.transitionStage('m3', w.stages[1]!.id, 'ACTIVE');
    w = await reload().workflowRepository.getByMatter('m3');
    expect(w.stages[0]).toMatchObject({ reference: 'POL-15', status: 'COMPLETED', details: { officer: 'ضابط اختبار' } });
    expect(w.appointments.find((a) => a.stageId === first.id)?.startsAt).toBe('2026-09-29T09:00:00.000Z');
    expect((await r.progress([server.rows.get('m3')!]))[0]).toMatchObject({ nextEventAt: '2026-09-29T09:00:00.000Z', currentStage: w.stages[1]!.name });
  });
  it('requires a skip reason and refuses concurrent procedure replacement', async () => {
    const { r } = fixture(); await r.officeRepository.appendProcedure('m1', 'trial'); const w = await r.workflowRepository.getByMatter('m1');
    await expect(r.officeRepository.appendProcedure('m1', 'appeal')).rejects.toThrow();
    await expect(r.officeRepository.transitionStage('m1', w.stages[0]!.id, 'SKIPPED')).rejects.toThrow();
    await r.officeRepository.transitionStage('m1', w.stages[0]!.id, 'SKIPPED', 'إجراء سابق موثق');
    expect((await r.workflowRepository.getByMatter('m1')).stages[0]?.notes).toContain('إجراء سابق موثق');
  });
  it('requires the transaction checklist before completing a registry stage', async () => {
    const { r } = fixture(); await r.officeRepository.appendProcedure('m6', 'commercial'); const stage = (await r.workflowRepository.getByMatter('m6')).stages[0]!;
    await r.officeRepository.transitionStage('m6', stage.id, 'ACTIVE'); await r.officeRepository.saveStage('m6', { ...stage, reference: 'REG-1', date: '2026-09-27' });
    await expect(r.officeRepository.transitionStage('m6', stage.id, 'COMPLETED')).rejects.toThrow();
    await r.officeRepository.saveStage('m6', { ...stage, reference: 'REG-1', date: '2026-09-27', requirements: stage.requirements.map((r) => ({ ...r, done: true })) });
    await r.officeRepository.transitionStage('m6', stage.id, 'COMPLETED');
  });
  it('records session outcome and the following session atomically', async () => {
    const { r } = fixture(); await r.workflowRepository.addAppointment('m1', { title: 'جلسة القضية', startsAt: '2026-10-01T09:00:00Z' });
    const appointment = (await r.workflowRepository.getByMatter('m1')).appointments[0]!;
    await expect(r.officeRepository.finishSession('m1', appointment.id, 'تم التأجيل', '2026-09-01T09:00:00Z')).rejects.toThrow();
    expect((await r.workflowRepository.getByMatter('m1')).appointments[0]?.status).toBe('SCHEDULED');
    await r.officeRepository.finishSession('m1', appointment.id, 'تم سماع الشاهد', '2026-11-01T09:00:00Z');
    const w = await r.workflowRepository.getByMatter('m1'); expect(w.appointments).toHaveLength(2); expect(w.appointments[0]?.outcome).toBe('تم سماع الشاهد');
  });
  it('keeps manually reviewed deadlines separate from sessions', async () => {
    const { r } = fixture(); await r.officeRepository.addDeadline('m5', { title: 'مهلة مراجعة', source: 'قاعدة معتمدة من المكتب', dueAt: '2026-10-20T20:59:00Z' });
    await expect(r.workflowRepository.closeMatter('m5')).rejects.toThrow();
    const d = (await r.workflowRepository.getByMatter('m5')).deadlines[0]!; await r.officeRepository.completeDeadline('m5', d.id); await r.workflowRepository.closeMatter('m5');
  });
  it('numbers receipts across cases, keeps cancellation numbers and supports replacement', async () => {
    const { r, reload } = fixture(); await r.workflowRepository.setFees('m1', 100000); await r.workflowRepository.setFees('m2', 100000);
    const a = await r.officeRepository.issueReceipt('m1', payment('a', 40000)); const b = await r.officeRepository.issueReceipt('m2', payment('b', 30000));
    expect(a.number).toBe('RC-2026-00001'); expect(b.number).toBe('RC-2026-00002');
    await r.officeRepository.cancelReceipt('m1', a.id, 'تصحيح طريقة الدفع');
    const replacement = await reload().officeRepository.issueReceipt('m1', { ...payment('c', 40000), replacesId: a.id });
    expect(replacement.number).toBe('RC-2026-00003');
    const w = await reload().workflowRepository.getByMatter('m1'); expect(w.receipts).toHaveLength(2); expect(w.receipts[0]?.status).toBe('CANCELLED'); expect(paidTotal(w)).toBe(40000);
  });
  it('does not consume receipt numbers when disk persistence fails or retries repeat', async () => {
    const { r, fail } = fixture(); await r.workflowRepository.setFees('m1', 100000); fail(true);
    await expect(r.officeRepository.issueReceipt('m1', payment('a', 40000))).rejects.toThrow(); fail(false);
    const a = await r.officeRepository.issueReceipt('m1', payment('a', 40000)); const retry = await r.officeRepository.issueReceipt('m1', payment('a', 40000));
    expect(a.number).toBe('RC-2026-00001'); expect(retry.number).toBe(a.number); expect((await r.workflowRepository.getByMatter('m1')).receipts).toHaveLength(1);
  });
  it('separates fees from client trust, rejects overdrafts and preserves reversed expense', async () => {
    const { r, reload } = fixture(); await r.officeRepository.depositTrust('m1', { id: 'dep', date: '2026-09-27', amount: 50000, description: 'أمانة للرسوم' });
    const expense = { id: 'expense', date: '2026-09-27', amount: 20000, category: 'رسوم محكمة', recipient: 'المحكمة', source: 'TRUST' as const };
    await r.officeRepository.recordExpense('m1', expense);
    await expect(r.officeRepository.recordExpense('m1', { ...expense, id: 'excess', amount: 30001 })).rejects.toThrow();
    let w = await reload().workflowRepository.getByMatter('m1'); expect(trustBalance(w)).toBe(30000); expect(paidTotal(w)).toBe(0);
    await r.officeRepository.voidExpense('m1', 'expense', 'تصحيح'); w = await reload().workflowRepository.getByMatter('m1'); expect(trustBalance(w)).toBe(50000); expect(w.expenses).toHaveLength(1);
  });
  it('saves fee installments and refuses reducing total below paid', async () => {
    const { r } = fixture(); await r.officeRepository.saveInstallments('m1', [{ id: 'f1', title: 'البدء', amount: 20000, dueDate: '2026-09-20' }, { id: 'f2', title: 'الحكم', amount: 50000, dueDate: '2026-12-01' }]);
    await r.officeRepository.issueReceipt('m1', payment('a', 30000));
    await expect(r.officeRepository.saveInstallments('m1', [{ id: 'f1', title: 'البدء', amount: 20000, dueDate: '2026-09-20' }])).rejects.toThrow();
    expect((await r.workflowRepository.getByMatter('m1')).agreedFees).toBe(70000);
  });
  it('refuses procedures that do not fit the server-side matter type', async () => {
    const { r } = fixture(); await expect(r.officeRepository.appendProcedure('m6', 'criminal')).rejects.toThrow('اختر مساراً مناسباً');
  });
  it('keeps the office phone Sudanese and in one format', async () => {
    const { r } = fixture(); const settings = await r.officeRepository.getSettings();
    await expect(r.officeRepository.saveSettings({ ...settings, phone: '+965 5132 5559' })).rejects.toThrow('سودانياً');
    await r.officeRepository.saveSettings({ ...settings, phone: '٠٩١٢ ٣٤٥ ٦٧٨' });
    expect((await r.officeRepository.getSettings()).phone).toBe('+249912345678');
    await r.officeRepository.saveSettings({ ...settings, phone: '' });
    expect((await r.officeRepository.getSettings()).phone).toBe('');
  });
  it('stores office prerequisites without falsely marking external services active', async () => {
    const { r, reload } = fixture(); await r.officeRepository.submitReadiness({ service: 'library', notes: 'مصادر للمراجعة', links: 'https://example.test/laws', documents: [], submittedAt: '' });
    const list = await reload().officeRepository.listReadiness(); expect(list[0]?.service).toBe('library'); expect(list[0]).not.toHaveProperty('active');
  });
});
