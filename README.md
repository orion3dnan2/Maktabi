# مكتبي — Maktabi

> **Live Implementation Roadmap — آخر مراجعة: 2026-10-01**
>
> هذا الملف هو مصدر الحقيقة لحالة تنفيذ المشروع. يجب تحديثه في نفس الـPR/commit عند إكمال أي مرحلة أو صفحة أو تغيير حالة اختبار. لا تعتبر أي ميزة "مكتملة" لمجرد أن واجهتها موجودة.

تطبيق عربي أولاً لإدارة مكاتب المحامين في السودان: العملاء، القضايا ومساراتها، الجلسات، المستندات، الأتعاب والإيصالات، المصروفات وأمانة العميل، التوثيقات، المكتبة والصيغ القانونية، ثم المساعد الذكي والتواصل عبر واتساب.

> المصادقة والصلاحيات (Supabase + RLS) منفذة في المرحلة 1. منذ المرحلة 2 تُحفظ بيانات **العملاء والقضايا وأطرافها** في Supabase مع RLS. أما المواعيد والمستندات والأتعاب والإيصالات والمصروفات ومراحل الإجراءات فما زالت محلية مشفّرة على الجهاز دون مزامنة، فلا تُدخل بيانات موكلين حقيقية بعد.

التطبيق الأساسي: **React Native + Expo + TypeScript + Expo Router** داخل `apps/mobile`.

## الحالة الحالية المختصرة

| المجال | الحالة | الملاحظة |
|---|---|---|
| Expo/React Native foundation | ✅ منجز | Expo SDK 57 + TypeScript + Expo Router |
| Arabic RTL design system | ✅ منجز | Tajawal + Navy/Gold tokens + reusable UI |
| Splash + routing | ✅ منجز | يفحص Supabase session ثم يوجّه حسب الدور (RouteGuard) |
| Supabase client | ✅ منجز | SecureStore مقسّم لأجزاء على iOS/Android + localStorage على الويب |
| Login | 🟡 جزئي | دخول حقيقي برقم الهاتف وكلمة المرور؛ مدير المكتب يعيّن كلمة مرور جديدة؛ لا استعادة ذاتية؛ «اطلب مكتباً تجريبياً» من شاشة الدخول |
| Office / profiles / membership | 🟡 جزئي | المرحلة 1: مالك المنصة ← مكتب ومديره ← أعضاء عبر Edge Function `manage-users` ([التفاصيل](docs/phase-1-accounts.md))؛ طلب مكتب تجريبي يبقى معلقاً حتى موافقة مالك المنصة (مطبّق على المشروع 2026-10-01) |
| RBAC / permissions | 🟡 جزئي | أدوار المكتب ودور الموكل `client` + RLS؛ العملاء والقضايا وأطرافها على Supabase ومختبرة (`phase1_access.sql` + `phase2_clients_matters.sql`)؛ المواعيد/المستندات/المدفوعات لم تُربط بجداولها بعد |
| Clients UI | 🟡 جزئي | List/Create/Edit/Profile/أرشفة واستعادة على Supabase (بلا حذف)؛ الاستقبال يعدّل بيانات التواصل فقط؛ الأتعاب والإيصالات والمستندات في الملف من الجهاز؛ لا offline/sync |
| Matters UI | 🟡 جزئي | List/Create/Edit/Details/أرشفة على Supabase، مع المحامي المسؤول والأطراف المرتبطة بسجلات العملاء؛ مسار القضية (مواعيد/مستندات/أتعاب/مراحل) ما زال على الجهاز؛ لا offline/sync |
| Dashboard | 🟡 جزئي | عدد العملاء والقضايا النشطة من Supabase واسم المستخدم الحقيقي؛ الجلسات والمهل والأتعاب والنشاط من بيانات الجهاز (موضّح في الشاشة) |
| Calendar / sessions | 🟡 جزئي | القضايا من Supabase والمواعيد من مسار القضية على الجهاز (غير متزامنة) |
| Documents/scanner | ❌ غير منفذ | Domain model أولي فقط |
| Fees/payments/receipts | ❌ غير منفذ | Domain types أولية فقط |
| Expenses/client trust | ❌ غير منفذ | Domain types أولية فقط |
| Offline database/sync | ❌ غير منفذ | لا توجد queue/conflict engine؛ العملاء والقضايا تحتاج اتصالاً، ومسار القضية محلي فقط |
| Audit log | 🟡 جزئي | triggers في القاعدة تسجل إنشاء وتعديل العملاء والقضايا في `audit_logs` (مختبر)؛ لا توجد شاشة |
| Notarization | ❌ غير منفذ | غير منفذ |
| Legal library/templates | ❌ غير منفذ | غير منفذ |
| AI assistant | ❌ غير منفذ | مؤجل عمداً حتى استقرار البيانات والمكتبة |
| Subscriptions | ❌ غير منفذ | غير منفذ |
| WhatsApp integration | ❌ غير منفذ | غير منفذ |
| Automated tests | 🟡 جزئي | Domain/auth/storage/repository tests + اختبارات RLS في SQL + فحص E2E محلي للعملاء والقضايا (`supabase/tests/local/e2e`)؛ لا يوجد offline suite ولا CI للقاعدة |

