import { gcm } from '@noble/ciphers/aes.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/ciphers/utils.js';
import { pbkdf2Sha256 } from './pbkdf2';
export interface CipherEnvelope { version: 1; nonce: string; ciphertext: string }
// Vaults created before the KDF parameters were stored used 600k iterations; they still open.
export const LEGACY_KDF_ITERATIONS = 600000;
// New vaults: PBKDF2 runs in JavaScript on the phone (no native crypto in Expo Go), so 600k
// iterations took over a minute per login. 100k keeps login to a few seconds.
export const KDF_ITERATIONS = 100000;
export const isValidIterations = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 10000 && (value as number) <= 2000000;
export const passwordKey = (password: string, salt: Uint8Array, iterations: number) => pbkdf2Sha256(utf8ToBytes(password), salt, iterations);
export function encryptText(value: string, key: Uint8Array, nonce: Uint8Array): CipherEnvelope {
  if (nonce.length !== 12) throw new Error('Invalid nonce');
  return { version: 1, nonce: bytesToHex(nonce), ciphertext: bytesToHex(gcm(key, nonce, utf8ToBytes('maktabi:v1')).encrypt(utf8ToBytes(value))) };
}
export function decryptText(value: CipherEnvelope, key: Uint8Array): string {
  if (value.version !== 1 || typeof value.nonce !== 'string' || value.nonce.length !== 24 || typeof value.ciphertext !== 'string') throw new Error('النسخة المشفرة غير صالحة');
  return new TextDecoder().decode(gcm(key, hexToBytes(value.nonce), utf8ToBytes('maktabi:v1')).decrypt(hexToBytes(value.ciphertext)));
}
export { bytesToHex, hexToBytes };
