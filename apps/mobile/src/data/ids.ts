import { randomUUID } from 'expo-crypto';

/**
 * Placeholder for the officeId argument of the domain repository interfaces. The Supabase
 * repositories ignore it: the office always comes from the signed-in session (RLS and the
 * office_id column default), never from the app.
 */
export const OFFICE_ID = 'office-1';

/** Record ids are UUIDs made on the device, so a record keeps its id before and after it reaches the server. */
export const newId = (): string => randomUUID();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string | undefined | null): value is string => !!value && UUID.test(value);
