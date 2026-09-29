import type { Client, ClientStatus, Matter, MatterParty, MatterStatus, MatterType } from '@maktabi/domain';
import type { Database, Json } from '@/lib/database.types';
import { isUuid } from '../ids';

/**
 * Persistence ⇄ domain mapping for clients and matters. Row types come from the generated
 * database types; domain types stay provider-independent (packages/domain).
 */
type Enums = Database['public']['Enums'];
export type ClientRow = Database['public']['Tables']['clients']['Row'];
export type ClientWrite = Database['public']['Tables']['clients']['Insert'];

const clientKinds = { PERSON: 'individual', ORGANIZATION: 'organization' } as const satisfies Record<Client['kind'], Enums['client_type']>;
export const clientStatuses = { ACTIVE: 'active', INACTIVE: 'inactive', ARCHIVED: 'archived' } as const satisfies Record<ClientStatus, Enums['client_status']>;
export const matterStatuses = { ACTIVE: 'open', ON_HOLD: 'on_hold', CLOSED: 'closed', ARCHIVED: 'archived' } as const satisfies Record<MatterStatus, Enums['matter_status']>;
const matterTypes = {
  CRIMINAL: 'criminal', CIVIL: 'civil', PERSONAL_STATUS: 'personal_status', LABOUR: 'labour', SPECIAL_COURT: 'special_court',
  COMMERCIAL_REGISTRY: 'commercial_registry', LAND_REGISTRY: 'land_registry', NOTARIZATION: 'notarization', OTHER: 'other',
} as const satisfies Record<MatterType, Enums['matter_type']>;
const partyRoles = { CLIENT: 'client', OPPONENT: 'opponent', WITNESS: 'witness', OTHER: 'other' } as const satisfies Record<MatterParty['role'], Enums['party_role']>;

function inverse<K extends string, V extends string>(map: Record<K, V>): Map<string, K> {
  return new Map((Object.entries(map) as [K, V][]).map(([key, value]) => [value, key]));
}
const clientKindOf = inverse(clientKinds);
const clientStatusOf = inverse(clientStatuses);
const matterStatusOf = inverse(matterStatuses);
const matterTypeOf = inverse(matterTypes);
const partyRoleOf = inverse(partyRoles);

/** Arabic-Indic and Persian digits → ASCII, so numbers typed on an Arabic keyboard pass the database checks. */
export const asciiDigits = (value: string) =>
  value.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

const text = (value: string | undefined) => { const trimmed = value?.trim(); return trimmed ? trimmed : null; };
const phone = (value: string | undefined) => { const trimmed = text(value); return trimmed ? asciiDigits(trimmed).replace(/\s+/g, ' ') : null; };
const optional = (value: string | null) => value ?? undefined;

export function clientFromRow(row: ClientRow): Client {
  return {
    id: row.id,
    officeId: row.office_id,
    displayName: row.full_name,
    kind: clientKindOf.get(row.client_type) ?? 'PERSON',
    phone: row.phone ?? '',
    whatsapp: optional(row.whatsapp),
    contactPerson: optional(row.contact_person),
    registration: optional(row.registration_number),
    address: optional(row.address),
    notes: optional(row.notes),
    email: optional(row.email),
    // The app has one identity field, "الرقم الوطني". Rows written elsewhere with another id_type are shown the same way.
    nationalId: optional(row.civil_id),
    status: clientStatusOf.get(row.status) ?? 'ACTIVE',
    createdAt: row.created_at,
  };
}

/**
 * Columns the app writes. office_id, status, created_by and timestamps are never sent:
 * the office comes from the session (column default + RLS) and status changes go through setStatus.
 * The national number is stored as id_type 'national_id' with no country, so no national format
 * (such as the Kuwait civil-ID rule) is assumed; choosing a country/format is a product decision.
 */
export function clientToRow(client: Client): ClientWrite & { id: string } {
  const nationalId = text(client.nationalId && asciiDigits(client.nationalId));
  return {
    id: client.id,
    client_type: clientKinds[client.kind],
    full_name: client.displayName.trim(),
    phone: phone(client.phone),
    whatsapp: phone(client.whatsapp),
    email: text(client.email),
    address: text(client.address),
    contact_person: text(client.contactPerson),
    registration_number: text(client.registration),
    notes: text(client.notes),
    civil_id: nationalId,
    id_type: nationalId ? 'national_id' : null,
  };
}

