// Phone numbers are the login identifier. Supabase Auth has no SMS provider in
// this project, so every account is stored as an email derived from the
// normalised number. KEEP IN SYNC with supabase/functions/manage-users/phone.ts:
// accounts are created there and signed into here, so both sides must produce
// exactly the same address for the same typed number.

const EASTERN_DIGITS = /[٠-٩۰-۹]/g;

/**
 * Returns the number in E.164 form (+ and 10–15 digits) or null.
 * Local shortcuts: 0XXXXXXXXX (10 digits) and 9-digit numbers are Sudan (+249);
 * 8-digit numbers are Kuwait (+965). Anything else must include its country code.
 */
export function normalizePhone(input: string): string | null {
  const ascii = input.trim().replace(EASTERN_DIGITS, (d) => String((d.charCodeAt(0) & 0xf) % 10));
  const hasPlus = ascii.startsWith('+');
  let digits = ascii.replace(/\D/g, '');
  if (!digits) return null;
  if (!hasPlus) {
    if (digits.startsWith('00')) digits = digits.slice(2);
    else if (digits.length === 10 && digits.startsWith('0')) digits = `249${digits.slice(1)}`;
    else if (digits.length === 9) digits = `249${digits}`;
    else if (digits.length === 8) digits = `965${digits}`;
  }
  return /^[1-9]\d{9,14}$/.test(digits) ? `+${digits}` : null;
}

/** The Supabase Auth email for a normalised phone. `.invalid` (RFC 2606) can never receive mail. */
export const phoneLoginEmail = (e164: string) => `p${e164.slice(1)}@phone.maktabi.invalid`;
