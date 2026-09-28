import { describe, expect, it } from 'vitest';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { pbkdf2Sha256 } from './pbkdf2';

describe('pbkdf2Sha256', () => {
  it('matches RFC 7914 PBKDF2-HMAC-SHA256 test vectors (first 32 bytes)', async () => {
    expect(bytesToHex(await pbkdf2Sha256(utf8ToBytes('passwd'), utf8ToBytes('salt'), 1))).toBe('55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc');
    expect(bytesToHex(await pbkdf2Sha256(utf8ToBytes('Password'), utf8ToBytes('NaCl'), 80000))).toBe('4ddcd8f60b98be21830cee5ef22701f9641a4418d04c0414aeff08876b34ab56');
  });
  it('is identical to @noble/hashes for random passwords, salts and iteration counts', async () => {
    const lengths = [0, 1, 12, 31, 32, 55, 63, 64, 65, 100, 200];
    for (let n = 0; n < 60; n++) {
      const password = crypto.getRandomValues(new Uint8Array(lengths[n % lengths.length]!));
      const salt = crypto.getRandomValues(new Uint8Array((n * 7) % 70));
      const iterations = 1 + ((n * 131) % 3000);
      expect(bytesToHex(await pbkdf2Sha256(password, salt, iterations))).toBe(bytesToHex(pbkdf2(sha256, password, salt, { c: iterations, dkLen: 32 })));
    }
  });
  it('handles Arabic passwords like the reference implementation', async () => {
    const password = utf8ToBytes('كلمة-مرور-المكتب-٢٠٢٦'); const salt = new Uint8Array(16).fill(9);
    expect(bytesToHex(await pbkdf2Sha256(password, salt, 5000))).toBe(bytesToHex(pbkdf2(sha256, password, salt, { c: 5000, dkLen: 32 })));
  });
  it('rejects invalid iteration counts', async () => {
    await expect(pbkdf2Sha256(new Uint8Array(1), new Uint8Array(1), 0)).rejects.toThrow();
    await expect(pbkdf2Sha256(new Uint8Array(1), new Uint8Array(1), 1.5)).rejects.toThrow();
  });
});
