import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRandomBytesAsync } from 'expo-crypto';
import { normalizeArabic } from '@maktabi/domain';
import { bytesToHex, decryptText, encryptText, hexToBytes, isValidIterations, KDF_ITERATIONS, LEGACY_KDF_ITERATIONS, passwordKey, type CipherEnvelope } from './crypto';
import { STORAGE_KEY, type LocalStorage } from './localRepositories';
import { emptySnapshot, isLocalSnapshot } from './localStore';

const LEGACY_VAULT_KEY = 'maktabi:vault:v1';
// Each signed-in office user gets their own encrypted workspace on the device,
// unlocked with their login phone + password. Since Phase 2 it holds only device-local data
// (matter workflows and office settings); clients and matters are in Supabase.
let VAULT_KEY = LEGACY_VAULT_KEY;
interface Vault { version: 1; phone: string; salt: string; kdf?: { iterations: number }; wrappedKey: CipherEnvelope; data: CipherEnvelope }
let unlocked: { key: Uint8Array; vault: Vault } | undefined;
let operation = false; let failures = 0; let retryAt = 0;
const normalizePhone = (phone: string) => normalizeArabic(phone).replace(/[\s()-]/g, '');
export const hasVault = async () => !!(await AsyncStorage.getItem(VAULT_KEY));
export const isUnlocked = () => !!unlocked;
export const MIN_PASSWORD_LENGTH = 10;
const checkPassword = (password: string) => { if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`اختر كلمة مرور لا تقل عن ${MIN_PASSWORD_LENGTH} أحرف`); };
const iterationsOf = (vault: Vault) => vault.kdf === undefined ? LEGACY_KDF_ITERATIONS : vault.kdf.iterations;
const validKdf = (vault: Vault) => vault.kdf === undefined || (typeof vault.kdf === 'object' && vault.kdf !== null && isValidIterations(vault.kdf.iterations));
// Re-wrap the data key with the current KDF cost (e.g. vaults created with the old 600k setting). Best effort: login still succeeds if saving fails.
async function upgradeKdf(vault: Vault, key: Uint8Array, password: string): Promise<Vault> {
  if (iterationsOf(vault) === KDF_ITERATIONS) return vault;
  let derived: Uint8Array | undefined;
  try {
    const salt = await getRandomBytesAsync(16); derived = await passwordKey(password, salt, KDF_ITERATIONS);
    const upgraded: Vault = { ...vault, salt: bytesToHex(salt), kdf: { iterations: KDF_ITERATIONS }, wrappedKey: encryptText(bytesToHex(key), derived, await getRandomBytesAsync(12)) };
    await AsyncStorage.setItem(VAULT_KEY, JSON.stringify(upgraded)); return upgraded;
  } catch { return vault; } finally { derived?.fill(0); }
}
export async function createVault(phoneInput: string, password: string) {
  if (operation) throw new Error('جارٍ تنفيذ عملية الدخول'); operation = true;
  try {
    if (await hasVault()) throw new Error('تم إعداد المكتب بالفعل؛ سجل الدخول');
    const phone = normalizePhone(phoneInput); if (!/^\+?\d{7,15}$/.test(phone)) throw new Error('أدخل رقم هاتف صحيحاً'); checkPassword(password);
    const salt = await getRandomBytesAsync(16); const key = await getRandomBytesAsync(32); const derived = await passwordKey(password, salt, KDF_ITERATIONS);
    const legacy = await AsyncStorage.getItem(STORAGE_KEY);
    // Commit the encrypted copy before removing the legacy key. A failed write leaves the original intact.
    const initial = legacy ?? JSON.stringify(emptySnapshot());
    const vault: Vault = { version: 1, phone, salt: bytesToHex(salt), kdf: { iterations: KDF_ITERATIONS }, wrappedKey: encryptText(bytesToHex(key), derived, await getRandomBytesAsync(12)), data: encryptText(initial, key, await getRandomBytesAsync(12)) };
    derived.fill(0); await AsyncStorage.setItem(VAULT_KEY, JSON.stringify(vault)); unlocked = { key, vault };
    if (legacy) await AsyncStorage.removeItem(STORAGE_KEY);
  } finally { operation = false; }
}
export async function unlockVault(phone: string, password: string) {
  if (Date.now() < retryAt) throw new Error('محاولات كثيرة؛ انتظر دقيقة ثم حاول مجدداً');
  if (operation) throw new Error('جارٍ تنفيذ عملية الدخول'); operation = true;
  try {
    const raw = await AsyncStorage.getItem(VAULT_KEY); if (!raw) throw new Error('أنشئ مكتبك على هذا الجهاز أولاً');
    const vault = JSON.parse(raw) as Vault;
    if (vault.version !== 1 || typeof vault.salt !== 'string' || vault.salt.length !== 32 || !validKdf(vault)) throw new Error('ملف المكتب غير صالح؛ استعد النسخة الاحتياطية');
    let derived: Uint8Array | undefined; let key: Uint8Array;
    try {
      derived = await passwordKey(password, hexToBytes(vault.salt), iterationsOf(vault));
      key = hexToBytes(decryptText(vault.wrappedKey, derived));
      if (normalizePhone(phone) !== vault.phone) { key.fill(0); throw new Error('phone'); }
      decryptText(vault.data, key); failures = 0;
    } catch { failures++; if (failures >= 5) retryAt = Date.now() + 60000; throw new Error('رقم الهاتف أو كلمة المرور غير صحيحة'); }
    finally { derived?.fill(0); }
    unlocked = { key, vault: await upgradeKdf(vault, key, password) };
  } finally { operation = false; }
}
export function lockVault() { unlocked?.key.fill(0); unlocked = undefined; }
/** Point the vault at a user's own workspace (null = legacy single-user key). Locks any open vault. */
export function selectVaultUser(userId: string | null) { lockVault(); VAULT_KEY = userId ? `${LEGACY_VAULT_KEY}:${userId}` : LEGACY_VAULT_KEY; }
/** Thrown when this device's workspace was encrypted with a different password (e.g. after an admin reset). */
export class VaultPasswordMismatch extends Error { constructor() { super('بيانات هذا الجهاز مشفّرة بكلمة مرور سابقة لهذا الحساب.'); } }
/** Opens (or creates on first sign-in) the signed-in user's workspace on this device. */
export async function openUserVault(userId: string, phone: string, password: string) {
  selectVaultUser(userId);
  if (!(await hasVault())) { await createVault(phone, password); return; }
  try { await unlockVault(phone, password); } catch (e) { if (e instanceof Error && e.message === 'رقم الهاتف أو كلمة المرور غير صحيحة') throw new VaultPasswordMismatch(); throw e; }
}
/** Deletes the selected user's workspace on this device (after explicit confirmation). */
export async function discardUserVault() { lockVault(); await AsyncStorage.removeItem(VAULT_KEY); }
export const vaultStorage: LocalStorage = {
  async getItem() { if (!unlocked) throw new Error('سجل الدخول لفتح بيانات المكتب'); return decryptText(unlocked.vault.data, unlocked.key) || null; },
  async setItem(_key, value) {
    if (!unlocked) throw new Error('انتهت جلسة المكتب'); const session = unlocked;
    const vault = { ...session.vault, data: encryptText(value, session.key, await getRandomBytesAsync(12)) };
    if (unlocked !== session) throw new Error('انتهت جلسة المكتب');
    await AsyncStorage.setItem(VAULT_KEY, JSON.stringify(vault)); session.vault = vault;
  },
};
/** A repository must never persist one user's pending operation into a later user's vault. */
export function createScopedVaultStorage(): LocalStorage {
  let session: typeof unlocked;
  const assertActive = () => {
    if (!session || session !== unlocked) throw new Error('انتهت جلسة المكتب');
  };
  return {
    assertActive,
    async getItem(key) {
      session ??= unlocked;
      assertActive();
      return vaultStorage.getItem(key);
    },
    async setItem(key, value) {
      assertActive();
      return vaultStorage.setItem(key, value);
    },
  };
}
export async function encryptedBackup() { if (!unlocked) throw new Error('سجل الدخول أولاً'); const raw = await AsyncStorage.getItem(VAULT_KEY); if (!raw) throw new Error('لا توجد بيانات'); return raw; }
export async function restoreEncryptedBackup(raw: string, phone: string, password: string) {
  if (operation) throw new Error('جارٍ تنفيذ عملية أخرى'); operation = true;
  let derived: Uint8Array | undefined; let key: Uint8Array | undefined;
  try {
    const v = JSON.parse(raw) as Vault;
    if (v.version !== 1 || v.phone !== normalizePhone(phone) || typeof v.salt !== 'string' || v.salt.length !== 32 || !validKdf(v)) throw new Error('بيانات النسخة الاحتياطية غير صحيحة');
    derived = await passwordKey(password, hexToBytes(v.salt), iterationsOf(v)); key = hexToBytes(decryptText(v.wrappedKey, derived));
    const data = decryptText(v.data, key); if (data && !isLocalSnapshot(JSON.parse(data))) throw new Error('بيانات المكتب غير صالحة');
    await AsyncStorage.setItem(VAULT_KEY, JSON.stringify(v)); lockVault();
  } finally { derived?.fill(0); key?.fill(0); operation = false; }
}