**التقييم الحالي:** Supabase Auth والأدوار منفذة في المرحلة 1، والعملاء والقضايا أصبحت على Supabase في المرحلة 2 (RLS هو الحماية الفعلية). ما زال مسار القضية (المواعيد والمستندات والأتعاب والإيصالات والمصروفات والمراحل) محلياً على الجهاز، ولا توجد مزامنة أو عمل دون اتصال. الأولوية التالية نقل مسار القضية إلى جداول Supabase المقابلة ثم بناء طبقة offline/sync.

---

## ما تم التحقق منه في الكود

- `apps/mobile/src/lib/supabase.ts`: Supabase client حقيقي، session محفوظ في Expo SecureStore على iOS/Android (مقسّم لأجزاء لأن الجلسة أكبر من حد 2KB) وفي `localStorage` على الويب.
- `apps/mobile/app/_layout.tsx` + `src/auth/AuthProvider.tsx`: RouteGuard يوجّه حسب الدور. استعادة الجلسة عند التشغيل محدودة بـ 10 ثوانٍ عبر `src/lib/settleWithin.ts`؛ أي فشل في التخزين أو session تالف أو انتظار أطول يوجّه إلى `/login` بدلاً من تعليق شاشة البداية.
- `apps/mobile/app/(auth)/login.tsx`: دخول برقم الهاتف (يتحول إلى بريد داخلي) عبر `signInWithPassword`.
- `supabase/migrations/2026092817*` + `supabase/functions/manage-users/` + `supabase/tests/phase1_access.sql`: الأدوار وRLS وإنشاء الحسابات من الخادم (المرحلة 1).
- `apps/mobile/src/data/repositories.ts`: نقطة الوصول الوحيدة للبيانات من الشاشات. `clientRepository` و`matterRepository` من `src/data/supabase/` (Supabase مع أنواع مولّدة في `src/lib/database.types.ts` وأخطاء عربية في `errors.ts`)؛ لا تستدعي شاشات العملاء والقضايا Supabase مباشرة.
- `apps/mobile/src/data/localStore.ts` + `localRepositories.ts` + `vault.ts`: مسار كل قضية وإعدادات المكتب في مساحة محلية مشفّرة لكل مستخدم، مفهرسة بمعرّف القضية على الخادم. كل كتابة فيها تقرأ القضية من الخادم أولاً (الوجود والصلاحية والحالة)، وإغلاق القضية يغيّر حالتها على الخادم أولاً.
- `apps/mobile/src/data/dashboard.ts`: ملخص Dashboard من بيانات حقيقية (الأعداد من الخادم، والباقي من الجهاز).
- `apps/mobile/app/(tabs)/calendar.tsx`: القضايا من الخادم ومواعيدها من الجهاز.
- `supabase/migrations/20260929081219_phase2_clients_matters.sql` + `supabase/tests/phase2_clients_matters.sql`: عقد المرحلة 2 واختبار العزل والصلاحيات.
- `packages/domain/src/index.ts`: نماذج أولية جيدة لـOffice/User/Client/Matter/Workflow/Session/Deadline/Document/Fees/Payment/Receipt/Expense/Trust.
- `packages/domain/src/clientsMatters.ts`: Arabic normalization/search + validation للقضايا والعملاء.
- `packages/domain/src/clientsMatters.test.ts`: اختبارات Domain موجودة للعملاء والقضايا.
- `packages/ui/src/theme.ts`: Design tokens وRTL foundation موجودان.
- `docs/ui-visual-spec.md`: Visual lock موثق.

