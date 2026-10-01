// manage-users: the only place accounts are created (the app has no sign-up).
//
// Actions (POST JSON { action, ... }):
//   bootstrap_owner      one-time: first platform owner, needs the bootstrap code
//   create_office        platform owner: new office + its first admin
//   create_member        office admin: admin / lawyer / employee / reception
//   create_client_login  office admin or employee: portal login for a client record
//   reset_password       platform owner, office admin, or employee (client logins only)
//   request_office       anyone: a trial office + its admin, pending until the platform owner approves it
//   review_office_request platform owner: approve or reject a pending request (rejection releases the phone)
//
// Deployed with verify_jwt = false because the app uses the new publishable key
// (not a JWT) before sign-in; every action except bootstrap_owner and request_office
// verifies the caller's session token here. Authorisation decisions live in the svc_* SQL
// functions, which only service_role can execute.
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { normalizePhone, phoneLoginEmail } from './phone.ts';
import { padOfficeRequest } from './requestTiming.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

function serviceKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) { const parsed = JSON.parse(keys) as Record<string, string>; const key = parsed.default ?? Object.values(parsed)[0]; if (key) return key; }
  throw new Error('Service key is not configured');
}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } });

const STAFF_ROLES = ['admin', 'lawyer', 'employee', 'reception'] as const;
type Body = Record<string, unknown>;

const text = (body: Body, key: string, label: string, max = 200): string => {
  const value = typeof body[key] === 'string' ? (body[key] as string).trim() : '';
  if (!value) throw new HttpError(400, 'validation', `${label} مطلوب`);
  if (value.length > max) throw new HttpError(400, 'validation', `${label} طويل جداً`);
  return value;
};
const optionalText = (body: Body, key: string, max = 200): string | null => {
  const value = typeof body[key] === 'string' ? (body[key] as string).trim() : '';
  return value ? value.slice(0, max) : null;
};
const phone = (body: Body, key: string): string => {
  const value = normalizePhone(typeof body[key] === 'string' ? (body[key] as string) : '');
  if (!value) throw new HttpError(400, 'validation', 'رقم الهاتف غير صحيح؛ أدخل رقم هاتف سودانياً');
  return value;
};
const optionalPhone = (body: Body, key: string, label: string): string | null => {
  const input = optionalText(body, key, 30);
  if (!input) return null;
  const value = normalizePhone(input);
  if (!value) throw new HttpError(400, 'validation', `${label} غير صحيح؛ أدخل رقم هاتف سودانياً`);
  return value;
};
const password = (body: Body, key = 'password'): string => {
  const value = typeof body[key] === 'string' ? (body[key] as string) : '';
  // Same minimum as MIN_PASSWORD_LENGTH in apps/mobile/src/data/vault.ts (the password also encrypts the device workspace).
  if (value.length < 10) throw new HttpError(400, 'validation', 'كلمة المرور يجب ألا تقل عن 10 أحرف');
  if (value.length > 72) throw new HttpError(400, 'validation', 'كلمة المرور طويلة جداً');
  return value;
};

const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
async function sha256Hex(value: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

/**
 * Keyed hash of the caller's IP for the office request limits; the IP itself is never stored.
 * Only headers set by the platform's proxies are used: the first X-Forwarded-For entry is
 * whatever the client sent. Without one, only the global limits apply.
 */
async function sourceHash(req: Request): Promise<string | null> {
  const ip = (req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? '').trim();
  if (!ip) return null;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(serviceKey()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip)));
}

const REQUEST_LIMITS: Record<string, string> = {
  queue_full: 'طلبات المكاتب الجديدة مكتملة حالياً. حاول لاحقاً أو تواصل مع إدارة المنصة.',
  daily_limit: 'استقبلنا طلبات كثيرة اليوم. حاول مجدداً غداً أو تواصل مع إدارة المنصة.',
  too_many: 'أُرسلت طلبات كثيرة من هذا الاتصال اليوم. حاول مجدداً غداً.',
};
const limitError = (code: string) => new HttpError(429, code, REQUEST_LIMITS[code] ?? REQUEST_LIMITS.queue_full);

function dbError(error: { code?: string; message: string }): HttpError {
  switch (error.code) {
    case '42501': return new HttpError(403, 'forbidden', 'ليست لديك صلاحية لهذه العملية');
    case '23505': return new HttpError(409, 'conflict', 'هذا الحساب مرتبط بمكتب مسبقاً');
    case 'P0002': return new HttpError(404, 'not_found', 'العنصر المطلوب غير موجود');
    case '54000': return limitError(Object.keys(REQUEST_LIMITS).find((code) => error.message.includes(code)) ?? 'queue_full');
    case '22023': case '23514': return new HttpError(400, 'validation', 'بيانات غير صالحة');
    default: console.error('db error', error); return new HttpError(500, 'db_error', 'تعذر إكمال العملية');
  }
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw dbError(error);
  return data as T;
}