/** The select list used for every matter read: the matter, its authoritative client and lawyer names, and its parties. */
export const MATTER_SELECT = 'id, office_id, client_id, assigned_lawyer_id, matter_number, title, description, matter_type, court_name, status, opened_at, details, created_at, client:clients!matters_client_fk(id, full_name), lawyer:profiles!matters_lawyer_fk(id, full_name), parties:matter_parties(id, client_id, display_name, party_role, created_at, client:clients!matter_parties_client_fk(id, full_name))';

interface NamedRef { id: string; full_name: string }
export interface PartyQueryRow { id: string; client_id: string | null; display_name: string | null; party_role: Enums['party_role']; created_at: string; client: NamedRef | null }
export interface MatterQueryRow {
  id: string; office_id: string; client_id: string; assigned_lawyer_id: string | null; matter_number: string; title: string;
  description: string | null; matter_type: Enums['matter_type']; court_name: string | null; status: Enums['matter_status'];
  opened_at: string; details: Json; created_at: string;
  client: NamedRef | null; lawyer: NamedRef | null; parties: PartyQueryRow[];
}

/** RLS can hide a linked client from a lawyer; the link is still shown, without the name. */
export const HIDDEN_CLIENT_NAME = 'عميل (لا تملك صلاحية عرض بياناته)';
/** The primary client is matters.client_id, not a matter_parties row; its party id is derived from the matter. */
export const primaryPartyId = (matterId: string) => `primary:${matterId}`;

function detailsFrom(value: Json): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

export function matterFromRow(row: MatterQueryRow): Matter {
  const primary: MatterParty = {
    id: primaryPartyId(row.id), matterId: row.id, clientId: row.client_id,
    displayName: row.client?.full_name ?? HIDDEN_CLIENT_NAME, role: 'CLIENT', isPrimary: true,
  };
  const others = [...row.parties]
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
    .map((p): MatterParty => ({
      id: p.id, matterId: row.id, clientId: p.client_id ?? undefined,
      // A registered client's name is always read from the client record, never copied into the party.
      displayName: p.client_id ? p.client?.full_name ?? HIDDEN_CLIENT_NAME : p.display_name ?? '',
      role: partyRoleOf.get(p.party_role) ?? 'OTHER', isPrimary: false,
    }));
  return {
    id: row.id,
    officeId: row.office_id,
    reference: row.matter_number,
    title: row.title,
    // Database-only types (commercial, administrative, real_estate, consultation) are not produced by the app and read as OTHER.
    type: matterTypeOf.get(row.matter_type) ?? 'OTHER',
    status: matterStatusOf.get(row.status) ?? 'ACTIVE',
    authority: optional(row.court_name),
    notes: optional(row.description),
    openedAt: row.opened_at,
    details: detailsFrom(row.details),
    assignedLawyerId: optional(row.assigned_lawyer_id),
    assignedLawyerName: row.lawyer?.full_name,
    parties: [primary, ...others],
  };
}

export interface SaveMatterArgs { p_matter: Json; p_parties: Json }

/** Arguments for public.save_matter: the matter row and the parties other than the primary client. */
export function matterToRpc(matter: Matter): SaveMatterArgs {
  const primary = matter.parties.find((p) => p.isPrimary);
  const details = Object.fromEntries(Object.entries(matter.details).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
  return {
    p_matter: {
      id: matter.id,
      client_id: primary?.clientId ?? null,
      assigned_lawyer_id: matter.assignedLawyerId ?? null,
      matter_number: matter.reference.trim(),
      title: matter.title.trim(),
      description: text(matter.notes),
      matter_type: matterTypes[matter.type],
      court_name: text(matter.authority),
      status: matterStatuses[matter.status],
      opened_at: matter.openedAt,
      details,
    },
    p_parties: matter.parties.filter((p) => !p.isPrimary).map((p) => ({
      // Parties created on the device before their first save have no server id yet.
      id: isUuid(p.id) ? p.id : null,
      client_id: p.clientId ?? null,
      display_name: p.clientId ? null : p.displayName.trim(),
      party_role: partyRoles[p.role],
    })),
  };
}
