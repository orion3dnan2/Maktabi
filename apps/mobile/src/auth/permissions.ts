import type { Access, OfficeRole } from './access';
export type Capability = 'create_clients' | 'edit_cases' | 'assign_cases' | 'manage_team' | 'manage_office_settings' | 'manage_templates' | 'view_cases';
const capabilities: Record<OfficeRole, readonly Capability[]> = {
  admin: ['create_clients','edit_cases','assign_cases','manage_team','manage_office_settings','manage_templates','view_cases'],
  lawyer: ['create_clients','edit_cases','view_cases'], employee: ['create_clients','edit_cases','view_cases'],
  reception: ['create_clients'], client: [],
};
export function can(access: Access | undefined, capability: Capability): boolean {
  return !!access?.is_active && access.office?.status === 'active' && !!access.role && capabilities[access.role].includes(capability);
}
