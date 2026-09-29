import { validateMatter, type Matter, type MatterRepository } from '@maktabi/domain';
import { isUuid } from '../ids';
import type { Db } from './clientRepository';
import { messages, RepositoryError, toRepositoryError } from './errors';
import { MATTER_SELECT, matterFromRow, matterStatuses, matterToRpc } from './mappers';

export interface AssignableLawyer { id: string; fullName: string }

export interface SupabaseMatterRepository extends MatterRepository {
  /** Active lawyers and admins of the office: the people a matter may be assigned to. */
  listAssignableLawyers(): Promise<AssignableLawyer[]>;
}

/**
 * Matters stored in Supabase. As with clients, RLS decides what the user sees: admins and
 * employees see the office's matters, lawyers only those assigned to or created by them,
 * reception and portal users none. Writes go through public.save_matter so a matter and
 * its parties are saved in one transaction, still as the calling user.
 */
export function createSupabaseMatterRepository(db: Db): SupabaseMatterRepository {
  const select = () => db.from('matters').select(MATTER_SELECT);
  const many = async (query: ReturnType<typeof select>) => {
    const { data, error, status } = await query.order('opened_at', { ascending: false }).order('matter_number');
    if (error) throw toRepositoryError(error, status);
    return data.map(matterFromRow);
  };
  return {
    async getById(id) {
      if (!isUuid(id)) return null;
      const { data, error, status } = await select().eq('id', id);
      if (error) throw toRepositoryError(error, status);
      return data[0] ? matterFromRow(data[0]) : null;
    },
    listByOffice: () => many(select()),
    listActive: () => many(select().eq('status', matterStatuses.ACTIVE)),
    async listByClient(clientId) {
      if (!isUuid(clientId)) return [];
      // Matters where the client is the primary client or one of the parties.
      const { data: links, error, status } = await db.from('matter_parties').select('matter_id').eq('client_id', clientId);
      if (error) throw toRepositoryError(error, status);
      const linked = [...new Set(links.map((l) => l.matter_id))];
      // Both values are UUIDs (checked above / returned by the server), so the filter string cannot be injected into.
      return many(linked.length ? select().or(`client_id.eq.${clientId},id.in.(${linked.join(',')})`) : select().eq('client_id', clientId));
    },
    async save(matter: Matter) {
      if (Object.keys(validateMatter(matter)).length) throw new RepositoryError('invalid', 'تحقق من بيانات الملف والعميل الأساسي');
      if (!isUuid(matter.id) || !matter.parties.every((p) => !p.clientId || isUuid(p.clientId)))
        throw new RepositoryError('invalid', messages.invalid, { message: 'matter or client id is not a UUID' });
      const { error, status } = await db.rpc('save_matter', matterToRpc(matter));
      if (error) throw toRepositoryError(error, status);
    },
    async setStatus(id, next) {
      if (!isUuid(id)) throw new RepositoryError('not_found', messages.notFound);
      const { data, error, status } = await db.from('matters').update({ status: matterStatuses[next] }).eq('id', id).select('id');
      if (error) throw toRepositoryError(error, status);
      if (!data.length) throw new RepositoryError('not_found', messages.notFound, { status });
    },
    async listAssignableLawyers() {
      const { data, error, status } = await db.from('profiles').select('id, full_name').in('role', ['lawyer', 'admin']).eq('is_active', true).not('office_id', 'is', null).order('full_name');
      if (error) throw toRepositoryError(error, status);
      return data.map((p) => ({ id: p.id, fullName: p.full_name }));
    },
  };
}
