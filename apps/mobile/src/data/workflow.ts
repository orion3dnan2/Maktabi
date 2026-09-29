import { normalizeArabic, validDate } from '@maktabi/domain';
import type { CaseDeadline, ExpenseEntry, FeeInstallment, ProcedureStage, TrustDeposit } from './office';

export interface Appointment { id: string; title: string; startsAt: string; status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'; stageId?: string; outcome?: string }
export interface Attachment { id: string; title: string; date: string; name: string; mimeType: string; dataUri: string; text?: string; stageId?: string }
export interface WorkflowReceipt { id: string; number: string; amount: number; date: string; method: string; receiver?: string; balance?: number; proofId?: string; status?: 'ACTIVE' | 'CANCELLED'; cancellationReason?: string; cancelledAt?: string; replacesId?: string }
export interface MatterWorkflow {
  agreedFees: number;
  receipts: WorkflowReceipt[];
  documents: Attachment[];
  appointments: Appointment[];
  notes: { id: string; text: string; date: string }[];
  activity: { title: string; date: string }[];
  stages: ProcedureStage[];
  deadlines: CaseDeadline[];
  installments: FeeInstallment[];
  expenses: ExpenseEntry[];
  deposits: TrustDeposit[];
  /** The procedure stage last started or finished (or the latest note while no procedure is set). */
  currentStage?: string;
}
export const emptyWorkflow = (): MatterWorkflow => ({ agreedFees: 0, receipts: [], documents: [], appointments: [], notes: [], activity: [], stages: [], deadlines: [], installments: [], expenses: [], deposits: [] });
export const paidTotal = (w: MatterWorkflow) => w.receipts.reduce((sum, r) => sum + (r.status === 'CANCELLED' ? 0 : r.amount), 0);
export const trustBalance = (w: MatterWorkflow) => w.deposits.reduce((n, d) => n + d.amount, 0) - w.expenses.reduce((n, e) => n + (!e.voidReason && e.source === 'TRUST' ? e.amount : 0), 0);
export const outstandingExpenses = (w: MatterWorkflow) => w.expenses.reduce((n, e) => n + (!e.voidReason && e.source === 'RECEIVABLE' ? e.amount : 0), 0);
export function parseAmount(value: string): number {
  const normalized = normalizeArabic(value).replace(/٬|,/g, '').replace(/٫/g, '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error('أدخل مبلغاً صحيحاً بمنزلتين عشريتين كحد أقصى');
  const [whole, fraction = ''] = normalized.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر');
  return amount;
}
/** User-entered dates/times are local office/device time, stored as ISO instants. */
export function appointmentISO(date: string, time: string): string {
  if (!validDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('أدخل تاريخاً صحيحاً ووقتاً بصيغة HH:mm');
  return new Date(`${date}T${time}:00`).toISOString();
}
export const workflowStages = (w: MatterWorkflow) => [
  { label: 'الموعد الأول', done: w.appointments.length > 0 },
  { label: 'المستندات', done: w.documents.length > 0 },
  { label: 'اتفاق الأتعاب', done: w.agreedFees > 0 },
  { label: 'الدفعة والإيصال', done: w.receipts.length > 0 },
  { label: 'ملاحظات المتابعة', done: w.notes.length > 0 },
];
export interface WorkflowRepository {
  getByMatter(id: string): Promise<MatterWorkflow>;
  addAppointment(id: string, item: Omit<Appointment, 'id' | 'status'>): Promise<void>;
  setAppointmentStatus(id: string, appointmentId: string, status: Appointment['status']): Promise<void>;
  setFees(id: string, amount: number): Promise<void>;
  recordPayment(id: string, receipt: WorkflowReceipt): Promise<void>;
  addDocument(id: string, document: Attachment): Promise<void>;
  addNote(id: string, text: string): Promise<void>;
  closeMatter(id: string): Promise<void>;
}
