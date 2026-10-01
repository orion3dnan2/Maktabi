import type { Client, Matter } from '@maktabi/domain';
import type { OfficeRole } from '@/auth/access';

export type Kind = 'client' | 'matter' | 'assignment';
export type SyncStatus = 'pending' | 'synced' | 'failed' | 'conflict';
export interface AssignmentCommand { userId: string; isPrimary: boolean; remove?: boolean }
export interface TeamMember { id: string; fullName: string; role: OfficeRole; status: 'active' | 'suspended' | 'invited' }
export interface Assignment { id: string; matterId: string; userId: string; isPrimary: boolean; assignedAt: string; endedAt: string | null }
export interface RecordEnvelope<T> { value: T; revision: number; status: SyncStatus }
export interface Operation {
  id: string; kind: Kind; entityId: string; officeId: string; baseRevision: number;
  payload: Client | Matter | AssignmentCommand; status: Exclude<SyncStatus, 'synced'>;
  createdAt: string; error?: string; source?: string;
}
export interface LocalState {
  clients: Record<string, RecordEnvelope<Client>>;
  matters: Record<string, RecordEnvelope<Matter>>;
  assignments: Assignment[]; members: TeamMember[]; operations: Operation[];
  legacyLinks: { clients: Record<string,string>; matters: Record<string,string> };
}
export const emptyState = (): LocalState => ({ clients: {}, matters: {}, assignments: [], members: [], operations: [], legacyLinks: { clients: {}, matters: {} } });
export interface OperationalStore {
  read(): Promise<LocalState>;
  transact<T>(action: (state: LocalState) => T): Promise<T>;
  clear(): Promise<void>;
}
export interface CloudSnapshot {
  clients: RecordEnvelope<Client>[]; matters: RecordEnvelope<Matter>[];
  assignments: Assignment[]; members: TeamMember[];
}
export interface SyncTransport {
  push(operation: Operation): Promise<number>;
  pull(): Promise<CloudSnapshot>;
}
export interface SyncSummary { pending: number; failed: number; conflicts: number; offline: boolean; error: string }
export class SyncError extends Error {
  constructor(public readonly reason: 'offline' | 'conflict' | 'forbidden' | 'invalid', message: string) { super(message); }
}
export const groupKey = (kind: Kind, id: string) => `${kind === 'client' ? 'client' : 'matter'}:${id}`;
