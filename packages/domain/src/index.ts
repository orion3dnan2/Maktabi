import type { CurrencyCode, EntityId, ISODate, ISODateTime } from '@maktabi/types';
export type { CurrencyCode, EntityId, ISODate, ISODateTime } from '@maktabi/types';
export type UserRole = 'OWNER' | 'LAWYER' | 'ASSISTANT' | 'ACCOUNTANT' | 'VIEWER';

export interface Office { id: EntityId; name: string; legalName?: string; phone?: string; address?: string; defaultCurrency: CurrencyCode; }
export interface User { id: EntityId; officeId: EntityId; fullName: string; role: UserRole; email?: string; isActive: boolean; }
export interface Client { id: EntityId; officeId: EntityId; displayName: string; kind: 'PERSON' | 'ORGANIZATION'; phone: string; whatsapp?: string; contactPerson?: string; registration?: string; address?: string; notes?: string; email?: string; nationalId?: string; createdAt: ISODateTime; }

export type MatterType = 'CRIMINAL' | 'CIVIL' | 'PERSONAL_STATUS' | 'LABOUR' | 'SPECIAL_COURT' | 'COMMERCIAL_REGISTRY' | 'LAND_REGISTRY' | 'NOTARIZATION' | 'OTHER';
export type MatterStatus = 'ACTIVE' | 'ON_HOLD' | 'CLOSED' | 'ARCHIVED';
export interface Matter { id: EntityId; officeId: EntityId; reference: string; title: string; type: MatterType; parties: MatterParty[]; authority?: string; status: MatterStatus; workflowId?: EntityId; openedAt: ISODate; nextEventAt?: ISODateTime; currentStage?: string; notes?: string; details: Record<string, string>; }
export interface MatterParty { id: EntityId; matterId: EntityId; clientId?: EntityId; displayName: string; role: 'CLIENT' | 'OPPONENT' | 'WITNESS' | 'OTHER'; isPrimary: boolean; }

export interface Workflow { id: EntityId; matterId: EntityId; name: string; currentStageId: EntityId; stages: WorkflowStage[]; }
export interface WorkflowStage { id: EntityId; workflowId: EntityId; name: string; order: number; status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'SKIPPED'; startedAt?: ISODateTime; completedAt?: ISODateTime; }
export interface Session { id: EntityId; matterId: EntityId; title: string; authority: string; room?: string; startsAt: ISODateTime; status: 'SCHEDULED' | 'COMPLETED' | 'ADJOURNED' | 'CANCELLED'; }
export interface Deadline { id: EntityId; matterId: EntityId; title: string; dueAt: ISODateTime; priority: 'NORMAL' | 'URGENT'; status: 'OPEN' | 'COMPLETED' | 'CANCELLED'; source: 'USER_ENTERED' | 'CONFIGURED_RULE'; }
export interface LegalDocument { id: EntityId; officeId: EntityId; title: string; kind: 'PLEADING' | 'EVIDENCE' | 'CONTRACT' | 'CORRESPONDENCE' | 'OTHER'; matterId?: EntityId; clientId?: EntityId; localUri?: string; mimeType: string; createdAt: ISODateTime; updatedAt: ISODateTime; syncStatus: 'LOCAL' | 'SYNCED' | 'PENDING'; }

export interface Money { amountMinor: number; currency: CurrencyCode; }
export interface FeeAgreement { id: EntityId; matterId: EntityId; agreedFee: Money; status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'; createdAt: ISODateTime; }
export interface Payment { id: EntityId; matterId: EntityId; feeAgreementId: EntityId; amount: Money; paidAt: ISODateTime; method: 'CASH' | 'BANK' | 'OTHER'; }
export interface Receipt { id: EntityId; officeId: EntityId; number: string; paymentId: EntityId; issuedAt: ISODateTime; status: 'ACTIVE' | 'CANCELLED'; cancelledAt?: ISODateTime; cancellationReason?: string; replacesReceiptId?: EntityId; }
export interface Expense { id: EntityId; matterId: EntityId; description: string; amount: Money; incurredAt: ISODate; paidBy: 'OFFICE' | 'CLIENT_TRUST'; }
export interface ClientTrust { id: EntityId; clientId: EntityId; matterId?: EntityId; direction: 'DEPOSIT' | 'DISBURSEMENT'; amount: Money; occurredAt: ISODateTime; description: string; }
export interface DashboardActivity { id: EntityId; officeId: EntityId; kind: 'MATTER' | 'CLIENT' | 'DOCUMENT' | 'PAYMENT'; title: string; detail: string; happenedAt: ISODateTime; }

export interface DashboardSnapshot { currentUser: User; office: Office; todaysSessions: Session[]; upcomingDeadlines: Deadline[]; activeMatters: number; outstandingFees: Money; overdueFeeItems: number; recentActivity: DashboardActivity[]; }

export interface Repository<T> { getById(id: EntityId): Promise<T | null>; }
export interface ClientRepository extends Repository<Client> { listByOffice(officeId: EntityId): Promise<Client[]>; save(client: Client): Promise<void>; }
export interface MatterRepository extends Repository<Matter> { listByOffice(officeId: EntityId): Promise<Matter[]>; listByClient(clientId: EntityId): Promise<Matter[]>; listActive(officeId: EntityId): Promise<Matter[]>; save(matter: Matter): Promise<void>; }
export interface SessionRepository extends Repository<Session> { listForDate(officeId: EntityId, date: ISODate): Promise<Session[]>; }
export interface DocumentRepository extends Repository<LegalDocument> { listByMatter(matterId: EntityId): Promise<LegalDocument[]>; save(document: LegalDocument): Promise<void>; }
export interface FinanceRepository { listFeePayments(matterId: EntityId): Promise<Payment[]>; listExpenses(matterId: EntityId): Promise<Expense[]>; listTrustEntries(clientId: EntityId): Promise<ClientTrust[]>; }
export interface WorkflowRepository extends Repository<Workflow> { save(workflow: Workflow): Promise<void>; }
export interface DashboardRepository { getSnapshot(): Promise<DashboardSnapshot>; }

export function cancelReceipt(receipt: Receipt, cancelledAt: ISODateTime, reason: string): Receipt {
  if (receipt.status === 'CANCELLED') throw new Error('RECEIPT_ALREADY_CANCELLED');
  if (!reason.trim()) throw new Error('CANCELLATION_REASON_REQUIRED');
  return { ...receipt, status: 'CANCELLED', cancelledAt, cancellationReason: reason };
}

export * from './clientsMatters';
