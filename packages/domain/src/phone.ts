// Maktabi is Sudan-only: every phone number is Sudanese and is stored in E.164 form,
// +249 followed by 9 digits. KEEP normalizePhone IN SYNC with
// supabase/functions/manage-users/phone.ts: accounts are created there and signed into
// from the app, so both must produce the same number (a test compares the two).

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
