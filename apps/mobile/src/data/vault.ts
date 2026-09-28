import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRandomBytesAsync } from 'expo-crypto';
import { normalizeArabic } from '@maktabi/domain';
import { bytesToHex, decryptText, encryptText, hexToBytes, passwordKey, type CipherEnvelope } from './crypto';
import { STORAGE_KEY, type LocalStorage } from './localRepositories';
import { defaultOffice } from './office';

const VAULT_KEY = 'maktabi:vault:v1';
interface Vault { version: 1; phone: string; salt: string; wrappedKey: CipherEnvelope; data: CipherEnvelope }
let unlocked: { key: Uint8Array; vault: Vault } | undefined;
let operation = false; let failures = 0; let retryAt = 0;
const normalizePhone = (phone: string) => normalizeArabic(phone).replace(/[\s()-]/g, '');
export const hasVault = async () => !!(await AsyncStorage.getItem(VAULT_KEY));
export const isUnlocked = () => !!unlocked;
const checkPassword = (password: string) => { if (password.length < 12) throw new Error('اختر كلمة مرور لا تقل عن 12 حرفاً'); };
export async function createVault(phoneInput: string, password: string) {
  if (operation) throw new Error('جارٍ تنفيذ عملية الدخول'); operation = true;
  try {
    if (await hasVault()) throw new Error('تم إعداد المكتب بالفعل؛ سجل الدخول');
    const phone = normalizePhone(phoneInput); if (!/^\+?\d{7,15}$/.test(phone)) throw new Error('أدخل رقم هاتف صحيحاً'); checkPassword(password);
    const salt = await getRandomBytesAsync(16); const key = await getRandomBytesAsync(32); const derived = await passwordKey(password, salt);
    const legacy = await AsyncStorage.getItem(STORAGE_KEY);
    // Commit the encrypted copy before removing the legacy key. A failed write leaves the original intact.
    const initial = legacy ?? JSON.stringify({ version: 1, clients: [], matters: [], profiles: [], workflows: [], office: defaultOffice() });
    const vault: Vault = { version: 1, phone, salt: bytesToHex(salt), wrappedKey: encryptText(bytesToHex(key), derived, await getRandomBytesAsync(12)), data: encryptText(initial, key, await getRandomBytesAsync(12)) };
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
    if (vault.version !== 1 || typeof vault.salt !== 'string' || vault.salt.length !== 32) throw new Error('ملف المكتب غير صالح؛ استعد النسخة الاحتياطية');
    let derived: Uint8Array | undefined;
    try {
      derived = await passwordKey(password, hexToBytes(vault.salt));
      const key = hexToBytes(decryptText(vault.wrappedKey, derived));
      if (normalizePhone(phone) !== vault.phone) { key.fill(0); throw new Error('phone'); }
      decryptText(vault.data, key); unlocked = { key, vault }; failures = 0;
    } catch { failures++; if (failures >= 5) retryAt = Date.now() + 60000; throw new Error('رقم الهاتف أو كلمة المرور غير صحيحة'); }
    finally { derived?.fill(0); }
  } finally { operation = false; }
}
export function lockVault() { unlocked?.key.fill(0); unlocked = undefined; }
export const vaultStorage: LocalStorage = {
  async getItem() { if (!unlocked) throw new Error('سجل الدخول لفتح بيانات المكتب'); return decryptText(unlocked.vault.data, unlocked.key) || null; },
  async setItem(_key, value) {
    if (!unlocked) throw new Error('انتهت جلسة المكتب'); const session = unlocked;
    const vault = { ...session.vault, data: encryptText(value, session.key, await getRandomBytesAsync(12)) };
    if (unlocked !== session) throw new Error('انتهت جلسة المكتب');
    await AsyncStorage.setItem(VAULT_KEY, JSON.stringify(vault)); session.vault = vault;
  },
};
export async function encryptedBackup() { if (!unlocked) throw new Error('سجل الدخول أولاً'); const raw = await AsyncStorage.getItem(VAULT_KEY); if (!raw) throw new Error('لا توجد بيانات'); return raw; }
export async function restoreEncryptedBackup(raw: string, phone: string, password: string) {
  if (operation) throw new Error('جارٍ تنفيذ عملية أخرى'); operation = true;
  let derived: Uint8Array | undefined; let key: Uint8Array | undefined;
  try {
    const v = JSON.parse(raw) as Vault;
    if (v.version !== 1 || v.phone !== normalizePhone(phone) || typeof v.salt !== 'string' || v.salt.length !== 32) throw new Error('بيانات النسخة الاحتياطية غير صحيحة');
    derived = await passwordKey(password, hexToBytes(v.salt)); key = hexToBytes(decryptText(v.wrappedKey, derived));
    const data = decryptText(v.data, key); if (data) { const snapshot = JSON.parse(data); if (snapshot.version !== 1 || !Array.isArray(snapshot.clients) || !Array.isArray(snapshot.matters)) throw new Error('بيانات المكتب غير صالحة'); }
    await AsyncStorage.setItem(VAULT_KEY, JSON.stringify(v)); lockVault();
  } finally { derived?.fill(0); key?.fill(0); operation = false; }
}
