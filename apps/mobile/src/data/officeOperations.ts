import { normalizePhone, validDate, type Matter } from '@maktabi/domain';
import { expenseCategories, type ExpenseEntry, type FeeInstallment, type OfficeData, type OfficeSettings, type TrustDeposit } from './office';
import { paidTotal, trustBalance, type MatterWorkflow, type WorkflowReceipt } from './workflow';
import { serviceRequirements, type ReadinessSubmission } from './readiness';

export interface OfficeContext {
  get(): OfficeData; set(data: OfficeData): void; id(): string;
  matter(id: string): Matter; read(id: string): MatterWorkflow; write(id: string): MatterWorkflow;
  commit(id: string, workflow: MatterWorkflow, action: string): void;
  /** Ids of the matter's procedure stages (kept on the server). */
  stageIds(id: string): Promise<string[]>;
}
const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const positive = (n: number) => { if (!Number.isSafeInteger(n) || n <= 0) throw new Error('المبلغ يجب أن يكون موجباً وصحيحاً'); };
const date = (d: string) => { if (!validDate(d)) throw new Error('أدخل تاريخاً صحيحاً YYYY-MM-DD'); };
export function createOfficeOperations(c: OfficeContext) {
  const stageExists = async (matterId: string, id?: string) => { if (id && !(await c.stageIds(matterId)).includes(id)) throw new Error('المرحلة غير موجودة'); };
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
      const phone = settings.phone.trim() ? normalizePhone(settings.phone) : '';
      if (phone === null) throw new Error('هاتف المكتب يجب أن يكون رقم هاتف سودانياً صحيحاً');
      const office = c.get(); office.settings = { ...copy(settings), phone }; c.set(office);
    },
    async saveInstallments(id: string, items: FeeInstallment[]) {
      const w = c.write(id); if (!items.length) throw new Error('أضف بند أتعاب واحداً على الأقل');
      for (const item of items) { positive(item.amount); date(item.dueDate); await stageExists(id, item.stageId); if (!item.title.trim()) throw new Error('وصف الأتعاب مطلوب'); }
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
      positive(expense.amount); date(expense.date); await stageExists(id, expense.stageId); documentExists(w, expense.billId);
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
