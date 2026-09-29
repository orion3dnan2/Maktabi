import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizePhone, phoneLoginEmail } from './phone';

describe('normalizePhone (Sudanese numbers only)', () => {
  it('accepts international and local Sudanese forms', () => {
    expect(normalizePhone('+249 91 234 5678')).toBe('+249912345678');
    expect(normalizePhone('00249912345678')).toBe('+249912345678');
    expect(normalizePhone('249912345678')).toBe('+249912345678');
    expect(normalizePhone('0912345678')).toBe('+249912345678');
    expect(normalizePhone('912345678')).toBe('+249912345678');
    expect(normalizePhone('(091) 234-5678')).toBe('+249912345678');
  });
  it('accepts Arabic-Indic and Persian digits', () => {
    expect(normalizePhone('٠٩١٢٣٤٥٦٧٨')).toBe('+249912345678');
    expect(normalizePhone('۰۹۱۲۳۴۵۶۷۸')).toBe('+249912345678');
  });
  it('rejects every non-Sudanese number', () => {
    for (const foreign of ['+965 5132 5559', '51325559', '0096551325559', '+971 50 123 4567', '+20 100 123 4567'])
      expect(normalizePhone(foreign)).toBeNull();
  });
  it('rejects invalid input', () => {
    for (const bad of ['', 'abc', '123', '+249', '+249012345678', '+2499123456789', '09123456x8', '+249 91 234 5678 ext 2'])
      expect(normalizePhone(bad)).toBeNull();
  });
  it('derives a stable login email', () => {
    expect(phoneLoginEmail('+249912345678')).toBe('p249912345678@phone.maktabi.invalid');
  });
  it('is the same rule the manage-users function uses to create accounts', () => {
    const rule = (path: string) => { const source = readFileSync(new URL(path, import.meta.url), 'utf8'); return source.slice(source.indexOf('const EASTERN_DIGITS')); };
    const shared = rule('../../../../packages/domain/src/phone.ts');
    const server = rule('../../../../supabase/functions/manage-users/phone.ts');
    expect(server.startsWith(shared.trimEnd())).toBe(true);
  });
});
