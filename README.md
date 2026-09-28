# مكتبي — Maktabi

> **Live Implementation Roadmap — آخر مراجعة: 2026-09-27**
>
> هذا الملف هو مصدر الحقيقة لحالة تنفيذ المشروع. يجب تحديثه في نفس الـPR/commit عند إكمال أي مرحلة أو صفحة أو تغيير حالة اختبار. لا تعتبر أي ميزة "مكتملة" لمجرد أن واجهتها موجودة.

تطبيق عربي أولاً لإدارة مكاتب المحامين في السودان: العملاء، القضايا ومساراتها، الجلسات، المستندات، الأتعاب والإيصالات، المصروفات وأمانة العميل، التوثيقات، المكتبة والصيغ القانونية، ثم المساعد الذكي والتواصل عبر واتساب.

التطبيق الأساسي: **React Native + Expo + TypeScript + Expo Router** داخل `apps/mobile`.

## الحالة الحالية المختصرة

| المجال | الحالة | الملاحظة |
|---|---|---|
| Expo/React Native foundation | ✅ منجز | Expo SDK 54 + TypeScript + Expo Router |
| Arabic RTL design system | ✅ منجز | Noto Sans Arabic + Navy/Gold tokens + reusable UI |
| Splash + routing | ✅ منجز | يفحص Supabase session |
| Supabase client | ✅ منجز | SecureStore + persisted auth session |
| Login | 🟡 جزئي | تسجيل الدخول الحقيقي يعمل؛ reset password غير منفذ |
| Office / profiles / membership | ❌ غير منفذ | لا يوجد tenant context حقيقي بعد |
| RBAC / permissions | ❌ غير منفذ | Domain role أولي فقط، بلا enforcement/RLS |
| Clients UI | 🟡 جزئي | List/Create/Edit/Profile موجودة؛ البيانات Mock |
| Matters UI | 🟡 جزئي | List/Create + validation موجودة؛ البيانات Mock؛ التفاصيل/workflow غير مكتملة |
| Dashboard | 🟡 جزئي | UI قوي لكن مصدره mockDashboardRepository |
| Calendar / sessions | ❌ غير منفذ | Placeholder |
| Documents/scanner | ❌ غير منفذ | Domain model أولي فقط |
| Fees/payments/receipts | ❌ غير منفذ | Domain types أولية فقط |
| Expenses/client trust | ❌ غير منفذ | Domain types أولية فقط |
| Offline database/sync | ❌ غير منفذ | لا توجد queue/conflict engine |
| Audit log | ❌ غير منفذ | غير مربوط |
| Notarization | ❌ غير منفذ | غير منفذ |
| Legal library/templates | ❌ غير منفذ | غير منفذ |
| AI assistant | ❌ غير منفذ | مؤجل عمداً حتى استقرار البيانات والمكتبة |
| Subscriptions | ❌ غير منفذ | غير منفذ |
| WhatsApp integration | ❌ غير منفذ | غير منفذ |
| Automated tests | 🟡 جزئي | Domain/format tests موجودة؛ لا يوجد E2E/RLS/offline suite |

**التقييم الحالي:** الأساس البصري وDomain foundation جيدان، وSupabase Auth بدأ فعلياً. لكن بيانات العمل الأساسية (Clients/Matters/Dashboard) ما زالت Mock وليست production persistence. الأولوية الآن ليست إضافة شاشات كثيرة؛ الأولوية هي تحويل الأساس إلى multi-tenant Supabase architecture آمنة ثم ربط الصفحات الموجودة بها.

---

## ما تم التحقق منه في الكود

- `apps/mobile/src/lib/supabase.ts`: Supabase client حقيقي، session محفوظ في Expo SecureStore.
- `apps/mobile/app/index.tsx`: يوجّه حسب Supabase session.
- `apps/mobile/app/(auth)/login.tsx`: `signInWithPassword` حقيقي.
- `apps/mobile/src/data/mockRepositories.ts`: Clients وMatters ما زالت session-local mock data وتضيع بعد reload.
- `apps/mobile/src/data/mockDashboardRepository.ts`: Dashboard بالكامل تجريبي.
- `apps/mobile/app/(tabs)/calendar.tsx`: Placeholder.
- `apps/mobile/app/(tabs)/more.tsx`: Placeholder.
- `packages/domain/src/index.ts`: نماذج أولية جيدة لـOffice/User/Client/Matter/Workflow/Session/Deadline/Document/Fees/Payment/Receipt/Expense/Trust.
- `packages/domain/src/clientsMatters.ts`: Arabic normalization/search + validation للقضايا والعملاء.
- `packages/domain/src/clientsMatters.test.ts`: اختبارات Domain موجودة للعملاء والقضايا.
- `packages/ui/src/theme.ts`: Design tokens وRTL foundation موجودان.
- `docs/ui-visual-spec.md`: Visual lock موثق.