### معمارية البيانات بعد المرحلة 2

- **مصدر حقيقة واحد لكل نوع بيانات:** العملاء والقضايا وأطرافها في Supabase فقط. مسار القضية وإعدادات المكتب على الجهاز فقط (مفهرسة بمعرّف القضية على الخادم). لا توجد نسختان متنافستان من البيانات نفسها.
- **المكتب يحدده الخادم:** المستودعات لا ترسل `office_id`؛ القيمة الافتراضية للعمود وRLS تأخذانه من جلسة المستخدم. `OFFICE_ID` في `src/data/ids.ts` مجرد وسيط لواجهات الـDomain ولا يُستخدم في الاستعلامات.
- **بلا حذف:** العملاء والقضايا تُؤرشف بتغيير الحالة، ولا توجد أي عملية `delete` في مستودعات التطبيق.
- **المعرّفات UUID من الجهاز** (`expo-crypto`) فتبقى ثابتة قبل الحفظ وبعده، وتصلح لطبقة مزامنة لاحقة.
- **دون اتصال:** لا يعمل إنشاء العملاء والقضايا أو قراءتها دون اتصال (تظهر رسالة اتصال عربية). واجهات `ClientRepository`/`MatterRepository` في `packages/domain` مستقلة عن Supabase، فيمكن لاحقاً وضع طبقة offline/sync خلفها دون تغيير الشاشات.
- **بيانات الجهاز القديمة:** مساحات الإصدار 1 (قبل المرحلة 2) التي كانت تحفظ العملاء والقضايا محلياً تُرقّى إلى الإصدار 2؛ تُحفظ سجلاتها القديمة مشفّرة كما هي تحت `legacy` دون عرض أو مزامنة، ولا تُستورد تلقائياً إلى الخادم.

### فجوة يجب إصلاحها

الـREADME القديم كان يقول إن المصادقة غير منفذة، بينما الكود الحالي يحتوي Supabase Auth فعلي. لذلك هذا الملف يجب أن يتغير دائماً مع التنفيذ ولا يُترك خلف الكود.

**Migrations متطابقة مع قاعدة البيانات:** تمت استعادة migrations الست الأساسية المفقودة من سجل Supabase المطبق، وتصحيح أرقام إصدارات migrations المرحلة 1 لتطابق سجل القاعدة. تم التحقق (2026-09-29) من أن ملفات الـmigrations الثلاثة عشر مطابقة حرفياً لسجل المشروع، ومن replay كامل بالترتيب على PostgreSQL 17 نظيفة باستخدام `supabase/tests/local/supabase_stub.sql`، مع نجاح اختبارات القاعدة على النسخة المحلية وعلى المشروع.

**طلب مكتب تجريبي (2026-10-01، مطبّق على المشروع):** من شاشة الدخول ← «اطلب مكتباً تجريبياً» (`app/(auth)/request-office.tsx`) يرسل اسم المكتب واسم المدير ورقم هاتفه وكلمة مروره إلى `manage-users` (`request_office`، بلا جلسة). الدالة تنشئ الحساب والمكتب بحالة `pending` عبر `svc_request_office`؛ المكتب المعلّق أو المرفوض لا يعطي أي صلاحية لأن كل سياسات RLS تمر عبر `current_office_id()` التي تقبل المكاتب النشطة فقط. مالك المنصة يرى الطلبات في `/platform` ويقرر عبر `manage-users` (`review_office_request` ← `svc_review_office_request`): الموافقة تفعّل المكتب، والرفض نهائي ويحرّر رقم الهاتف. القرار ومن اتخذه في `private.office_requests` و`audit_logs`. حدود الإساءة: 20 طلباً معلقاً، و30 طلباً يومياً للكل، و3 يومياً من المصدر نفسه (بصمة مفتاحية لعنوان IP من ترويسة يضعها الوسيط، لا يُحفظ العنوان)؛ الرقم المسجّل مسبقاً يأخذ الرد نفسه. اختبار القاعدة: `supabase/tests/office_requests.sql` (55 فحصاً، نجحت محلياً وعلى المشروع). Migrations `20261001092958_office_request_statuses` و`20261001093321_trial_office_requests` و`manage-users` الإصدار 7 مطبّقة على المشروع.

