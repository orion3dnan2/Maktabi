import { gcm } from '@noble/ciphers/aes.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/ciphers/utils.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
export interface CipherEnvelope { version: 1; nonce: string; ciphertext: string }
export const passwordKey = (password: string, salt: Uint8Array) => pbkdf2Async(sha256, utf8ToBytes(password), salt, { c: 600000, dkLen: 32, asyncTick: 15 });
export function encryptText(value: string, key: Uint8Array, nonce: Uint8Array): CipherEnvelope {
  if (nonce.length !== 12) throw new Error('Invalid nonce');
  return { version: 1, nonce: bytesToHex(nonce), ciphertext: bytesToHex(gcm(key, nonce, utf8ToBytes('maktabi:v1')).encrypt(utf8ToBytes(value))) };
}
export function decryptText(value: CipherEnvelope, key: Uint8Array): string {
  if (value.version !== 1 || typeof value.nonce !== 'string' || value.nonce.length !== 24 || typeof value.ciphertext !== 'string') throw new Error('النسخة المشفرة غير صالحة');
  return new TextDecoder().decode(gcm(key, hexToBytes(value.nonce), utf8ToBytes('maktabi:v1')).decrypt(hexToBytes(value.ciphertext)));
}
export { bytesToHex, hexToBytes };