async function callerId(req: Request): Promise<string> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'unauthenticated', 'سجل الدخول أولاً');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'unauthenticated', 'انتهت الجلسة؛ سجل الدخول مجدداً');
  return data.user.id;
}

async function actorInfo(actor: string): Promise<{ platform_admin: boolean; role: string | null }> {
  return await rpc('svc_actor_info', { p_actor: actor });
}

/** Creates the auth user, then runs `link`; deletes the user again if linking fails. */
async function withNewUser<T>(e164: string, secret: string, fullName: string, link: (userId: string) => Promise<T>): Promise<{ userId: string; result: T }> {
  const { data, error } = await admin.auth.admin.createUser({
    email: phoneLoginEmail(e164), password: secret, email_confirm: true,
    user_metadata: { full_name: fullName, phone: e164 },
  });
  if (error || !data.user) {
    // Match the cause, not the status: Auth also answers 422 for a weak or leaked password.
    if (error?.code === 'weak_password') throw new HttpError(400, 'weak_password', 'كلمة المرور ضعيفة أو ظهرت في تسريبات سابقة؛ اختر كلمة مرور أخرى');
    if (error && (error.code === 'email_exists' || error.code === 'user_already_exists' || /already (been )?registered|already exists/i.test(error.message))) throw new HttpError(409, 'phone_taken', 'رقم الهاتف مسجّل لحساب آخر');
    console.error('createUser failed', error);
    throw new HttpError(400, 'auth_error', 'تعذر إنشاء الحساب');
  }
  try {
    return { userId: data.user.id, result: await link(data.user.id) };
  } catch (e) {
    const cleanup = await admin.auth.admin.deleteUser(data.user.id);
    if (cleanup.error) console.error('cleanup failed', cleanup.error);
    throw e;
  }
}