**قاعدة البيانات الحية متقدمة على المستودع:** المشروع فيه 10 migrations (من `20260929111235_matter_workflow_stages_deadlines_notes` حتى `20260930104724_preserve_structured_matter_details`) ليست في `main`؛ الأولى فقط موجودة في فرع `claude/determined-newton-5a1kyb`. أهمها `20260930081909_office_membership_versioned_case_sync` الذي جعل الصلاحيات تمر عبر جدول `office_members`. يجب أن تُضاف ملفاتها إلى المستودع من الجلسة التي طبقتها قبل أي replay أو CI للقاعدة.

**التطبيق سوداني فقط (قرار منتج 2026-09-29):** أزالت migration `20260929093954_sudan_only_defaults` كل القيم الكويتية من المخطط الأساسي: القيم الافتراضية للمكتب والمدفوعات أصبحت `SD` و`SDG` و`Africa/Khartoum`، ومبالغ المدفوعات بمنزلتين عشريتين، وسنة ترقيم القضايا بتوقيت الخرطوم، وحُذف قيد الرقم المدني الكويتي، وأصبحت وسيلة الدفع `knet` هي `bankak` (بنكك). «الرقم الوطني» هو الرقم الوطني السوداني: أرقام فقط وبلا طول محدد، ويُحفظ بنوع `national_id` ودولة `SD` (مفروض في التطبيق وفي القاعدة). **كل أرقام الهواتف سودانية فقط** (migration `20260929100948_sudanese_phone_numbers`): تُحفظ بصيغة `+249` وتسعة أرقام في هواتف العملاء وواتساب والمكاتب والحسابات، والقاعدة ترفض غيرها. التطبيق و`manage-users` يقبلان كتابتها بأي صيغة سودانية (`09…`، 9 أرقام، `00249…`، أرقام عربية) ويرفضان الأرقام الأجنبية؛ القاعدة المشتركة في `packages/domain/src/phone.ts` ونسختها في الدالة يتحقق اختبار من تطابقهما. اختبار القاعدة: `supabase/tests/sudan_only.sql`.

---

# قواعد التنفيذ

1. **Matter/Case هو محور النظام.**
2. لا تكرر البيانات لإرضاء شاشة؛ استخدم العلاقات والمصادر authoritative.
3. كل business record يجب أن يكون معزولاً حسب `office_id` حيث ينطبق.
4. RLS في قاعدة البيانات إلزامي؛ frontend filtering ليس حماية.
5. لا hard-code لمدد الطعون أو الإجراءات القانونية؛ استخدم configurable templates/rules يراجعها المحامي.
6. الإيصالات والتوثيقات الصادرة لا تُحذف؛ تلغى مع بقاء الرقم والسجل.
7. Offline-first متطلب أساسي للسودان، وليس تحسيناً لاحقاً.
8. لا يبدأ AI القانوني قبل وجود مكتبة موثوقة ومصادر قابلة للاستشهاد.
9. كل صفحة يجب أن تدعم Loading / Success / Empty / Error / Offline / Permission denied عند الحاجة.
10. كل مرحلة يجب أن تُختبر وتُوثق قبل بدء المرحلة التالية.

---

# خطة التنفيذ الحية

## Phase 0 — Baseline & Architecture Audit — 🟡 جاري

