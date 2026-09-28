import { getRandomBytes } from 'expo-crypto';

// No look-alike characters (0/O, 1/l/I) so it can be read out over the phone.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/** A random 12-character password for new accounts and resets. */
export function generatePassword(length = 12): string {
  const bytes = getRandomBytes(length * 2);
  let out = '';
  for (let i = 0; out.length < length && i < bytes.length; i++) if (bytes[i]! < 216) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out.length === length ? out : generatePassword(length);
}
