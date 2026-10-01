// Phone numbers are the login identifier. Supabase Auth has no SMS provider in
// this project, so every account is stored as an email derived from the
// normalised number. Maktabi is Sudan-only: every number is Sudanese (+249).
// KEEP IN SYNC with packages/domain/src/phone.ts, which the app uses (a test in
// apps/mobile/src/auth/phone.test.ts checks that both copies are identical).

const EASTERN_DIGITS = /[٠-٩۰-۹]/g;

/**
 * Returns the Sudanese number in E.164 form (+249 and 9 digits) or null.
 * Accepts +249…, 00249…, 249…, 0XXXXXXXXX (10 digits) and 9-digit local numbers.
 * Spaces, dashes and brackets are ignored; Arabic-Indic and Persian digits are converted.
 */
export function normalizePhone(input: string): string | null {
  const ascii = input.trim().replace(EASTERN_DIGITS, (d) => String((d.charCodeAt(0) & 0xf) % 10));
  if (!/^\+?[\d\s()-]+$/.test(ascii)) return null;
  const hasPlus = ascii.startsWith('+');
  let digits = ascii.replace(/\D/g, '');
  if (!hasPlus) {
    if (digits.startsWith('00')) digits = digits.slice(2);
    else if (digits.length === 10 && digits.startsWith('0')) digits = `249${digits.slice(1)}`;
    else if (digits.length === 9) digits = `249${digits}`;
  }
  return /^249[1-9]\d{8}$/.test(digits) ? `+${digits}` : null;
}

/** The Supabase Auth email for a normalised phone. `.invalid` (RFC 2606) can never receive mail. */
export const phoneLoginEmail = (e164: string) => `p${e164.slice(1)}@phone.maktabi.invalid`;