- [x] Monorepo + Expo structure
- [x] Domain package
- [x] UI package/design system
- [x] Supabase client
- [x] Supabase login/session routing
- [ ] توثيق schema الحالي في `docs/DATABASE.md`
- [ ] توثيق architecture في `docs/ARCHITECTURE.md`
- [ ] إنشاء `docs/PAGE_TEST_MATRIX.md`
- [ ] تحديد migration strategy من mocks إلى Supabase
- [ ] تشغيل lint/typecheck/test/build وتسجيل baseline
- [ ] التأكد من عدم وجود secrets حساسة في Git

**Gate:** baseline موثق ولا توجد مشكلة تمنع البناء.

## Phase 1 — Supabase Foundation + Multi-Tenancy + Security — ⬜

إنشاء/تثبيت:
- [ ] profiles
- [ ] offices
- [ ] office_members
- [ ] roles
- [ ] permissions / role_permissions أو نموذج permissions مكافئ
- [ ] office_settings
- [ ] audit_logs

ثم:
- [ ] ربط user بـprofile وoffice
- [ ] Office context بدلاً من `OFFICE_ID = "office-1"`
- [ ] RLS لكل جدول
- [ ] Storage policies foundation
- [ ] Admin/Partner, Lawyer, Assistant, Trainee, Reception
- [ ] logout
- [ ] password reset
- [ ] auth/session error states
- [ ] cross-office denial tests
- [ ] permission tests

**Gate:** User من Office A لا يستطيع قراءة/تعديل Office B بأي API call.

## Phase 2 — Clients: تحويل الموجود من Mock إلى Supabase — 🟡 جاري

- [x] List UI
- [x] Create/Edit form UI
- [x] Arabic search/filter logic
- [x] Validation foundation
- [x] Client Profile route/UI foundation
- [x] Supabase ClientRepository (`src/data/supabase/clientRepository.ts`)
- [x] إزالة الاعتماد على mockRepository في production path
- [x] RLS (سياسات المرحلة 1 + قيد الاستقبال على بيانات التواصل؛ `phase2_clients_matters.sql` + E2E محلي)
- [x] أرشفة واستعادة بالحالة بدلاً من الحذف
- [ ] duplicate detection: phone / national ID / similar name — رقم الهوية فقط (فهرس فريد لكل مكتب في القاعدة مع رسالة عربية)؛ الهاتف والاسم المشابه غير منفذين
- [x] matters relationship (العميل الأساسي `matters.client_id` والعملاء الإضافيون `matter_parties.client_id`، والاسم يُقرأ دائماً من سجل العميل)
- [ ] receipts/documents/communications sections من بيانات حقيقية
- [ ] offline create/edit
- [ ] sync
- [ ] UI + integration tests — repository/mapper unit tests + E2E محلي (15 سيناريو) موجودة؛ لا اختبارات على جهاز حقيقي ولا CI

**Gate:** Create → DB → reopen app → data persists → edit → search → permissions → offline/sync pass.

حالة الـGate: كل الخطوات تنجح (E2E محلي) **ما عدا offline/sync** غير المنفذ، لذلك المرحلة ليست ✅.

## Phase 3 — Matters Core — 🟡 جاري

- [x] Matter domain model foundation
- [x] List UI
- [x] New Matter multi-step form
- [x] Arabic search/filter/sort
- [x] type-specific field foundation
- [x] Supabase MatterRepository (`src/data/supabase/matterRepository.ts`؛ الحفظ عبر `save_matter` في معاملة واحدة بصلاحيات المستخدم)
- [x] matter_clients / matter_parties (طرف إما عميل مسجل عبر FK أو اسم مكتوب، والعميل مرة واحدة لكل قضية)
- [x] assignments — محامٍ مسؤول واحد؛ المحامي يسند قضاياه الجديدة لنفسه، وتغيير الإسناد للمدير فقط (مفروض في القاعدة)
- [x] Matter Details screen — بيانات القضية من الخادم؛ الأقسام التابعة للمسار من الجهاز
- [ ] fixed Matter Header
- [ ] tabs: Overview / Workflow / Sessions / Documents / Fees / References / Drafts / Notes / Activity
- [x] edit/archive (`/matters/[id]/edit`؛ الإغلاق من مسار القضية بعد فحص المواعيد والمراحل، والأرشفة للقضايا المغلقة)
- [ ] conflict check before accepting a matter
- [x] RLS (مختبر في SQL وE2E: المكتب ب لا يرى ولا يعدّل ولا يربط قضايا وعملاء المكتب أ)
- [ ] offline/sync
- [ ] integration tests

