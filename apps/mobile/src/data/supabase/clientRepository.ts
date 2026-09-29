import type { SupabaseClient } from '@supabase/supabase-js';
import { validateClient, type Client, type ClientRepository } from '@maktabi/domain';
import type { Database } from '@/lib/database.types';
import { isUuid } from '../ids';
import { messages, RepositoryError, toRepositoryError } from './errors';
import { clientFromRow, clientStatuses, clientToRow } from './mappers';

export type Db = SupabaseClient<Database>;

export interface SupabaseClientRepository extends ClientRepository {
  /** Archived clients, so they can be found and restored. */
  listArchived(officeId: string): Promise<Client[]>;
  /** Number of clients that are not archived, counted by the server. */
  count(): Promise<number>;
}

/**
 * Clients stored in Supabase. The officeId arguments of the domain interface are not used:
 * RLS limits every query to the signed-in user's office, and inserts take office_id from the
 * column default, so the app can never choose (or spoof) the office.
 */
export function createSupabaseClientRepository(db: Db): SupabaseClientRepository {
  const list = async (archived: boolean) => {
    const query = db.from('clients').select('*');
    const { data, error, status } = await (archived ? query.eq('status', 'archived') : query.neq('status', 'archived')).order('full_name');
    if (error) throw toRepositoryError(error, status);
    return data.map(clientFromRow);
  };
  return {
    async getById(id) {
      if (!isUuid(id)) return null;
      const { data, error, status } = await db.from('clients').select('*').eq('id', id).maybeSingle();
      if (error) throw toRepositoryError(error, status);
      return data ? clientFromRow(data) : null;
    },
    listByOffice: () => list(false),
    listArchived: () => list(true),
    async count() {
      const { count, error, status } = await db.from('clients').select('id', { count: 'exact', head: true }).neq('status', 'archived');
      if (error) throw toRepositoryError(error, status);
      return count ?? 0;
    },
    async save(client) {
      if (Object.keys(validateClient(client)).length) throw new RepositoryError('invalid', 'تحقق من بيانات العميل');
      if (!isUuid(client.id)) throw new RepositoryError('invalid', messages.invalid, { message: `client id is not a UUID: ${client.id}` });
      // Insert or update by id in one statement. An id that belongs to another office fails RLS; it is never overwritten.
      const { error, status } = await db.from('clients').upsert(clientToRow(client), { onConflict: 'id' });
      if (error) throw toRepositoryError(error, status);
    },
    async setStatus(id, next) {
      if (!isUuid(id)) throw new RepositoryError('not_found', messages.notFound);
      const { data, error, status } = await db.from('clients').update({ status: clientStatuses[next] }).eq('id', id).select('id');
      if (error) throw toRepositoryError(error, status);
      if (!data.length) throw new RepositoryError('not_found', messages.notFound, { status });
    },
  };
}
