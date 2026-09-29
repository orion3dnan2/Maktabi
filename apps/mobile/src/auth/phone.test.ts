import { describe, expect, it } from 'vitest';
import { normalizePhone, phoneLoginEmail } from './phone';

describe('normalizePhone', () => {
  it('keeps international numbers', () => {
    expect(normalizePhone('+249 91 234 5678')).toBe('+249912345678');
    expect(normalizePhone('00249912345678')).toBe('+249912345678');
    expect(normalizePhone('+971 50 123 4567')).toBe('+971501234567');
  });
  it('treats local numbers as Sudanese only', () => {
    expect(normalizePhone('0912345678')).toBe('+249912345678');
    expect(normalizePhone('912345678')).toBe('+249912345678');
    // 8 digits was a Kuwait shortcut; the app is Sudan-only, so it is no longer guessed.
    expect(normalizePhone('51325559')).toBeNull();
    expect(normalizePhone('51 325 559')).toBeNull();
  });
  it('accepts Arabic-Indic and Persian digits', () => {
    expect(normalizePhone('٠٩١٢٣٤٥٦٧٨')).toBe('+249912345678');
    expect(normalizePhone('۰۹۱۲۳۴۵۶۷۸')).toBe('+249912345678');
  });
  it('rejects invalid input', () => {
    for (const bad of ['', 'abc', '123', '+0123456789', '+1234567890123456']) expect(normalizePhone(bad)).toBeNull();
  });
  it('derives a stable login email', () => {
    expect(phoneLoginEmail('+249912345678')).toBe('p249912345678@phone.maktabi.invalid');
  });
});
