import { describe, expect, it } from 'vitest';
import { emptyOfficeRequest, officeRequestBody, officeRequestProblem, type OfficeRequestForm } from './officeRequest';

const valid: OfficeRequestForm = { ...emptyOfficeRequest, officeName: ' مكتب الأمانة ', adminName: 'سارة عثمان', adminPhone: '0912345678', password: 'secret-pass-1', confirmation: 'secret-pass-1' };
const form = (patch: Partial<OfficeRequestForm>) => ({ ...valid, ...patch });

describe('trial office request form', () => {
  it('accepts a complete request with a Sudanese number in any common format', () => {
    expect(officeRequestProblem(valid)).toBeNull();
    for (const phone of ['+249912345678', '00249912345678', '912345678', '٠٩١٢٣٤٥٦٧٨']) expect(officeRequestProblem(form({ adminPhone: phone }))).toBeNull();
    expect(officeRequestProblem(form({ officePhone: '0155123456', note: 'الخرطوم' }))).toBeNull();
  });
  it('explains what is missing or wrong', () => {
    expect(officeRequestProblem(emptyOfficeRequest)).toMatch('أكمل');
    expect(officeRequestProblem(form({ officeName: '   ' }))).toMatch('أكمل');
    expect(officeRequestProblem(form({ adminPhone: '+96551234567' }))).toMatch('سودانياً');
    expect(officeRequestProblem(form({ officePhone: '123' }))).toMatch('هاتف المكتب');
    expect(officeRequestProblem(form({ password: 'short', confirmation: 'short' }))).toMatch('10');
    expect(officeRequestProblem(form({ confirmation: 'different-pass' }))).toMatch('غير متطابقتين');
    expect(officeRequestProblem(form({ officeName: 'م'.repeat(201) }))).toMatch('طويل');
    expect(officeRequestProblem(form({ note: 'ن'.repeat(501) }))).toMatch('طويلة');
  });
  it('sends trimmed text and leaves phone normalisation to the server', () => {
    expect(officeRequestBody(form({ note: ' ملاحظة ', officePhone: ' ' }))).toEqual({
      office_name: 'مكتب الأمانة', admin_name: 'سارة عثمان', admin_phone: '0912345678', office_phone: '', note: 'ملاحظة', admin_password: 'secret-pass-1',
    });
  });
});
