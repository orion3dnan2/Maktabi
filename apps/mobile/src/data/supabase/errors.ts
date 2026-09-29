/**
 * Turns Supabase/PostgREST failures into errors the screens can show as they are:
 * an Arabic message for the user, with the technical code and text kept on the error
 * for diagnosis. Raw server text is never used as the user-facing message.
 */
export type RepositoryErrorKind = 'permission' | 'duplicate' | 'not_found' | 'invalid' | 'connection' | 'session' | 'unknown';

export interface TechnicalDetails { code?: string; status?: number; message?: string; details?: string; hint?: string }

export class RepositoryError extends Error {
  readonly kind: RepositoryErrorKind;
  readonly technical: TechnicalDetails;
  constructor(kind: RepositoryErrorKind, message: string, technical: TechnicalDetails = {}) {
    super(message);
    this.name = 'RepositoryError';
    this.kind = kind;
    this.technical = technical;
  }
}

/** The shape of a supabase-js error result (PostgrestError plus the HTTP status of the response). */
export interface ServerError { code?: string; message?: string; details?: string | null; hint?: string | null }

export const messages = {
  connection: 'تعذر الاتصال بالخادم. تحقق من الإنترنت ثم حاول مجدداً.',
  session: 'انتهت جلسة الدخول. سجّل الدخول مرة أخرى.',
  permission: 'لا تملك صلاحية تنفيذ هذه العملية.',
  notFound: 'السجل غير موجود أو لا تملك صلاحية الوصول إليه.',
  invalid: 'بعض البيانات غير صحيحة؛ راجعها ثم حاول مجدداً.',
  duplicate: 'توجد بيانات مسجلة بالقيمة نفسها.',
  server: 'حدث خطأ في الخادم. حاول لاحقاً.',
  unknown: 'تعذرت العملية. حاول مجدداً.',
} as const;

// Matched against the server message, which names the constraint or carries the text of a guard trigger.
const specific: [RegExp, RepositoryErrorKind, string][] = [
  [/reception can only update client contact details/i, 'permission', 'موظف الاستقبال يستطيع تعديل بيانات التواصل فقط.'],
  [/lawyers can only assign new matters to themselves/i, 'permission', 'يستطيع المحامي إسناد القضايا الجديدة إلى نفسه فقط.'],
  [/only an admin can reassign a matter/i, 'permission', 'تغيير المحامي المسؤول متاح لمدير المكتب فقط.'],
  [/assigned to an active lawyer or admin/i, 'invalid', 'اختر محامياً أو مديراً نشطاً في المكتب.'],
  [/primary client cannot also be listed as a party/i, 'invalid', 'العميل الأساسي لا يُضاف مرة أخرى كطرف في القضية.'],
  [/matters_number_key/i, 'duplicate', 'رقم الملف مستخدم بالفعل في هذا المكتب.'],
  [/clients_identity_uidx/i, 'duplicate', 'رقم الهوية مسجل لعميل آخر في هذا المكتب.'],
  [/matter_parties_client_once_uidx/i, 'duplicate', 'لا يمكن إضافة العميل نفسه إلى القضية أكثر من مرة.'],
  [/matters_client_fk|matter_parties_client_fk/i, 'invalid', 'العميل غير موجود في هذا المكتب.'],
  [/matters_lawyer_fk/i, 'invalid', 'المحامي المختار غير موجود في هذا المكتب.'],
  [/matter_parties_client_or_name/i, 'invalid', 'بيانات أحد أطراف القضية غير مكتملة.'],
  [/clients_(identity_complete|kuwait_civil_id)/i, 'invalid', 'رقم الهوية غير صحيح.'],
  [/clients_(phone|secondary_phone|whatsapp)_check/i, 'invalid', 'رقم الهاتف غير صحيح.'],
  [/clients_email_check/i, 'invalid', 'البريد الإلكتروني غير صحيح.'],
  [/matters_closed_dates/i, 'invalid', 'تاريخ الإغلاق لا يسبق تاريخ فتح القضية.'],
  [/_pkey/i, 'duplicate', 'هذا السجل مستخدم في مكان آخر؛ أعد فتح الصفحة ثم حاول مجدداً.'],
];

/** Maps an error returned by supabase-js (or thrown while calling it) to a RepositoryError. */
export function toRepositoryError(error: ServerError | Error | null | undefined, status?: number): RepositoryError {
  if (error instanceof RepositoryError) return error;
  const source: ServerError = error ?? {};
  const code = source.code ?? '';
  const technical: TechnicalDetails = { code: code || undefined, status, message: source.message, details: source.details ?? undefined, hint: source.hint ?? undefined };
  const text = `${source.message ?? ''} ${source.details ?? ''}`;

  // supabase-js reports a failed fetch as status 0 with the fetch error's text as the message.
  if (status === 0 || /failed to fetch|network request failed|fetch failed|networkerror|load failed/i.test(source.message ?? ''))
    return new RepositoryError('connection', messages.connection, technical);
  if (status === 401 || /^PGRST30\d$/.test(code) || /jwt/i.test(source.message ?? '')) return new RepositoryError('session', messages.session, technical);

  for (const [pattern, kind, message] of specific) if (pattern.test(text)) return new RepositoryError(kind, message, technical);

  switch (code) {
    case '42501': return new RepositoryError('permission', messages.permission, technical);
    case '23505': return new RepositoryError('duplicate', messages.duplicate, technical);
    case '23503': return new RepositoryError('invalid', 'السجل المرتبط غير موجود في هذا المكتب.', technical);
    case '23502': return new RepositoryError('invalid', 'بيانات مطلوبة ناقصة.', technical);
    case '23514': return new RepositoryError('invalid', messages.invalid, technical);
    case '22001': return new RepositoryError('invalid', 'أحد الحقول أطول من المسموح.', technical);
    case '22P02': case '22023': case '22007': case '22008': return new RepositoryError('invalid', 'صيغة البيانات غير صحيحة.', technical);
    case 'P0002': case 'PGRST116': return new RepositoryError('not_found', messages.notFound, technical);
  }
  if (status === 403) return new RepositoryError('permission', messages.permission, technical);
  if (status === 404) return new RepositoryError('not_found', messages.notFound, technical);
  if (status !== undefined && status >= 500) return new RepositoryError('unknown', messages.server, technical);
  return new RepositoryError('unknown', messages.unknown, technical);
}

/** A user-facing message for anything a screen catches. Only our own errors carry text meant for users. */
export function userMessage(error: unknown, fallback: string = messages.unknown): string {
  if (error instanceof RepositoryError) return error.message;
  if (error instanceof Error && /[؀-ۿ]/.test(error.message)) return error.message;
  return fallback;
}