### فجوة يجب إصلاحها

الـREADME القديم كان يقول إن المصادقة غير منفذة، بينما الكود الحالي يحتوي Supabase Auth فعلي. لذلك هذا الملف يجب أن يتغير دائماً مع التنفيذ ولا يُترك خلف الكود.

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

## Phase 2 — Clients: تحويل الموجود من Mock إلى Supabase — ⬜

- [x] List UI
- [x] Create/Edit form UI
- [x] Arabic search/filter logic
- [x] Validation foundation
- [x] Client Profile route/UI foundation
- [ ] Supabase ClientRepository
- [ ] إزالة الاعتماد على mockRepository في production path
- [ ] RLS
- [ ] duplicate detection: phone / national ID / similar name
- [ ] matters relationship
- [ ] receipts/documents/communications sections من بيانات حقيقية
- [ ] offline create/edit
- [ ] sync
- [ ] UI + integration tests

**Gate:** Create → DB → reopen app → data persists → edit → search → permissions → offline/sync pass.

## Phase 3 — Matters Core — ⬜

- [x] Matter domain model foundation
- [x] List UI
- [x] New Matter multi-step form
- [x] Arabic search/filter/sort
- [x] type-specific field foundation
- [ ] Supabase MatterRepository
- [ ] matter_clients / matter_parties
- [ ] assignments
- [ ] Matter Details screen
- [ ] fixed Matter Header
- [ ] tabs: Overview / Workflow / Sessions / Documents / Fees / References / Drafts / Notes / Activity
- [ ] edit/archive
- [ ] conflict check before accepting a matter
- [ ] RLS
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

- [ ] replace mockDashboardRepository
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

1. Client → Matter → يظهر الملف عند العميل ويظهر العميل في الملف.
2. Matter → Session → Calendar → Dashboard → Client timeline.
3. Matter → Payment → totals → Receipt → Client + Matter + Dashboard.
4. Matter → Expense → Trust ledger → Statement.
5. Matter → Document offline → reconnect → Storage → Matter Documents.
6. Police → Prosecution → Court مع بقاء التاريخ والأرقام السابقة.
7. Office A → محاولة قراءة Office B = DENIED.
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

ملف `apps/mobile/.env` مطلوب لإعدادات Supabase؛ بدونه يتوقف التطبيق عند التشغيل برسالة `Missing Supabase environment variables`. بعد تعديله أعد تشغيل Metro.

المتطلبات:
- Node.js 22 LTS بإصدار 22.13.0 أو أحدث (مثبت في `.nvmrc`؛ `.npmrc` يفعّل `engine-strict` فيرفض `pnpm install` أي إصدار أقدم). `@supabase/supabase-js` يتطلب Node 22، و`vite`/`eslint` يتطلبان 22.13 على الأقل.
- pnpm 10+
- Expo Go المتوافق مع SDK 54 أو Android/iOS simulator

## أوامر الجودة

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## بنية المستودع

- `apps/mobile`: تطبيق Expo الأساسي.
- `apps/web`: مساحة مستقبلية للوحة المكتب.
- `apps/api`: مساحة مستقبلية للخادم إن احتاجت المعمارية ذلك.
- `packages/domain`: Domain models/business rules/repository contracts.
- `packages/ui`: Design system ومكونات مشتركة.
- `packages/types`, `packages/validation`, `packages/config`: shared foundations.
- `docs/ui-visual-spec.md`: المرجع البصري الحالي.

## ملاحظة أمان

رغم أن Supabase Auth متصل، **لا تعتبر التطبيق جاهزاً لبيانات موكلين حقيقية بعد**. يجب أولاً إكمال multi-tenancy وRLS وStorage policies وoffline/security testing الموضحة أعلاه.
