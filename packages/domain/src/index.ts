export type EntityId = string;
export type ISODateTime = string;

export interface User {
  id: EntityId;
  fullName: string;
  role: 'owner' | 'lawyer' | 'assistant' | 'accountant';
  officeName: string;
  avatarUrl?: string;
}

export interface Client {
  id: EntityId;
  displayName: string;
  kind: 'person' | 'organization';
  phone: string;
  email?: string;
  nationalId?: string;
  createdAt: ISODateTime;
}

export type MatterStatus = 'active' | 'pending' | 'closed' | 'archived';

export interface Matter {
  id: EntityId;
  reference: string;
  title: string;
  type: string;
  clientId: EntityId;
  clientName: string;
  opponent?: string;
  court: string;
  workflowStage: string;
  status: MatterStatus;
  nextEventAt?: ISODateTime;
}

export interface Session {
  id: EntityId;
  matterId: EntityId;
  matterTitle: string;
  court: string;
  room?: string;
  startsAt: ISODateTime;
  status: 'scheduled' | 'completed' | 'adjourned' | 'cancelled';
}

export interface LegalDocument {
  id: EntityId;
  title: string;
  kind: 'pleading' | 'evidence' | 'contract' | 'correspondence' | 'other';
  matterId?: EntityId;
  clientId?: EntityId;
  mimeType: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Deadline {
  id: EntityId;
  matterId: EntityId;
  title: string;
  dueAt: ISODateTime;
  priority: 'normal' | 'urgent';
}

export interface Activity {
  id: EntityId;
  label: string;
  detail: string;
  happenedAt: ISODateTime;
  kind: 'matter' | 'client' | 'document' | 'payment';
}

export interface DashboardSnapshot {
  currentUser: User;
  todaysSessions: Session[];
  upcomingDeadlines: Deadline[];
  activeMatters: number;
  outstandingFees: number;
  outstandingInvoices: number;
  recentActivity: Activity[];
}

export interface DashboardRepository {
  getSnapshot(): Promise<DashboardSnapshot>;
}
