import { validDate, type Matter } from '@maktabi/domain';
import { builtinProcedures, expenseCategories, type CaseDeadline, type ExpenseEntry, type FeeInstallment, type OfficeData, type OfficeSettings, type ProcedureStage, type ProcedureTemplate, type TrustDeposit } from './office';
import { paidTotal, trustBalance, type MatterWorkflow, type WorkflowReceipt } from './workflow';
import { serviceRequirements, type ReadinessSubmission } from './readiness';

export interface OfficeContext {
  get(): OfficeData; set(data: OfficeData): void; id(): string;
  matter(id: string): Matter; read(id: string): MatterWorkflow; write(id: string): MatterWorkflow;
  commit(id: string, workflow: MatterWorkflow, action: string): void;
}
const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const positive = (n: number) => { if (!Number.isSafeInteger(n) || n <= 0) throw new Error('المبلغ يجب أن يكون موجباً وصحيحاً'); };
const date = (d: string) => { if (!validDate(d)) throw new Error('أدخل تاريخاً صحيحاً YYYY-MM-DD'); };
export function createOfficeOperations(c: OfficeContext) {
  const stageExists = (w: MatterWorkflow, id?: string) => { if (id && !w.stages.some((s) => s.id === id)) throw new Error('المرحلة غير موجودة'); };
  const documentExists = (w: MatterWorkflow, id?: string) => { if (id && !w.documents.some((d) => d.id === id)) throw new Error('المستند غير موجود في القضية'); };
  const nextNumber = (kind: string, year: string) => {
    const office = c.get(); const key = `${kind}:${year}`;
    office.counters[key] = (office.counters[key] ?? 0) + 1; c.set(office);
    return `${office.settings.receiptPrefix}-${year}-${String(office.counters[key]).padStart(5, '0')}`;
  };
  return {
    async listReadiness() { return copy(c.get().readiness ?? []); },
    async submitReadiness(value: ReadinessSubmission) {
      if (!Object.hasOwn(serviceRequirements, value.service) || !(value.notes.trim() || value.links.trim() || value.documents.length)) throw new Error('أضف المعلومات أو المستندات المطلوبة أولاً');
      if (value.documents.some((d) => !/^data:[\w.+/-]+;base64,[A-Za-z0-9+/]*={0,2}$/.test(d.dataUri) || d.dataUri.length > 1500000)) throw new Error('المرفق غير صالح أو حجمه كبير');
      const office = c.get(); office.readiness = [...(office.readiness ?? []).filter((s) => s.service !== value.service), { ...copy(value), submittedAt: new Date().toISOString() }]; c.set(office);
    },
    async getSettings() { return copy(c.get().settings); },
    async saveSettings(settings: OfficeSettings) {
      if (!settings.name.trim() || !/^[A-Za-z0-9_-]{1,12}$/.test(settings.receiptPrefix) || !Number.isSafeInteger(settings.trustLowBalance) || settings.trustLowBalance < 0) throw new Error('تحقق من اسم المكتب وبادئة الترقيم وحد الأمانة');
      const office = c.get(); office.settings = copy(settings); c.set(office);
    },
    async listTemplates() { return copy([...builtinProcedures, ...c.get().templates]); },
    async saveTemplate(template: ProcedureTemplate) {
      if (builtinProcedures.some((t) => t.id === template.id)) throw new Error('احفظ نسخة مخصصة من القالب الأساسي');
      if (!template.name.trim() || !template.types.length || !template.stages.length || template.stages.some((s) => !s.name.trim() || !s.authority.trim())) throw new Error('اسم القالب والنوع والمراحل وجهاتها مطلوبة');
      const office = c.get(); office.templates = [...office.templates.filter((t) => t.id !== template.id), copy(template)]; c.set(office);
    },
    async appendProcedure(id: string, templateId: string) {
      const w = c.write(id); const template = [...builtinProcedures, ...c.get().templates].find((t) => t.id === templateId);
      if (!template || !template.types.includes(c.matter(id).type)) throw new Error('اختر مساراً مناسباً لنوع القضية');
      if (w.stages.some((s) => s.status === 'ACTIVE' || s.status === 'PENDING')) throw new Error('أكمل المسار الحالي أو تجاوز مراحله قبل إضافة مسار جديد');
      w.stages.push(...template.stages.map((s) => ({ id: c.id(), name: s.name, authority: s.authority, reference: '', date: '', status: 'PENDING' as const, details: {}, requirements: s.requirements.map((title) => ({ title, done: false })), documentIds: [], notes: '' })));
      c.commit(id, w, `إضافة مسار: ${template.name}`);
    },
    async saveStage(id: string, value: ProcedureStage) {
      const w = c.write(id); const index = w.stages.findIndex((s) => s.id === value.id); const old = w.stages[index];
      if (!old || !value.name.trim() || !value.authority.trim()) throw new Error('المرحلة والجهة مطلوبتان');
      if (old.status === 'COMPLETED' || old.status === 'SKIPPED') throw new Error('المرحلة منتهية؛ أضف ملاحظة متابعة لحفظ أي تصحيح');
      if (value.date) date(value.date);
      if (value.nextAt && !Number.isFinite(Date.parse(value.nextAt))) throw new Error('الموعد التالي غير صحيح');
      if (value.documentIds.some((docId) => !w.documents.some((d) => d.id === docId))) throw new Error('اختر مستندات من القضية');
      w.stages[index] = { ...copy(value), status: old.status, completedAt: old.completedAt };
      const appointmentId = `stage-${value.id}`; const appointment = w.appointments.find((a) => a.id === appointmentId);
      if (value.nextAt) {
        const data = { id: appointmentId, title: `${value.name} · ${value.authority}`, startsAt: new Date(value.nextAt).toISOString(), stageId: value.id, status: 'SCHEDULED' as const, kind: 'COURT_SESSION' as const };
        if (appointment) Object.assign(appointment, data); else w.appointments.push(data);
      } else if (appointment?.status === 'SCHEDULED') appointment.status = 'CANCELLED';
      c.commit(id, w, `تحديث بيانات مرحلة: ${value.name}`);
    },
    async transitionStage(id: string, stageId: string, status: ProcedureStage['status'], reason = '') {
      const w = c.write(id); const index = w.stages.findIndex((s) => s.id === stageId); const stage = w.stages[index];
      if (!stage || !['ACTIVE', 'COMPLETED', 'SKIPPED'].includes(status)) throw new Error('المرحلة أو الحالة غير صحيحة');
      if (stage.status === 'COMPLETED' || stage.status === 'SKIPPED') throw new Error('لا يمكن تغيير مرحلة منتهية');
      if (status === 'ACTIVE' && (w.stages.slice(0, index).some((s) => s.status === 'PENDING' || s.status === 'ACTIVE') || w.stages.some((s) => s.status === 'ACTIVE'))) throw new Error('أنهِ المراحل السابقة أولاً');
      if (status === 'COMPLETED' && (stage.status !== 'ACTIVE' || !stage.reference.trim() || !stage.date || stage.requirements.some((r) => !r.done))) throw new Error('ابدأ المرحلة وأدخل رقمها وتاريخها وأكمل المستندات المطلوبة');
      if (status === 'SKIPPED' && !reason.trim()) throw new Error('سبب تجاوز المرحلة مطلوب');
      stage.status = status; if (status !== 'ACTIVE') stage.completedAt = new Date().toISOString();
      if (reason) stage.notes += `\nسبب التجاوز: ${reason}`;
      c.matter(id).currentStage = stage.name;
      c.commit(id, w, `${status === 'ACTIVE' ? 'بدء' : status === 'COMPLETED' ? 'إتمام' : 'تجاوز'} مرحلة ${stage.name}${reason ? `: ${reason}` : ''}`);
    },
    async addDeadline(id: string, deadline: Omit<CaseDeadline, 'id' | 'completed'>) {
      const w = c.write(id);
      if (!deadline.title.trim() || !deadline.source.trim() || !Number.isFinite(Date.parse(deadline.dueAt))) throw new Error('عنوان الموعد ومصدر تحديد المهلة والتاريخ مطلوبة');
      w.deadlines.push({ ...copy(deadline), id: c.id(), completed: false }); c.commit(id, w, `تسجيل مهلة: ${deadline.title}`);
    },
    async completeDeadline(id: string, deadlineId: string) {
      const w = c.write(id); const d = w.deadlines.find((d) => d.id === deadlineId); if (!d) throw new Error('المهلة غير موجودة');
      d.completed = true; c.commit(id, w, `إتمام المهلة: ${d.title}`);
    },
    async finishSession(id: string, appointmentId: string, outcome: string, nextAt?: string) {
      const w = c.write(id); const a = w.appointments.find((a) => a.id === appointmentId);
      if (!a || a.status !== 'SCHEDULED' || !outcome.trim()) throw new Error('اختر موعداً معلقاً واكتب نتيجة الجلسة');
      if (nextAt && (!Number.isFinite(Date.parse(nextAt)) || new Date(nextAt) <= new Date(a.startsAt))) throw new Error('الموعد التالي يجب أن يلي الجلسة');
      a.status = 'COMPLETED'; a.outcome = outcome.trim();
      if (nextAt) w.appointments.push({ id: c.id(), title: a.title, startsAt: new Date(nextAt).toISOString(), status: 'SCHEDULED' as const, kind: 'COURT_SESSION' as const, stageId: a.stageId });
      c.commit(id, w, `نتيجة جلسة ${a.title}: ${outcome}`);
    },
    async saveInstallments(id: string, items: FeeInstallment[]) {
      const w = c.write(id); if (!items.length) throw new Error('أضف بند أتعاب واحداً على الأقل');
      for (const item of items) { positive(item.amount); date(item.dueDate); stageExists(w, item.stageId); if (!item.title.trim()) throw new Error('وصف الأتعاب مطلوب'); }
      const total = items.reduce((n, i) => n + i.amount, 0); positive(total);
      if (total < paidTotal(w)) throw new Error('الاتفاق لا يمكن أن يقل عن المدفوع');
      w.installments = copy(items); w.agreedFees = total; c.commit(id, w, 'تحديث اتفاق الأتعاب وجدول الاستحقاق');
    },
    async issueReceipt(id: string, data: Omit<WorkflowReceipt, 'number'>) {
      const w = c.write(id); const existing = w.receipts.find((r) => r.id === data.id); if (existing) return copy(existing);
      positive(data.amount); if (data.amount > w.agreedFees - paidTotal(w)) throw new Error('الدفعة تتجاوز المتبقي');
      if (!data.id || !Number.isFinite(Date.parse(data.date)) || !data.method.trim() || !(data.receiver || c.get().settings.receiver).trim()) throw new Error('تاريخ الدفعة وطريقتها واسم المستلم مطلوبة');
      documentExists(w, data.proofId);
      if (data.replacesId && !w.receipts.some((r) => r.id === data.replacesId && r.status === 'CANCELLED')) throw new Error('الإيصال المستبدل يجب أن يكون ملغى');
      if (data.replacesId && w.receipts.some((r) => r.replacesId === data.replacesId && r.status !== 'CANCELLED')) throw new Error('يوجد بديل ساري لهذا الإيصال');
      const receipt: WorkflowReceipt = { ...copy(data), number: nextNumber('receipt', data.date.slice(0, 4)), status: 'ACTIVE', receiver: data.receiver || c.get().settings.receiver, balance: w.agreedFees - paidTotal(w) - data.amount, cancelledAt: undefined, cancellationReason: undefined };
      w.receipts.push(receipt); c.commit(id, w, `قبض أتعاب وإصدار ${receipt.number}`); return copy(receipt);
    },
    async cancelReceipt(id: string, receiptId: string, reason: string) {
      const w = c.write(id); const r = w.receipts.find((r) => r.id === receiptId);
      if (!r || r.status === 'CANCELLED' || !reason.trim()) throw new Error('اختر إيصالاً سارياً وأدخل سبب الإلغاء');
      r.status = 'CANCELLED'; r.cancelledAt = new Date().toISOString(); r.cancellationReason = reason.trim(); c.commit(id, w, `إلغاء إيصال ${r.number}: ${reason}`);
    },
    async depositTrust(id: string, deposit: TrustDeposit) {
      const w = c.write(id); if (w.deposits.some((d) => d.id === deposit.id)) return;
      positive(deposit.amount); date(deposit.date); if (!deposit.description.trim()) throw new Error('وصف الإيداع مطلوب');
      w.deposits.push(copy(deposit)); c.commit(id, w, 'إيداع أمانة العميل');
    },
    async recordExpense(id: string, expense: ExpenseEntry) {
      const w = c.write(id); if (w.expenses.some((e) => e.id === expense.id)) return;
      positive(expense.amount); date(expense.date); stageExists(w, expense.stageId); documentExists(w, expense.billId);
      if (!expenseCategories.includes(expense.category) || !expense.recipient.trim() || !['TRUST', 'RECEIVABLE'].includes(expense.source) || expense.voidReason) throw new Error('تحقق من نوع المصروف والجهة وطريقة الحساب');
      if (expense.source === 'TRUST' && expense.amount > trustBalance(w)) throw new Error('رصيد الأمانة لا يكفي');
      w.expenses.push(copy(expense)); c.commit(id, w, `مصروف ${expense.category} إلى ${expense.recipient}`);
    },
    async voidExpense(id: string, expenseId: string, reason: string) {
      const w = c.write(id); const e = w.expenses.find((e) => e.id === expenseId);
      if (!e || e.voidReason || !reason.trim()) throw new Error('اختر مصروفاً سارياً وأدخل سبب الإلغاء');
      e.voidReason = reason.trim(); c.commit(id, w, `إلغاء مصروف ${e.category}: ${reason}`);
    },
  };
}