async function handle(req: Request, body: Body): Promise<Record<string, unknown>> {
  switch (body.action) {
    case 'bootstrap_owner': {
      const code = text(body, 'code', 'رمز الإعداد', 100);
      const hash = await sha256Hex(code);
      if (!(await rpc<boolean>('svc_bootstrap_code_valid', { p_code_hash: hash }))) throw new HttpError(403, 'bad_code', 'رمز الإعداد غير صحيح أو سبق استخدامه');
      const fullName = text(body, 'full_name', 'الاسم'); const e164 = phone(body, 'phone');
      const { userId } = await withNewUser(e164, password(body), fullName, async (id) => {
        if (!(await rpc<boolean>('svc_bootstrap_owner', { p_code_hash: hash, p_user: id, p_full_name: fullName, p_phone: e164 }))) throw new HttpError(403, 'bad_code', 'رمز الإعداد غير صحيح أو سبق استخدامه');
      });
      return { user_id: userId, phone: e164 };
    }
    case 'create_office': {
      const actor = await callerId(req);
      if (!(await actorInfo(actor)).platform_admin) throw new HttpError(403, 'forbidden', 'هذه العملية لمالك المنصة فقط');
      const officeName = text(body, 'office_name', 'اسم المكتب'); const adminName = text(body, 'admin_name', 'اسم مدير المكتب');
      const e164 = phone(body, 'admin_phone'); const officePhone = optionalPhone(body, 'office_phone', 'هاتف المكتب');
      const { userId, result } = await withNewUser(e164, password(body, 'admin_password'), adminName, (id) => rpc<string>('svc_create_office', {
        p_actor: actor, p_admin: id, p_admin_name: adminName, p_admin_phone: e164,
        p_name: officeName, p_name_ar: optionalText(body, 'office_name_ar'), p_phone: officePhone,
      }));
      return { office_id: result, admin_user_id: userId, admin_phone: e164 };
    }
    case 'create_member': {
      const actor = await callerId(req);
      if ((await actorInfo(actor)).role !== 'admin') throw new HttpError(403, 'forbidden', 'إضافة الموظفين لمدير المكتب فقط');
      const role = body.role as string;
      if (!STAFF_ROLES.includes(role as typeof STAFF_ROLES[number])) throw new HttpError(400, 'validation', 'اختر دوراً صحيحاً');
      const fullName = text(body, 'full_name', 'الاسم'); const e164 = phone(body, 'phone');
      const { userId } = await withNewUser(e164, password(body), fullName, (id) => rpc('svc_add_member', { p_actor: actor, p_user: id, p_role: role, p_full_name: fullName, p_phone: e164 }));
      return { user_id: userId, phone: e164 };
    }
    case 'create_client_login': {
      const actor = await callerId(req);
      const role = (await actorInfo(actor)).role;
      if (role !== 'admin' && role !== 'employee') throw new HttpError(403, 'forbidden', 'إنشاء دخول الموكل للمدير أو الموظف فقط');
      const clientId = text(body, 'client_id', 'الموكل', 64); const e164 = phone(body, 'phone');
      const { userId } = await withNewUser(e164, password(body), 'موكل', (id) => rpc('svc_link_client_login', { p_actor: actor, p_user: id, p_client: clientId, p_phone: e164 }));
      return { user_id: userId, phone: e164 };
    }
    case 'reset_password': {
      const actor = await callerId(req);
      const target = text(body, 'user_id', 'المستخدم', 64); const secret = password(body);
      if (!(await rpc<boolean>('svc_can_manage_user', { p_actor: actor, p_target: target }))) throw new HttpError(403, 'forbidden', 'ليست لديك صلاحية على هذا الحساب');
      const { error } = await admin.auth.admin.updateUserById(target, { password: secret });
      if (error) { console.error('reset failed', error); throw new HttpError(400, 'auth_error', 'تعذر تغيير كلمة المرور'); }
      return { user_id: target };
    }
    case 'request_office': {
      // No session: anyone may ask. The office is created 'pending' and its admin can do
      // nothing (RLS needs an active office) until the platform owner approves it.
      const officeName = text(body, 'office_name', 'اسم المكتب'); const adminName = text(body, 'admin_name', 'اسم مدير المكتب');
      const e164 = phone(body, 'admin_phone'); const officePhone = optionalPhone(body, 'office_phone', 'هاتف المكتب');
      const note = optionalText(body, 'note', 500); const secret = password(body, 'admin_password');
      const source = await sourceHash(req);
      const attemptLimit = await rpc<string | null>('svc_consume_office_request_attempt', { p_source_hash: source });
      if (attemptLimit) throw limitError(attemptLimit);
      const limit = await rpc<string | null>('svc_office_request_limit', { p_source_hash: source });
      if (limit) throw limitError(limit);
      try {
        await withNewUser(e164, secret, adminName, (id) => rpc<string>('svc_request_office', {
          p_user: id, p_admin_name: adminName, p_admin_phone: e164, p_name: officeName, p_phone: officePhone, p_note: note, p_source_hash: source,
        }));
      } catch (e) {
        // Same answer as a new request, so this public action does not reveal which numbers have accounts.
        if (!(e instanceof HttpError && e.code === 'phone_taken')) throw e;
      }
      return { admin_phone: e164, status: 'pending' };
    }
    case 'review_office_request': {
      const actor = await callerId(req);
      if (!(await actorInfo(actor)).platform_admin) throw new HttpError(403, 'forbidden', 'هذه العملية لمالك المنصة فقط');
      const officeId = text(body, 'office_id', 'المكتب', 64);
      if (typeof body.approve !== 'boolean') throw new HttpError(400, 'validation', 'اختر الموافقة أو الرفض');
      const requester = await rpc<string>('svc_review_office_request', { p_actor: actor, p_office: officeId, p_approve: body.approve });
      if (body.approve) return { office_id: officeId, status: 'active' };
      // A rejected request must not keep its phone number: move the login to an address
      // nobody can type, so the number can be used for a new request or by an office.
      const { error } = await admin.auth.admin.updateUserById(requester, { email: `r${requester.replace(/-/g, '')}@rejected.maktabi.invalid`, email_confirm: true });
      if (error) console.error('release phone failed', error);
      return { office_id: officeId, status: 'rejected', phone_released: !error };
    }
    default:
      throw new HttpError(400, 'unknown_action', 'عملية غير معروفة');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (status: number, payload: unknown) => new Response(JSON.stringify(payload), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return json(405, { ok: false, code: 'method', message: 'POST only' });
  const startedAt = Date.now();
  let isOfficeRequest = false;
  try {
    const body = await req.json().catch(() => { throw new HttpError(400, 'bad_json', 'طلب غير صالح'); }) as Body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'bad_json', 'طلب غير صالح');
    isOfficeRequest = body.action === 'request_office';
    const result = await handle(req, body);
    if (isOfficeRequest) await padOfficeRequest(startedAt);
    return json(200, { ok: true, ...result });
  } catch (e) {
    if (isOfficeRequest) await padOfficeRequest(startedAt);
    if (e instanceof HttpError) return json(e.status, { ok: false, code: e.code, message: e.message });
    console.error('unexpected', e);
    return json(500, { ok: false, code: 'internal', message: 'حدث خطأ غير متوقع' });
  }
});