**Gate:** Client ↔ Matter relationship works both directions and survives restart/offline sync.

## Phase 4 — Workflow Engine & Sudan Context — ⬜

- [ ] matter_types
- [ ] workflow_templates
- [ ] workflow_template_stages
- [ ] matter_workflows
- [ ] matter_stages
- [ ] stage_events
- [ ] configurable deadlines/rules
- [ ] Police stage
- [ ] Prosecution stage
- [ ] First Instance
- [ ] Appeal
- [ ] Supreme Court
- [ ] Review
- [ ] Enforcement
- [ ] Commercial Registry
- [ ] Land Registry
- [ ] custom office workflows
- [ ] stage-linked fees/documents/deadlines
- [ ] every transition → audit/activity

**Gate:** ملف واحد ينتقل بين الجهات مع حفظ أرقام كل جهة وتاريخه الكامل بدون فقد المرحلة السابقة.

## Phase 5 — Sessions, Deadlines & Calendar — ⬜

- [ ] sessions table/repository
- [ ] deadlines table/repository
- [ ] Month view
- [ ] Week view
- [ ] Day view
- [ ] link session to Matter + Client
- [ ] post-session result
- [ ] create next session
- [ ] independent appeal/detention/custom deadlines
- [ ] reminders
- [ ] Dashboard uses real session/deadline data

**Gate:** Matter → Session → Calendar → Dashboard → Client timeline كلها تعرض نفس السجل.

## Phase 6 — Documents & Scanner — ⬜

- [ ] document metadata
- [ ] Supabase Storage policies
- [ ] camera/import
- [ ] edge detection
- [ ] perspective correction
- [ ] multi-page
- [ ] reorder/compress
- [ ] PDF generation
- [ ] local-first save
- [ ] upload/sync
- [ ] link to Matter/Client
- [ ] OCR as enhancement, not blocker
- [ ] Arabic text search after OCR

## Phase 7 — Offline-First Sync Engine — ⬜ CRITICAL

- [ ] local database/storage architecture
- [ ] sync metadata
- [ ] pending/syncing/synced/conflict/failed
- [ ] retry queue
- [ ] conflict strategy
- [ ] clients offline
- [ ] matters offline
- [ ] sessions offline
- [ ] notes offline
- [ ] payments/receipts offline
- [ ] expenses offline
- [ ] documents offline
- [ ] airplane-mode E2E test

**Gate:** إنشاء بيانات مترابطة في Airplane Mode ثم عودة الإنترنت → كل العلاقات تتزامن بدون duplicate/loss.

## Phase 8 — Fees, Payments & Receipts — ⬜

- [ ] fee agreements fixed/staged
- [ ] installments/due dates
- [ ] payments
- [ ] Cash / Bankak / Bank Transfer / configurable methods
- [ ] transfer evidence
- [ ] authoritative calculated balances
- [ ] sequential receipt numbering
- [ ] PDF receipt
- [ ] amount in Arabic words
- [ ] office logo/stamp/settings
- [ ] immutable issued receipt
- [ ] cancellation + replacement
- [ ] Client + Matter + Dashboard financial integration
- [ ] duplicate-payment/idempotency tests
- [ ] OS share sheet / WhatsApp sharing

## Phase 9 — Expenses & Client Trust — ⬜

- [ ] expenses
- [ ] expense attachments
- [ ] trust ledger
- [ ] deposits/disbursements
- [ ] low balance warning
- [ ] separate fees from client funds
- [ ] client statement PDF
- [ ] financial permissions
- [ ] ledger integrity tests

## Phase 10 — Notarization — ⬜

- [ ] types
- [ ] yearly sequence
- [ ] parties/IDs
- [ ] document capture
- [ ] immutable/cancelled register
- [ ] OCR suggestion
- [ ] PDF/Excel register export
- [ ] client/fees/receipt integration

## Phase 11 — Legal Library — ⬜

