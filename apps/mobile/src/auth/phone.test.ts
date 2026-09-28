import { describe, expect, it } from 'vitest';
import { normalizePhone, phoneLoginEmail } from './phone';

describe('normalizePhone', () => {
  it('keeps international numbers', () => {
    expect(normalizePhone('+249 91 234 5678')).toBe('+249912345678');
    expect(normalizePhone('00249912345678')).toBe('+249912345678');
    expect(normalizePhone('+965 5132 5559')).toBe('+96551325559');
  });
  it('treats local Sudan and Kuwait numbers consistently', () => {
    expect(normalizePhone('0912345678')).toBe('+249912345678');
    expect(normalizePhone('912345678')).toBe('+249912345678');
    expect(normalizePhone('51325559')).toBe('+96551325559');
    expect(normalizePhone('51 325 559')).toBe('+96551325559');
  });
  it('accepts Arabic-Indic and Persian digits', () => {
    expect(normalizePhone('٠٩١٢٣٤٥٦٧٨')).toBe('+249912345678');
    expect(normalizePhone('۵۱۳۲۵۵۵۹')).toBe('+96551325559');
  });
  it('rejects invalid input', () => {
    for (const bad of ['', 'abc', '123', '+0123456789', '+1234567890123456']) expect(normalizePhone(bad)).toBeNull();
  });
  it('derives a stable login email', () => {
    expect(phoneLoginEmail('+249912345678')).toBe('p249912345678@phone.maktabi.invalid');
  });
});
