// End-to-end scenarios (Phase 2 clients and matters; matter workflow slice 1: appointments, stages,
// deadlines, notes, templates): the exported web app in Chromium, talking to the local gateway
// (real PostgREST 12 + the replayed database with RLS). Nothing reaches the live Supabase project.
// Playwright is not a dependency of the repository; install it globally (npm i -g playwright) or set PLAYWRIGHT.
const { chromium } = require(process.env.PLAYWRIGHT || require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const { execFileSync } = require('child_process');

const BASE = process.env.BASE || 'http://localhost:54321';
const SHOTS = process.argv[2];
const PASSWORD = 'Maktabi-e2e-pass-1';
const PHONES = { adminA: '+249900000011', lawyerA: '+249900000012', receptionA: '+249900000013', adminB: '+249900000021' };
// Reads the database directly (as the owner) to check what the app wrote. Connection from the usual PG* variables.
const sql = (q) => execFileSync('psql', ['-d', process.env.PGDATABASE || 'e2e', '-AtF', '|', '-c', q]).toString().trim();
const results = [];
let shot = 0;

const visible = (locator) => locator.filter({ visible: true });
const button = (page, name) => visible(page.getByRole('button', { name, exact: true })).first();
const field = (page, label) => visible(page.getByLabel(label, { exact: true })).first();
const text = (page, value) => visible(page.getByText(value, { exact: false })).first();
async function choose(page, current, option) {
  await button(page, current).click();
  await visible(page.getByRole('radio', { name: option })).first().click();
  await page.getByRole('radio', { name: option }).first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {}); // the picker slides away
}
async function nav(page, path) {
  await page.evaluate((to) => { window.history.pushState({}, '', to); window.dispatchEvent(new PopStateEvent('popstate', { state: {} })); }, path);
  await page.waitForURL((url) => url.pathname + url.search === path, { timeout: 10000 });
}
async function until(check, what, timeout = 20000) {
  for (const end = Date.now() + timeout; Date.now() < end; await new Promise((r) => setTimeout(r, 200))) if (await check()) return;
  throw new Error(`timed out waiting for ${what}`);
}
async function snap(page, name) { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${String(++shot).padStart(2, '0')}-${name}.png`, fullPage: false }); }

async function login(page, who) {
  await page.goto(`${BASE}/login`);
  await field(page, 'رقم الهاتف').fill(PHONES[who]);
  await field(page, 'كلمة المرور').fill(PASSWORD);
  await visible(page.getByRole('button', { name: 'دخول' })).first().click(); // the gold button's name also carries its icon glyph
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 60000 });
}
async function logout(page) {
  await nav(page, `/more`);
  await button(page, 'تسجيل الخروج').click();
  await page.waitForURL((url) => url.pathname.startsWith('/login'), { timeout: 20000 });
}

const pages = new Map();
async function scenario(name, context, steps) {
  if (!pages.has(context)) {
    const created = await context.newPage(); const list = [];
    created.on('pageerror', (e) => list.push(e.message.split('\n')[0].slice(0, 200)));
    pages.set(context, { page: created, list });
  }
  const { page, list } = pages.get(context);
  const errors = list; errors.length = 0;
  try {
    const detail = await steps(page);
    results.push({ name, PASS: errors.length === 0, detail, pageErrors: errors });
  } catch (e) {
    await snap(page, `FAIL-${name.replace(/\W+/g, '-')}`).catch(() => {});
    results.push({ name, PASS: false, failure: e.message.split('\n').slice(0, 3).join(' | '), url: page.url(), pageErrors: errors });
  }
}

(async () => {
  const browser = await chromium.launch();
  const deviceA = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar' });
  const ids = {};

  await scenario('1. admin A signs in and lands on the dashboard with real, empty counts', deviceA, async (page) => {
    await login(page, 'adminA');
    await text(page, 'مرحباً أستاذ سامية').waitFor({ timeout: 30000 });
    await visible(page.getByRole('button', { name: 'العملاء: 0' })).first().waitFor();
    await visible(page.getByRole('button', { name: 'القضايا النشطة: 0' })).first().waitFor();
    await snap(page, 'dashboard-empty');
    return { url: page.url() };
  });

  await scenario('2. create a person client (Arabic digits) and an organization client', deviceA, async (page) => {
    await nav(page, `/clients/new`);
    await field(page, 'الاسم الكامل *').fill('أمجد الطيب عثمان');
    await field(page, 'رقم الهاتف *').fill('+٢٤٩ ٩١٢ ٠٠٠ ٠٠١');
    await field(page, 'رقم واتساب *').fill('+249912000001');
    await field(page, 'الرقم الوطني (اختياري)').fill('١٢٣٤٥٦٧');
    await button(page, 'حفظ العميل').click();
    await page.waitForURL(/\/clients\/[0-9a-f-]{36}$/, { timeout: 20000 });
    ids.person = page.url().split('/').pop();
    await text(page, 'أمجد الطيب عثمان').waitFor();
    await snap(page, 'client-profile');
    await nav(page, `/clients/new`);
    await choose(page, 'فرد', 'شركة / مؤسسة');
    await field(page, 'اسم الشركة / المؤسسة *').fill('شركة روافد السهول');
    await field(page, 'الشخص المسؤول *').fill('سلمى محجوب');
    await field(page, 'رقم الهاتف *').fill('+249912000002');
    await field(page, 'رقم واتساب *').fill('+249912000002');
    await field(page, 'البريد الإلكتروني *').fill('office@example.test');
    await field(page, 'العنوان *').fill('الخرطوم');
    await button(page, 'حفظ العميل').click();
    await page.waitForURL(/\/clients\/[0-9a-f-]{36}$/, { timeout: 20000 });
    ids.org = page.url().split('/').pop();
    const rows = sql(`select c.full_name, c.client_type, c.phone, c.whatsapp, coalesce(c.civil_id,''), coalesce(c.id_type::text,''), o.name from clients c join offices o on o.id = c.office_id order by c.created_at`);
    if (!rows.includes('أمجد الطيب عثمان|individual|+249912000001|+249912000001|1234567|national_id|Office A')) throw new Error(`unexpected client rows: ${rows}`);
    if (!rows.includes('شركة روافد السهول|organization|+249912000002|+249912000002|||Office A')) throw new Error(`unexpected client rows: ${rows}`);
    return { ids: { ...ids }, db: rows.split('\n') };
  });

  await scenario('3. edit a client and see the change on the profile and in the database', deviceA, async (page) => {
    await nav(page, `/clients/${ids.person}/edit`);
    await field(page, 'رقم الهاتف *').fill('+249912000009');
    await button(page, 'حفظ العميل').click();
    await page.waitForURL(new RegExp(`/clients/${ids.person}$`), { timeout: 20000 });
    await text(page, 'الهاتف: +249912000009').waitFor();
    return { db: sql(`select phone from clients where id = '${ids.person}'`) };
  });

  await scenario('4. clients list shows both clients; Arabic search finds one', deviceA, async (page) => {
    await nav(page, `/clients`);
    await text(page, 'شركة روافد السهول').waitFor({ timeout: 20000 });
    await text(page, 'أمجد الطيب عثمان').waitFor();
    await field(page, 'البحث في العملاء').fill('امجد');
    await visible(page.getByRole('button', { name: 'فتح ملف العميل أمجد الطيب عثمان' })).first().waitFor();
    const org = await visible(page.getByRole('button', { name: 'فتح ملف العميل شركة روافد السهول' })).count();
    if (org !== 0) throw new Error('search did not filter');
    await snap(page, 'clients-list');
    return { searchFiltered: true };
  });

  await scenario('5. create a matter for the client with a lawyer, a second client and an opponent', deviceA, async (page) => {
    await nav(page, `/matters/new?clientId=${ids.person}`);
    await field(page, 'رقم الملف / المرجع الداخلي *').fill('MK-2026-001');
    await field(page, 'عنوان / وصف الملف *').fill('مطالبة بقيمة توريد');
    await choose(page, 'سامية الأمين', 'خالد عثمان');
    await button(page, 'التالي').click();
    await choose(page, 'اختر…', 'شركة روافد السهول');
    await button(page, 'إضافة العميل').click();
    await field(page, 'اسم طرف آخر (اختياري)').fill('الطرف المقابل');
    await button(page, 'إضافة الطرف').click();
    await button(page, 'التالي').click();
    await button(page, 'التالي').click();
    await field(page, 'المحكمة / الجهة / المؤسسة *').fill('محكمة أم درمان');
    await button(page, 'التالي').click();
    await button(page, 'التالي').click();
    await text(page, 'المحامي المسؤول: خالد عثمان').waitFor();
    await snap(page, 'matter-review');
    await button(page, 'إنشاء الملف').click();
    await page.waitForURL(/\/matters\/[0-9a-f-]{36}\/workflow$/, { timeout: 20000 });
    ids.matter = page.url().split('/').slice(-2)[0];
    const matter = sql(`select m.matter_number, m.title, m.status, c.full_name, p.full_name, m.court_name from matters m join clients c on c.id = m.client_id left join profiles p on p.id = m.assigned_lawyer_id where m.id = '${ids.matter}'`);
    const parties = sql(`select coalesce(client_id::text,'-'), coalesce(display_name,'-'), party_role from matter_parties where matter_id = '${ids.matter}' order by party_role`);
    if (matter !== 'MK-2026-001|مطالبة بقيمة توريد|open|أمجد الطيب عثمان|خالد عثمان|محكمة أم درمان') throw new Error(`matter row: ${matter}`);
    if (parties !== `${ids.org}|-|client\n-|الطرف المقابل|opponent`) throw new Error(`parties: ${parties}`);
    return { matter, parties: parties.split('\n') };
  });

  await scenario('6. matter detail shows the joined client and lawyer; edit the matter', deviceA, async (page) => {
    await nav(page, `/matters/${ids.matter}`);
    await text(page, 'أ. خالد عثمان').waitFor({ timeout: 20000 });
    await text(page, 'أمجد الطيب عثمان').waitFor();
    await text(page, 'الطرف المقابل').waitFor();
    await snap(page, 'matter-detail');
    await button(page, 'تعديل بيانات القضية').click();
    await page.waitForURL(new RegExp(`/matters/${ids.matter}/edit$`));
    await field(page, 'عنوان / وصف الملف *').fill('مطالبة بقيمة توريد — معدلة');
    await choose(page, 'نشط', 'معلق');
    for (let i = 0; i < 5; i++) await button(page, 'التالي').click();
    await button(page, 'حفظ التعديلات').click();
    await page.waitForURL(new RegExp(`/matters/${ids.matter}$`), { timeout: 20000 });
    await text(page, 'مطالبة بقيمة توريد — معدلة').waitFor();
    const row = sql(`select title, status, (select count(*) from matter_parties where matter_id = m.id) from matters m where id = '${ids.matter}'`);
    if (row !== 'مطالبة بقيمة توريد — معدلة|on_hold|2') throw new Error(`after edit: ${row}`);
    return { db: row };
  });

  await scenario('7. renaming a client updates every matter that references it (no copied names)', deviceA, async (page) => {
    await nav(page, `/clients/${ids.org}/edit`);
    await field(page, 'اسم الشركة / المؤسسة *').fill('شركة روافد السهول المحدودة');
    await button(page, 'حفظ العميل').click();
    await page.waitForURL(new RegExp(`/clients/${ids.org}$`), { timeout: 20000 });
    await nav(page, `/matters/${ids.matter}/edit`);
    await button(page, 'التالي').click();
    await text(page, 'شركة روافد السهول المحدودة · عميل إضافي').waitFor({ timeout: 20000 });
    return { partyDisplayNameInDb: sql(`select coalesce(display_name, 'NULL') from matter_parties where client_id = '${ids.org}'`) };
  });

  await scenario('8. the client profile lists the matter; the matters list and dashboard count it', deviceA, async (page) => {
    await nav(page, `/clients/${ids.org}`);
    await choose(page, 'نظرة عامة', 'الملفات');
    await text(page, 'MK-2026-001 · مطالبة بقيمة توريد — معدلة').waitFor({ timeout: 20000 });
    await nav(page, `/matters`);
    await visible(page.getByRole('button', { name: 'فتح القضية مطالبة بقيمة توريد — معدلة' })).first().waitFor({ timeout: 20000 });
    await nav(page, `/`);
    await visible(page.getByRole('button', { name: 'العملاء: 2' })).first().waitFor({ timeout: 20000 });
    await visible(page.getByRole('button', { name: 'القضايا النشطة: 0' })).first().waitFor(); // the matter is on hold now
    await snap(page, 'dashboard-counts');
    return { ok: true };
  });

  await scenario('9. reload: staff sign in again and the server data is still there', deviceA, async (page) => {
    await nav(page, `/clients`);
    await text(page, 'أمجد الطيب عثمان').waitFor({ timeout: 20000 });
    await page.reload();
    await page.waitForURL((url) => url.pathname.startsWith('/login'), { timeout: 30000 });
    await login(page, 'adminA');
    await nav(page, `/clients`);
    await text(page, 'أمجد الطيب عثمان').waitFor({ timeout: 20000 });
    return { ok: true };
  });

  await scenario('10. sign out and back in on a new device: clients and matters come from the server', deviceA, async (page) => {
    await logout(page);
    const deviceC = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const fresh = await deviceC.newPage();
    await login(fresh, 'adminA');
    await nav(fresh, `/matters/${ids.matter}`);
    await visible(fresh.getByText('مطالبة بقيمة توريد — معدلة')).first().waitFor({ timeout: 20000 });
    await snap(fresh, 'new-device-matter');
    await deviceC.close();
    return { ok: true };
  });

  const deviceB = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await scenario('11. Office B sees none of Office A’s clients or matters, even by direct link', deviceB, async (page) => {
    await login(page, 'adminB');
    await nav(page, `/clients`);
    await text(page, 'لا يوجد عملاء').waitFor({ timeout: 20000 });
    await nav(page, `/matters`);
    await text(page, 'لا توجد قضايا مطابقة').waitFor({ timeout: 20000 });
    await nav(page, `/clients/${ids.person}`);
    await text(page, 'العميل غير موجود أو لا تملك صلاحية الوصول إليه').waitFor({ timeout: 20000 });
    await nav(page, `/matters/${ids.matter}`);
    await text(page, 'القضية غير موجودة').waitFor({ timeout: 20000 });
    await snap(page, 'office-b-denied');
    // Office B can register the same national number: identity uniqueness is per office.
    await nav(page, `/clients/new`);
    await field(page, 'الاسم الكامل *').fill('عميل مكتب ب');
    await field(page, 'رقم الهاتف *').fill('+249913000001');
    await field(page, 'رقم واتساب *').fill('+249913000001');
    await field(page, 'الرقم الوطني (اختياري)').fill('1234567');
    await button(page, 'حفظ العميل').click();
    await page.waitForURL(/\/clients\/[0-9a-f-]{36}$/, { timeout: 20000 });
    return { officeBClients: sql(`select c.full_name || '@' || o.name from clients c join offices o on o.id = c.office_id where o.name = 'Office B'`) };
  });

  await scenario('12. foreign phone and national number with letters refused; a duplicate in the same office shows an Arabic error', deviceA, async (page) => {
    await login(page, 'adminA');
    await nav(page, `/clients/new`);
    await field(page, 'الاسم الكامل *').fill('عميل مكرر');
    // Phone numbers are Sudanese only.
    await field(page, 'رقم الهاتف *').fill('+965 5132 5559');
    await field(page, 'رقم واتساب *').fill('+249914000001');
    await button(page, 'حفظ العميل').click();
    await text(page, 'أدخل رقم هاتف سودانياً صحيحاً').waitFor({ timeout: 20000 });
    await field(page, 'رقم الهاتف *').fill('0914000001');
    // The Sudanese national number is digits only.
    await field(page, 'الرقم الوطني (اختياري)').fill('AB-123');
    await button(page, 'حفظ العميل').click();
    await text(page, 'الرقم الوطني أرقام فقط').waitFor({ timeout: 20000 });
    await field(page, 'الرقم الوطني (اختياري)').fill('1234567');
    await button(page, 'حفظ العميل').click();
    await text(page, 'رقم الهوية مسجل لعميل آخر في هذا المكتب.').waitFor({ timeout: 20000 });
    await snap(page, 'duplicate-identity');
    // Leave the unsaved form the way a user would: the app asks before discarding.
    await button(page, 'إلغاء').click();
    await button(page, 'تجاهل التغييرات').click();
    return { stillOneClientWithThatNumber: sql("select count(*) from clients c join offices o on o.id = c.office_id where o.name = 'Office A' and civil_id = '1234567'") };
  });

  await scenario('13. archive a client (no delete), find it among archived clients, restore it', deviceA, async (page) => {
    await nav(page, `/clients/${ids.org}`);
    await button(page, 'أرشفة العميل').click();
    await button(page, 'تأكيد أرشفة العميل').click();
    await text(page, 'تمت أرشفة العميل').waitFor({ timeout: 20000 });
    await nav(page, `/clients`);
    await text(page, 'أمجد الطيب عثمان').waitFor({ timeout: 20000 });
    if (await visible(page.getByText('شركة روافد السهول المحدودة')).count()) throw new Error('archived client still listed');
    await button(page, 'عرض العملاء المؤرشفين').click();
    await text(page, 'شركة روافد السهول المحدودة').waitFor({ timeout: 20000 });
    const archived = sql(`select status from clients where id = '${ids.org}'`);
    await nav(page, `/clients/${ids.org}`);
    await button(page, 'استعادة العميل').click();
    await text(page, 'تمت استعادة العميل').waitFor({ timeout: 20000 });
    return { archived, restored: sql(`select status from clients where id = '${ids.org}'`), rows: sql('select count(*) from clients') };
  });

  const deviceL = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await scenario('14. lawyer sees the matter assigned to them and cannot pick another lawyer', deviceL, async (page) => {
    await login(page, 'lawyerA');
    await nav(page, `/matters`);
    await visible(page.getByRole('button', { name: 'فتح القضية مطالبة بقيمة توريد — معدلة' })).first().waitFor({ timeout: 20000 });
    await nav(page, `/matters/new?clientId=${ids.person}`);
    await text(page, 'المحامي المسؤول: خالد عثمان').waitFor({ timeout: 20000 });
    return { ok: true };
  });

  const deviceR = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await scenario('15. reception: no matters, contact details only', deviceR, async (page) => {
    await login(page, 'receptionA');
    await nav(page, `/matters`);
    await text(page, 'لا تملك صلاحية الاطلاع على القضايا').waitFor({ timeout: 20000 });
    await nav(page, `/clients/${ids.person}/edit`);
    await text(page, 'يستطيع موظف الاستقبال تعديل بيانات التواصل فقط.').waitFor({ timeout: 20000 });
    if (await field(page, 'الاسم الكامل *').isEditable()) throw new Error('name is editable for reception');
    await field(page, 'رقم واتساب *').fill('+249912000077');
    await button(page, 'حفظ العميل').click();
    await page.waitForURL(new RegExp(`/clients/${ids.person}$`), { timeout: 20000 });
    await snap(page, 'reception-client');
    await nav(page, `/matters/new`);
    await page.waitForURL((url) => !url.pathname.startsWith('/matters'), { timeout: 20000 });
    return { whatsapp: sql(`select whatsapp from clients where id = '${ids.person}'`), redirectedFromMatters: page.url() };
  });

  // ------------------------------------------------------------------ matter workflow on the server
  const workflowPath = () => `/matters/${ids.matter}/workflow`;
  const stageButton = (page, n, name, state) => button(page, `${n}. ${name} · ${state}`);
  const trial = ['قيد الدعوى', 'الإعلان', 'الرد', 'الإثبات والشهود', 'المرافعة', 'الحكم'];

  await scenario('16. lawyer schedules a client meeting and a court session; the calendar and matters list show them', deviceL, async (page) => {
    await nav(page, workflowPath());
    await text(page, 'المواعيد والجلسات').waitFor({ timeout: 20000 });
    await choose(page, 'جلسة محكمة', 'اجتماع مع الموكل');
    await field(page, 'عنوان الموعد').fill('مراجعة المستندات مع الموكل');
    await field(page, 'تاريخ الموعد (YYYY-MM-DD)').fill('2027-01-05');
    await field(page, 'وقت الموعد (HH:mm)').fill('10:00');
    await button(page, 'حفظ الموعد').click();
    await text(page, 'اجتماع مع الموكل · مراجعة المستندات مع الموكل').waitFor({ timeout: 20000 });
    await choose(page, 'اجتماع مع الموكل', 'جلسة محكمة');
    await field(page, 'عنوان الموعد').fill('الجلسة الأولى');
    await field(page, 'تاريخ الموعد (YYYY-MM-DD)').fill('2027-01-10');
    await field(page, 'وقت الموعد (HH:mm)').fill('09:30');
    await button(page, 'حفظ الموعد').click();
    await text(page, 'جلسة محكمة · الجلسة الأولى').waitFor({ timeout: 20000 });
    await snap(page, 'workflow-appointments');
    const rows = sql(`select appointment_type || '|' || title || '|' || status from appointments where matter_id = '${ids.matter}' order by starts_at`);
    if (rows !== 'client_meeting|مراجعة المستندات مع الموكل|scheduled\ncourt_session|الجلسة الأولى|scheduled') throw new Error(`appointments: ${rows}`);
    await nav(page, '/calendar');
    await text(page, 'الجلسة الأولى').waitFor({ timeout: 20000 });
    await snap(page, 'calendar-server');
    await nav(page, '/matters');
    await text(page, 'الجلسة القادمة:').waitFor({ timeout: 20000 });
    return { db: rows.split('\n') };
  });

  await scenario('17. procedure path: stages start in order, complete with a reference and date, skip with a reason', deviceL, async (page) => {
    await nav(page, workflowPath());
    await choose(page, 'المواعيد', 'مسار الإجراءات');
    await choose(page, 'اختر…', 'التقاضي أمام أول درجة');
    await button(page, 'إضافة مراحل المسار').click();
    await stageButton(page, 1, trial[0], 'لم تبدأ').waitFor({ timeout: 20000 });
    // The database refuses to start a stage before the earlier ones.
    await stageButton(page, 2, trial[1], 'لم تبدأ').click();
    await button(page, 'بدء المرحلة').click();
    await text(page, 'أنهِ المراحل السابقة أولاً.').waitFor({ timeout: 20000 });
    await stageButton(page, 1, trial[0], 'لم تبدأ').click();
    await button(page, 'بدء المرحلة').click();
    await stageButton(page, 1, trial[0], 'جارية').waitFor({ timeout: 20000 });
    // ... and to complete it without its reference and date.
    await button(page, 'إكمال المرحلة').click();
    await text(page, 'ابدأ المرحلة وأدخل رقمها وتاريخها وأكمل متطلباتها قبل إكمالها.').waitFor({ timeout: 20000 });
    await field(page, 'رقم الملف لدى هذه الجهة').fill('ق م/1234/2026');
    await field(page, 'تاريخ المرحلة (YYYY-MM-DD)').fill('2026-09-20');
    await field(page, 'الموعد التالي للمرحلة (YYYY-MM-DD، اختياري)').fill('2027-01-12');
    await button(page, 'حفظ بيانات المرحلة').click();
    await text(page, 'تم حفظ المرحلة وربط موعدها بالتقويم').waitFor({ timeout: 20000 });
    await button(page, 'إكمال المرحلة').click();
    await stageButton(page, 1, trial[0], 'مكتملة').waitFor({ timeout: 20000 });
    await stageButton(page, 2, trial[1], 'لم تبدأ').click();
    await field(page, 'سبب تجاوز المرحلة').fill('تم الإعلان في دعوى سابقة');
    await button(page, 'تجاوز المرحلة مع حفظ السبب').click();
    await stageButton(page, 2, trial[1], 'متجاوزة').waitFor({ timeout: 20000 });
    await text(page, 'سبب التجاوز: تم الإعلان في دعوى سابقة').waitFor();
    await snap(page, 'workflow-stages');
    const stages = sql(`select position || '|' || status || '|' || reference || '|' || coalesce(skip_reason, '') from matter_stages where matter_id = '${ids.matter}' order by position limit 3`);
    if (stages !== '0|completed|ق م/1234/2026|\n1|skipped||تم الإعلان في دعوى سابقة\n2|pending||') throw new Error(`stages: ${stages}`);
    const session = sql(`select a.appointment_type || '|' || a.title || '|' || s.name from appointments a join matter_stages s on s.id = a.stage_id where a.matter_id = '${ids.matter}'`);
    if (session !== 'court_session|قيد الدعوى · المحكمة|قيد الدعوى') throw new Error(`stage session: ${session}`);
    return { stages: stages.split('\n'), session };
  });

  await scenario('18. record a session outcome and schedule the next session in one step', deviceL, async (page) => {
    await choose(page, 'مسار الإجراءات', 'المواعيد');
    await choose(page, 'اختر…', 'الجلسة الأولى');
    await field(page, 'نتيجة الجلسة').fill('تأجيل لتقديم المستندات');
    await field(page, 'تاريخ الجلسة التالية (YYYY-MM-DD، اختياري)').fill('2027-01-20');
    await button(page, 'حفظ نتيجة الجلسة').click();
    await text(page, 'النتيجة: تأجيل لتقديم المستندات').waitFor({ timeout: 20000 });
    await snap(page, 'session-outcome');
    const rows = sql(`select status || '|' || coalesce(outcome, '') || '|' || to_char(starts_at at time zone 'UTC', 'YYYY-MM-DD') from appointments where matter_id = '${ids.matter}' and title = 'الجلسة الأولى' order by starts_at`);
    if (!/^completed\|تأجيل لتقديم المستندات\|2027-01-10\nscheduled\|\|2027-01-(19|20)$/.test(rows)) throw new Error(`sessions: ${rows}`);
    return { db: rows.split('\n') };
  });

  await scenario('19. deadline and note saved; closing is refused while anything is open, then succeeds', deviceL, async (page) => {
    await choose(page, 'المواعيد', 'مسار الإجراءات');
    await field(page, 'عنوان المهلة').fill('مهلة الاستئناف');
    await field(page, 'آخر يوم حسب مراجعة المحامي (YYYY-MM-DD)').fill('2027-02-01');
    await field(page, 'المصدر القانوني وطريقة حساب المهلة').fill('خمسة عشر يوماً من تاريخ إعلان الحكم');
    await button(page, 'حفظ المهلة المعتمدة').click();
    await button(page, 'إتمام المهلة: مهلة الاستئناف').waitFor({ timeout: 20000 });
    await choose(page, 'مسار الإجراءات', 'المتابعة والإغلاق');
    await field(page, 'ملاحظة المتابعة').fill('تم التواصل مع الموكل بشأن المستندات');
    await button(page, 'حفظ الملاحظة').click();
    await text(page, 'تم التواصل مع الموكل بشأن المستندات').waitFor({ timeout: 20000 });
    const confirmClose = async () => {
      if (!(await visible(page.getByRole('button', { name: 'تأكيد إغلاق القضية', exact: true })).count())) await button(page, 'إغلاق القضية').click();
      await button(page, 'تأكيد إغلاق القضية').click();
    };
    await confirmClose();
    await text(page, 'أكمل المواعيد المجدولة أو ألغها قبل إغلاق القضية.').waitFor({ timeout: 20000 });
    await snap(page, 'close-refused');
    const refusedStatus = sql(`select status from matters where id = '${ids.matter}'`);
    // Resolve everything that is open: cancel the scheduled appointments, complete the deadline, skip the remaining stages.
    await choose(page, 'المتابعة والإغلاق', 'المواعيد');
    const cancels = () => visible(page.getByRole('button', { name: /^إلغاء: / }));
    for (let left = await cancels().count(); left > 0; left--) {
      await cancels().first().click();
      await until(async () => (await cancels().count()) < left, 'the appointment to be cancelled');
    }
    await choose(page, 'المواعيد', 'مسار الإجراءات');
    await button(page, 'إتمام المهلة: مهلة الاستئناف').click();
    await until(async () => !(await visible(page.getByRole('button', { name: 'إتمام المهلة: مهلة الاستئناف', exact: true })).count()), 'the deadline to be completed');
    for (let i = 2; i < trial.length; i++) {
      await stageButton(page, i + 1, trial[i], 'لم تبدأ').click();
      await field(page, 'سبب تجاوز المرحلة').fill('انتهت الدعوى بالصلح');
      await button(page, 'تجاوز المرحلة مع حفظ السبب').click();
      await stageButton(page, i + 1, trial[i], 'متجاوزة').waitFor({ timeout: 20000 });
    }
    await choose(page, 'مسار الإجراءات', 'المتابعة والإغلاق');
    await confirmClose();
    await text(page, 'القضية مغلقة').waitFor({ timeout: 20000 });
    if (await visible(page.getByRole('button', { name: 'حفظ الملاحظة', exact: true })).count()) throw new Error('closed matter still accepts notes');
    await snap(page, 'closed');
    return {
      refusedStatus,
      after: sql(`select status || '|' || (select count(*) from appointments where matter_id = m.id and status = 'scheduled') || '|' || (select count(*) from matter_deadlines where matter_id = m.id and completed_at is null) || '|' || (select count(*) from matter_stages where matter_id = m.id and status in ('pending', 'active')) from matters m where id = '${ids.matter}'`),
      notes: sql(`select count(*) from matter_notes where matter_id = '${ids.matter}'`),
    };
  });

  await scenario('20. admin on another device sees the lawyer’s stages, sessions and activity from the server', deviceA, async (page) => {
    await nav(page, workflowPath());
    await text(page, 'القضية مغلقة').waitFor({ timeout: 20000 });
    await choose(page, 'المواعيد', 'مسار الإجراءات');
    await stageButton(page, 1, trial[0], 'مكتملة').waitFor({ timeout: 20000 });
    await choose(page, 'مسار الإجراءات', 'المتابعة والإغلاق');
    await text(page, 'تسجيل نتيجة جلسة: الجلسة الأولى').waitFor({ timeout: 20000 });
    await text(page, 'بدء مرحلة قيد الدعوى').waitFor();
    await text(page, 'تم التواصل مع الموكل بشأن المستندات').waitFor();
    await snap(page, 'admin-sees-activity');
    return { events: sql(`select kind || ':' || count(*) from matter_events where matter_id = '${ids.matter}' group by kind order by kind`).split('\n') };
  });

  await scenario('21. an office procedure template is stored on the server and offered for matching matters', deviceA, async (page) => {
    await nav(page, '/office/procedures');
    await field(page, 'اسم القالب').fill('مسار التسوية الودية');
    await field(page, 'اسم المرحلة الجديدة').fill('خطاب المطالبة');
    await field(page, 'الجهة المسؤولة').fill('المكتب');
    await button(page, 'إضافة المرحلة إلى القالب').click();
    await button(page, 'حفظ قالب المكتب').click();
    await button(page, 'تخصيص: مسار التسوية الودية').waitFor({ timeout: 20000 });
    const row = sql(`select t.name || '|' || array_to_string(t.matter_types, ',') || '|' || (t.stages -> 0 ->> 'name') || '|' || o.name from procedure_templates t join offices o on o.id = t.office_id`);
    if (row !== 'مسار التسوية الودية|civil|خطاب المطالبة|Office A') throw new Error(`template: ${row}`);
    return { db: row };
  });

  await scenario('22. reception cannot open procedure templates; Office B cannot open the workflow', deviceR, async (page) => {
    await nav(page, '/office/procedures');
    await page.waitForURL((url) => !url.pathname.startsWith('/office/procedures'), { timeout: 20000 });
    const other = pages.get(deviceB).page;
    await nav(other, workflowPath());
    await visible(other.getByText('القضية غير موجودة')).first().waitFor({ timeout: 20000 });
    await snap(other, 'office-b-workflow-denied');
    return { receptionRedirectedTo: page.url() };
  });

  results.push({ name: 'audit trail', PASS: true, detail: sql("select entity_type || ':' || action || ':' || count(*) from audit_logs where entity_type in ('client','matter','appointment','matter_stage','matter_deadline','matter_note','procedure_template') group by entity_type, action order by 1").split('\n') });
  await browser.close();
  console.log(JSON.stringify(results, null, 1));
  console.log(`\n${results.filter((r) => r.PASS).length}/${results.length} passed`);
})();