- [ ] laws/articles
- [ ] amendments/version/provenance
- [ ] precedents
- [ ] books/publications
- [ ] Arabic search
- [ ] bookmarks/notes
- [ ] offline download
- [ ] Save to Matter / Matter References
- [ ] official vs unofficial source indicator
- [ ] copyright/licensing controls

## Phase 12 — Legal Templates & Generated Documents — ⬜

- [ ] pleadings/memoranda/notices/POA/contracts
- [ ] structured variables
- [ ] autofill from Matter
- [ ] lawyer-owned templates
- [ ] completed examples
- [ ] Word/PDF export
- [ ] generated result saved to Matter Documents

## Phase 13 — AI Assistant — ⬜

- [ ] retrieval only from approved legal library
- [ ] source citations
- [ ] judgment summarization
- [ ] principle extraction
- [ ] compare judgments
- [ ] suggest references
- [ ] summarize documents
- [ ] draft memorandum/petition
- [ ] PII redaction/consent
- [ ] clear generated-vs-source separation
- [ ] lawyer review warning
- [ ] hallucination/evidence tests

## Phase 14 — Subscription & Entitlements — ⬜

- [ ] Basic / Advanced / Office plans
- [ ] centralized Entitlement Service
- [ ] user/matter/storage limits
- [ ] trial
- [ ] monthly/yearly
- [ ] Bankak/local payment workflow
- [ ] upgrade/downgrade
- [ ] read-only after expiry
- [ ] export remains available
- [ ] offline grace period

## Phase 15 — WhatsApp & Communications — ⬜

- [ ] native share/deep link first
- [ ] communication log
- [ ] session reminder
- [ ] fee reminder
- [ ] receipt/statement/document share
- [ ] MessagingProvider abstraction
- [ ] later: approved WhatsApp Business Platform automation
- [ ] never mark delivered without provider delivery state

## Phase 16 — Dashboard, Reporting & Production Hardening — ⬜

- [x] replace mockDashboardRepository (أعداد من الخادم؛ الأقسام المحلية موضّحة في الشاشة)
- [ ] action-oriented dashboard from real data
- [ ] global search
- [ ] financial/basic/advanced reports
- [ ] pagination/indexes
- [ ] Arabic search performance
- [ ] observability/error codes
- [ ] backup/restore
- [ ] security review
- [ ] production E2E
- [ ] release checklist

---

# اختبار كل صفحة

يجب إنشاء وتحديث `docs/PAGE_TEST_MATRIX.md` بهذه الأعمدة:

| Page | Render | Create | Read | Edit | DB | RLS | Offline | Sync | RTL | Navigation | Error/Empty | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

لا تتحول الصفحة إلى **COMPLETE** إذا فشل أي عمود critical.

## اختبارات الربط الإلزامية

1. Client → Matter → يظهر الملف عند العميل ويظهر العميل في الملف. (المرحلة 2: ينجح في E2E المحلي)
2. Matter → Session → Calendar → Dashboard → Client timeline.
3. Matter → Payment → totals → Receipt → Client + Matter + Dashboard.
4. Matter → Expense → Trust ledger → Statement.
5. Matter → Document offline → reconnect → Storage → Matter Documents.
6. Police → Prosecution → Court مع بقاء التاريخ والأرقام السابقة.
7. Office A → محاولة قراءة Office B = DENIED. (العملاء والقضايا: ينجح في SQL وE2E المحلي)
8. Trainee/Reception → محاولة فتح financial/confidential data حسب permission = DENIED.
9. Receipt issued → delete attempt = DENIED; cancellation preserves sequence.
10. Offline duplicate sync / repeated payment tap = no duplicate financial record.

---

# Definition of Done

الميزة لا تعتبر منجزة إلا إذا:

- [ ] UI مكتمل
- [ ] data model/database مكتمل
- [ ] repository/service حقيقي
- [ ] relationships صحيحة
- [ ] RLS/permissions
- [ ] validation
- [ ] loading/empty/error states
- [ ] offline behavior حيث يلزم
- [ ] sync حيث يلزم
- [ ] RTL
- [ ] automated tests
- [ ] cross-module test
- [ ] docs updated
- [ ] README checkbox/status updated في نفس التغيير

