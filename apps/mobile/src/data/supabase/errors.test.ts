import { describe, expect, it } from 'vitest';
import { messages, RepositoryError, toRepositoryError, userMessage } from './errors';

// Error texts as PostgREST reports them for this schema (see supabase/tests/phase2_clients_matters.sql).
const pg = (code: string, message: string, details: string | null = null) => ({ code, message, details, hint: null });

describe('Arabic error mapping', () => {
  it.each([
    [pg('42501', 'new row violates row-level security policy for table "clients"'), 'permission', messages.permission],
    [pg('42501', 'permission denied for table matters'), 'permission', messages.permission],
    [pg('42501', 'reception can only update client contact details (tried full_name)'), 'permission', 'موظف الاستقبال يستطيع تعديل بيانات التواصل فقط.'],
    [pg('42501', 'lawyers can only assign new matters to themselves'), 'permission', 'يستطيع المحامي إسناد القضايا الجديدة إلى نفسه فقط.'],
    [pg('42501', 'only an admin can reassign a matter'), 'permission', 'تغيير المحامي المسؤول متاح لمدير المكتب فقط.'],
    [pg('23505', 'duplicate key value violates unique constraint "matters_number_key"', 'Key (office_id, matter_number)=(…, MK-1) already exists.'), 'duplicate', 'رقم الملف مستخدم بالفعل في هذا المكتب.'],
    [pg('23505', 'duplicate key value violates unique constraint "clients_identity_uidx"'), 'duplicate', 'رقم الهوية مسجل لعميل آخر في هذا المكتب.'],
    [pg('23505', 'duplicate key value violates unique constraint "matter_parties_client_once_uidx"'), 'duplicate', 'لا يمكن إضافة العميل نفسه إلى القضية أكثر من مرة.'],
    [pg('23505', 'duplicate key value violates unique constraint "matters_pkey"'), 'duplicate', 'هذا السجل مستخدم في مكان آخر؛ أعد فتح الصفحة ثم حاول مجدداً.'],
    [pg('23503', 'insert or update on table "matters" violates foreign key constraint "matters_client_fk"'), 'invalid', 'العميل غير موجود في هذا المكتب.'],
    [pg('23503', 'insert or update on table "matter_parties" violates foreign key constraint "matter_parties_client_fk"'), 'invalid', 'العميل غير موجود في هذا المكتب.'],
    [pg('23514', 'the primary client cannot also be listed as a party'), 'invalid', 'العميل الأساسي لا يُضاف مرة أخرى كطرف في القضية.'],
    [pg('23514', 'matters can only be assigned to an active lawyer or admin of the office'), 'invalid', 'اختر محامياً أو مديراً نشطاً في المكتب.'],
    [pg('23514', 'new row for relation "clients" violates check constraint "clients_whatsapp_check"'), 'invalid', 'رقم الهاتف غير صحيح.'],
    [pg('23514', 'new row for relation "clients" violates check constraint "clients_identity_complete"'), 'invalid', 'رقم الهوية غير صحيح.'],
    [pg('23514', 'new row for relation "clients" violates check constraint "clients_national_id_digits"'), 'invalid', 'الرقم الوطني أرقام فقط.'],
    [pg('22P02', 'invalid input syntax for type uuid: "x"'), 'invalid', 'صيغة البيانات غير صحيحة.'],
    [pg('P0002', 'matter not found'), 'not_found', messages.notFound],
    [pg('PGRST116', 'JSON object requested, multiple (or no) rows returned'), 'not_found', messages.notFound],
  ])('maps %o', (error, kind, message) => {
    const mapped = toRepositoryError(error, 400);
    expect(mapped).toBeInstanceOf(RepositoryError);
    expect(mapped.kind).toBe(kind);
    expect(mapped.message).toBe(message);
    // The technical details are kept for diagnosis, never shown.
    expect(mapped.technical).toMatchObject({ code: error.code, message: error.message, status: 400 });
  });
  it('recognizes network failures and expired sessions', () => {
    expect(toRepositoryError({ message: 'TypeError: Failed to fetch', code: '' }, 0)).toMatchObject({ kind: 'connection', message: messages.connection });
    expect(toRepositoryError(new TypeError('Network request failed'))).toMatchObject({ kind: 'connection' });
    expect(toRepositoryError({ code: 'PGRST301', message: 'JWT expired' }, 401)).toMatchObject({ kind: 'session', message: messages.session });
  });
  it('never shows unknown server text', () => {
    const mapped = toRepositoryError({ code: 'XX000', message: 'internal error: something broke' }, 500);
    expect(mapped).toMatchObject({ kind: 'unknown', message: messages.server });
    expect(toRepositoryError(null)).toMatchObject({ kind: 'unknown', message: messages.unknown });
  });
  it('passes Arabic app errors through and hides others', () => {
    expect(userMessage(new RepositoryError('invalid', 'رسالة'))).toBe('رسالة');
    expect(userMessage(new Error('القضية غير موجودة'))).toBe('القضية غير موجودة');
    expect(userMessage(new Error('storage full'), 'تعذر الحفظ')).toBe('تعذر الحفظ');
    expect(userMessage('text')).toBe(messages.unknown);
  });
});
