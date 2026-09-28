import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createVault, encryptedBackup, hasVault, isUnlocked, lockVault, restoreEncryptedBackup, unlockVault, vaultStorage } from './vault';
import { STORAGE_KEY } from './localRepositories';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, encryptText, KDF_ITERATIONS } from './crypto';
const fixture = vi.hoisted(() => ({ store: new Map<string, string>(), fail: false }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { async getItem(key: string) { return fixture.store.get(key) ?? null; }, async setItem(key: string, value: string) { if (fixture.fail) throw new Error('disk full'); fixture.store.set(key, value); }, async removeItem(key: string) { fixture.store.delete(key); } } }));
vi.mock('expo-crypto', () => ({ async getRandomBytesAsync(length: number) { return crypto.getRandomValues(new Uint8Array(length)); } }));
const phone = '+249000000999'; const password = 'Maktabi-test-passphrase';
beforeEach(() => { lockVault(); fixture.store.clear(); fixture.fail = false; });
describe('office vault lifecycle', () => {
  it('creates an empty office, persists encrypted data, locks and verifies phone/password', async () => {
    await createVault(phone, password); expect(isUnlocked()).toBe(true); expect(JSON.parse((await vaultStorage.getItem(''))!).clients).toEqual([]);
    await vaultStorage.setItem('', JSON.stringify({ client: 'معلومات خاصة' })); expect(await encryptedBackup()).not.toContain('معلومات خاصة');
    lockVault(); await expect(vaultStorage.getItem('')).rejects.toThrow(); await expect(unlockVault(phone, 'wrong-password')).rejects.toThrow(); expect(isUnlocked()).toBe(false);
    await unlockVault(phone, password); expect(await vaultStorage.getItem('')).toContain('معلومات خاصة');
  });
  it('migrates existing local work only after successful encryption storage', async () => {
    fixture.store.set(STORAGE_KEY, JSON.stringify({ version: 1, clients: [{ id: 'keep-me' }], matters: [] })); fixture.fail = true;
    await expect(createVault(phone, password)).rejects.toThrow('disk full'); expect(fixture.store.has(STORAGE_KEY)).toBe(true); expect(await hasVault()).toBe(false);
    fixture.fail = false; await createVault(phone, password); expect(fixture.store.has(STORAGE_KEY)).toBe(false); expect(await vaultStorage.getItem('')).toContain('keep-me');
  });
  it('validates a backup before replacing the current office and locks after restore', async () => {
    await createVault(phone, password); const backup = await encryptedBackup(); await vaultStorage.setItem('', JSON.stringify({ version: 1, clients: [{ id: 'later' }], matters: [] }));
    await expect(restoreEncryptedBackup(backup, phone, 'wrong')).rejects.toThrow(); expect(await vaultStorage.getItem('')).toContain('later');
    await restoreEncryptedBackup(backup, phone, password); expect(isUnlocked()).toBe(false); await unlockVault(phone, password); expect(JSON.parse((await vaultStorage.getItem(''))!).clients).toEqual([]);
  });
  it('opens vaults created with the old fixed 600k KDF and upgrades them to the current cost', async () => {
    const salt = new Uint8Array(16).fill(5); const key = new Uint8Array(32).fill(6);
    const derived = pbkdf2(sha256, new TextEncoder().encode(password), salt, { c: 600000, dkLen: 32 });
    const legacy = { version: 1, phone, salt: bytesToHex(salt), wrappedKey: encryptText(bytesToHex(key), derived, new Uint8Array(12).fill(1)), data: encryptText(JSON.stringify({ version: 1, clients: [{ id: 'old' }], matters: [] }), key, new Uint8Array(12).fill(2)) };
    fixture.store.set('maktabi:vault:v1', JSON.stringify(legacy));
    await unlockVault(phone, password); expect(await vaultStorage.getItem('')).toContain('old');
    const stored = JSON.parse(fixture.store.get('maktabi:vault:v1')!); expect(stored.kdf).toEqual({ iterations: KDF_ITERATIONS }); expect(stored.salt).not.toBe(legacy.salt);
    lockVault(); await unlockVault(phone, password); expect(await vaultStorage.getItem('')).toContain('old');
  });
  it('rejects vault files with an unreasonable KDF cost', async () => {
    await createVault(phone, password); const stored = JSON.parse(fixture.store.get('maktabi:vault:v1')!); lockVault();
    fixture.store.set('maktabi:vault:v1', JSON.stringify({ ...stored, kdf: { iterations: 1e9 } }));
    await expect(unlockVault(phone, password)).rejects.toThrow('ملف المكتب غير صالح');
  });
});
describe('per-user workspaces', () => {
  it('keeps each signed-in user in their own vault and reports a changed password', async () => {
    const { openUserVault, selectVaultUser, discardUserVault, VaultPasswordMismatch } = await import('./vault');
    await openUserVault('user-a', phone, password); await vaultStorage.setItem('', JSON.stringify({ version: 1, clients: [{ id: 'a' }], matters: [] }));
    await openUserVault('user-b', phone, 'Another-long-passphrase'); expect(await vaultStorage.getItem('')).not.toContain('"a"');
    await openUserVault('user-a', phone, password); expect(await vaultStorage.getItem('')).toContain('"a"');
    await expect(openUserVault('user-a', phone, 'Reset-by-admin-123')).rejects.toBeInstanceOf(VaultPasswordMismatch);
    selectVaultUser('user-a'); await discardUserVault(); await openUserVault('user-a', phone, 'Reset-by-admin-123');
    expect(JSON.parse((await vaultStorage.getItem(''))!).clients).toEqual([]);
    selectVaultUser(null);
  });
});