---

# سياسة تحديث هذا README

مع كل PR/مرحلة:

1. غيّر حالة البند: ⬜ → 🟡 → ✅.
2. لا تستخدم ✅ إلا بعد نجاح الـGate والاختبارات.
3. أضف أي gap جديد يظهر أثناء التنفيذ.
4. إذا تغيرت المعمارية، حدّث الخطة بدلاً من ترك README قديماً.
5. سجّل الاختبارات الفاشلة بوضوح؛ لا تخفها.
6. لا تبدأ Phase جديدة قبل إغلاق Critical failures في السابقة.
7. أي Agent/Codex/Claude يعمل على المشروع يجب أن يقرأ هذا README أولاً ويحدّثه قبل إنهاء مهمته.

---

## التشغيل الحالي

```bash
pnpm install
cp apps/mobile/.env.example apps/mobile/.env   # Windows: copy apps\mobile\.env.example apps\mobile\.env
pnpm --filter @maktabi/mobile start
```

الدخول برقم الهاتف وكلمة المرور. الحسابات تُنشأ من داخل التطبيق فقط: مالك المنصة ← مدير المكتب ← فريق المكتب والموكلين، أو يطلب مدير مكتب جديد مكتباً تجريبياً من شاشة الدخول فيفعّله مالك المنصة. التفاصيل في [المرحلة 1 — الحسابات والصلاحيات](docs/phase-1-accounts.md). إرسال نسخة تجريبية للعميل (APK أو رابط ويب): [docs/trial-release.md](docs/trial-release.md).

ملف `apps/mobile/.env` مطلوب لإعدادات Supabase؛ بدونه يتوقف التطبيق عند التشغيل برسالة `Missing Supabase environment variables`. بعد إنشائه أو تعديله أعد تشغيل Metro مع مسح الكاش: `pnpm --filter @maktabi/mobile exec expo start -c`؛ بدون `-c` قد يبقى Metro على القيم القديمة المحفوظة في الكاش.

المتطلبات:
- Node.js 22 LTS بإصدار 22.13.0 أو أحدث (مثبت في `.nvmrc`؛ `.npmrc` يفعّل `engine-strict` فيرفض `pnpm install` أي إصدار أقدم). `@supabase/supabase-js` يتطلب Node 22، و`vite`/`eslint` يتطلبان 22.13 على الأقل.
- pnpm 10+
- Expo Go المتوافق مع SDK 57 أو Android/iOS simulator

## أوامر الجودة

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

قاعدة البيانات: شغّل `supabase/tests/phase1_access.sql` و`supabase/tests/phase2_clients_matters.sql` في SQL editor بعد أي تغيير في الصلاحيات، و`supabase/tests/sudan_only.sql` بعد أي تغيير في القيم الافتراضية أو الهوية أو أرقام الهواتف أو المدفوعات، و`supabase/tests/office_requests.sql` بعد أي تغيير في طلبات المكاتب أو حالات المكتب أو دوال مالك المنصة (كل منها يتراجع عن بياناته ويطبع النتيجة). الفحص الشامل المحلي للتطبيق مع القاعدة: [`supabase/tests/local/e2e`](supabase/tests/local/e2e/README.md).

## بنية المستودع

- `apps/mobile`: تطبيق Expo الأساسي.
- `apps/web`: مساحة مستقبلية للوحة المكتب.
- `apps/api`: مساحة مستقبلية للخادم إن احتاجت المعمارية ذلك.
- `packages/domain`: Domain models/business rules/repository contracts.
- `packages/ui`: Design system ومكونات مشتركة.
- `packages/types`, `packages/validation`, `packages/config`: shared foundations.
- `docs/ui-visual-spec.md`: المرجع البصري الحالي.

## ملاحظة أمان

رغم أن Supabase Auth متصل وأن العملاء والقضايا محمية بـRLS، **لا تعتبر التطبيق جاهزاً لبيانات موكلين حقيقية بعد**: مسار القضية والمستندات والأتعاب ما زالت على الجهاز فقط، ويجب إكمال Storage policies وoffline/security testing، وتعطيل التسجيل العام في Supabase Auth.
