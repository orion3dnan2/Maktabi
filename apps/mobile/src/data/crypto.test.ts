import { describe, expect, it } from 'vitest';
import { decryptText, encryptText, KDF_ITERATIONS, passwordKey } from './crypto';
import { base64 } from './encoding';
describe('encrypted local records', () => {
  it('encrypts Arabic text without exposing it and rejects altered ciphertext', () => {
    const key = new Uint8Array(32).fill(7); const envelope = encryptText('بيانات عميل سرية', key, new Uint8Array(12).fill(3));
    expect(JSON.stringify(envelope)).not.toContain('عميل'); expect(decryptText(envelope, key)).toBe('بيانات عميل سرية');
    expect(() => decryptText({ ...envelope, ciphertext: `${envelope.ciphertext.slice(0, -2)}ff` }, key)).toThrow();
    expect(() => decryptText(envelope, new Uint8Array(32).fill(8))).toThrow();
  });
  it('derives different keys for different salts and passwords', async () => {
    const a = await passwordKey('long-passphrase', new Uint8Array(16).fill(1), KDF_ITERATIONS); const b = await passwordKey('long-passphrase', new Uint8Array(16).fill(2), KDF_ITERATIONS);
    expect(a).not.toEqual(b); expect(a).toHaveLength(32);
  });
  it('encodes Unicode backup content as standards-compliant base64', () => { const bytes = new TextEncoder().encode('مكتبي test'); expect(base64(bytes)).toBe(Buffer.from(bytes).toString('base64')); });
});
