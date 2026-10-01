// Phone numbers are the login identifier. Supabase Auth has no SMS provider in
// this project, so every account is stored as an email derived from the
// normalised number. The rule itself (Sudanese numbers only) lives in
// packages/domain/src/phone.ts, and supabase/functions/manage-users/phone.ts keeps an
// identical copy: accounts are created there and signed into here.
export { normalizePhone } from '@maktabi/domain';

/** The Supabase Auth email for a normalised phone. `.invalid` (RFC 2606) can never receive mail. */
export const phoneLoginEmail = (e164: string) => `p${e164.slice(1)}@phone.maktabi.invalid`;
