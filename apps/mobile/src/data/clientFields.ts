import type { Client } from '@maktabi/domain';
import { normalizePhone } from '../auth/phone';

const asciiDigits = (value: string) => value.trim().replace(/[٠-٩۰-۹]/g, d => String((d.charCodeAt(0) & 0xf) % 10));
/** Match the deployed Sudan-first client schema before committing to the local outbox. */
export function canonicalClient(client: Client): Client {
  const phone = normalizePhone(client.phone);
  const whatsapp = normalizePhone(client.whatsapp ?? client.phone);
  if (!phone || !/^\+249[1-9]\d{8}$/.test(phone)) throw new Error('أدخل هاتف العميل السوداني بصيغة 09xxxxxxxx أو +249xxxxxxxxx');
  if (!whatsapp || !/^\+249[1-9]\d{8}$/.test(whatsapp)) throw new Error('أدخل رقم واتساب سوداني صحيحاً');
  const nationalId = client.nationalId ? asciiDigits(client.nationalId) : undefined;
  if (nationalId && !/^\d{3,50}$/.test(nationalId)) throw new Error('رقم الهوية الوطنية يجب أن يحتوي على أرقام فقط، من 3 إلى 50 خانة');
  const value = { ...client, displayName: client.displayName.trim(), phone, whatsapp, nationalId: nationalId || undefined, email: client.email?.trim() || undefined };
  const limits: Partial<Record<keyof Client, number>> = { displayName: 300, address: 1000, contactPerson: 200, registration: 100, notes: 10000 };
  for (const [field, limit] of Object.entries(limits)) {
    const content = value[field as keyof Client];
    if (typeof content === 'string' && content.length > limit) throw new Error('أحد حقول العميل أطول من الحد المسموح؛ اختصر البيانات');
  }
  return value;
}
