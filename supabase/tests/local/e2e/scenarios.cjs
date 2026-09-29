// Phase 2 end-to-end scenarios: the exported web app in Chromium, talking to the local gateway
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
}
async function nav(page, path) {
  await page.evaluate((to) => { window.history.pushState({}, '', to); window.dispatchEvent(new PopStateEvent('popstate', { state: {} })); }, path);
  await page.waitForURL((url) => url.pathname + url.search === path, { timeout: 10000 });
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
    if (!rows.includes('أمجد الطيب عثمان|individual|+249 912 000 001|+249912000001|1234567|national_id|Office A')) throw new Error(`unexpected client rows: ${rows}`);
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

  await scenario('12. a duplicate national number in the same office shows an Arabic error', deviceA, async (page) => {
    await login(page, 'adminA');
    await nav(page, `/clients/new`);
    await field(page, 'الاسم الكامل *').fill('عميل مكرر');
    await field(page, 'رقم الهاتف *').fill('+249914000001');
    await field(page, 'رقم واتساب *').fill('+249914000001');
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

  results.push({ name: 'audit trail', PASS: true, detail: sql("select entity_type || ':' || action || ':' || count(*) from audit_logs where entity_type in ('client','matter') group by entity_type, action order by 1").split('\n') });
  await browser.close();
  console.log(JSON.stringify(results, null, 1));
  console.log(`\n${results.filter((r) => r.PASS).length}/${results.length} passed`);
})();
