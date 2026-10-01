أنت الآن المسؤول الهندسي الرئيسي عن مشروع **Maktabi — مكتبي**.

قبل تنفيذ أي Feature جديدة أو تعديل معماري أو إصلاح تقني، اعتبر النص الموجود في هذا البرومبت هو:

# Maktabi Master Product Vision

وهو المرجع الأعلى للمشروع.

لا تتعامل مع التطبيق الحالي باعتباره الصورة النهائية.

الكود الحالي هو مرحلة تنفيذية قد تحتوي على:

- حلول مؤقتة
- بيانات تجريبية
- Local Storage
- Architecture غير مكتملة
- Roles غير نهائية
- Screens ناقصة
- Services غير مترابطة
- Features تم تنفيذها جزئياً
- قرارات قديمة لم تعد مناسبة للصورة النهائية

مهمتك ليست المحافظة على الأخطاء الموجودة.

مهمتك هي:

**تطوير المشروع الموجود تدريجياً حتى يصل إلى الصورة النهائية الموضحة هنا، بدون إعادة بناء المشروع من الصفر وبدون كسر الوظائف الصحيحة الموجودة.**

---

# 1. احفظ الرؤية النهائية داخل المشروع

أول إجراء مطلوب منك:

أنشئ أو حدّث الملف:

`docs/MAKTABI_MASTER_VISION.md`

واكتب فيه الهدف الكامل الموجود في هذا البرومبت.

هذا الملف يجب أن يصبح:

**Single Source of Product Truth**

لكل التطوير المستقبلي.

ثم أنشئ:

`docs/MAKTABI_ARCHITECTURE.md`

ويحتوي:

- Current Architecture
- Target Architecture
- Data Architecture
- Offline Architecture
- Sync Architecture
- Multi-Tenant Architecture
- Permissions Model
- Security Model
- Module Relationships
- Migration Strategy

ثم أنشئ أو حدّث:

`docs/IMPLEMENTATION_ROADMAP.md`

ليتتبع:

- Completed
- In Progress
- Missing
- Technical Debt
- Blockers
- Future Features

ولا تكتب هذه الملفات فقط ثم تتوقف.

استخدمها فعلياً أثناء التطوير.

---

# 2. القاعدة العليا أثناء التطوير

قبل تعديل أي جزء من النظام اسأل هندسياً:

> هل هذا التعديل يقرب Maktabi من الصورة النهائية أم يصنع حلاً مؤقتاً جديداً؟

إذا اكتشفت أن جزءاً موجوداً من الكود يتعارض مع Master Vision:

لا تبنِ Feature جديدة فوق الخطأ.

قم بتعديل الجزء المتعارض أولاً أو Refactor له بالطريقة الأكثر أماناً.

لكن:

- لا تعيد المشروع من الصفر.
- لا تكسر Features تعمل.
- استخدم migrations.
- حافظ على البيانات.
- حافظ على backward compatibility حيث يمكن.
- أضف Tests.

---

# 3. ما هو Maktabi؟

Maktabi هو:

**منصة متكاملة لإدارة مكاتب المحاماة في السودان.**

ليست مجرد:

CRM.

وليست مجرد:

Case Management App.

وليست مجرد:

Legal AI App.

الصورة النهائية هي:

**Legal Practice Operating System**

لمكتب المحاماة.

يدير:

القضايا

العملاء

الإجراءات القانونية

الجلسات

المواعيد

المهل القانونية

المستندات

الأتعاب

الدفعات

الإيصالات

المصروفات

أمانات العملاء

التوثيقات

الموظفين

المهام

المكتبة القانونية

السوابق

الصيغ القانونية

التقارير

WhatsApp

الذكاء الاصطناعي

الاشتراكات

إدارة المنصة.

---

# 4. Case-Centric Architecture

أهم قاعدة في النظام:

# ملف القضية هو مركز النظام.

كل Module يجب أن يرتبط بالقضية عندما يكون ذلك منطقياً.

الصورة الرئيسية:

Client

↓

Matter / Case

↓

Legal Workflow

↓

Stages

↓

Hearings

↓

Deadlines

↓

Documents

↓

Tasks

↓

Fees

↓

Payments

↓

Receipts

↓

Expenses

↓

Trust Money

↓

Legal References

↓

Legal Drafts

↓

Notes

↓

Activity Log

↓

AI Assistant

القضية ليست مجرد Record.

القضية هي:

**الكيان المركزي الذي تتجمع حوله دورة العمل القانونية كاملة.**

---

# 5. العلاقة مع العميل

Client يمكن أن يكون لديه:

عدة قضايا.

والقضية قد يكون لها:

عميل واحد أو أكثر إذا كانت المعمارية تحتاج ذلك.

ملف العميل يجب أن يعرض تلقائياً:

- القضايا
- الأتعاب
- المدفوع
- المتبقي
- الإيصالات
- المصروفات
- الأمانات
- المستندات المناسبة
- التواصل
- المواعيد
- كشف الحساب

بدون إدخال نفس البيانات أكثر من مرة.

---

# 6. Offline-First Architecture

هذه نقطة أساسية جداً.

Maktabi يجب أن يعمل في السودان حتى مع:

- الإنترنت الضعيف
- الإنترنت المتقطع
- عدم وجود اتصال مؤقتاً

لذلك لا تحول النظام إلى Cloud-only application.

Target Architecture:

Mobile / Client App

↓

Local Database

↓

Sync Engine

↓

Supabase / PostgreSQL

↓

Other Office Devices

الـ Local Database ليست مجرد Cache.

يجب أن تدعم:

- إنشاء البيانات Offline
- تعديل البيانات Offline
- قراءة البيانات Offline
- إدارة العمليات المؤجلة
- Sync عند رجوع الإنترنت

استخدم Architecture مناسبة مثل:

SQLite أو ما يناسب Stack الحالي.

لا تستمر في الاعتماد على عشوائية LocalStorage إذا كانت غير مناسبة.

---

# 7. Cloud Source + Local Operational Store

Supabase يمثل:

- Shared Cloud Database
- Identity
- Tenant data
- Storage
- Server-side security
- Shared state between devices

Local DB تمثل:

- Offline working data
- pending mutations
- local documents queue
- sync state

النظام يجب أن يعرف:

ما الذي تم Sync له.

ما الذي ينتظر Sync.

ما الذي فشل.

ما الذي حدث له Conflict.

---

# 8. Sync Engine

أنشئ Architecture حقيقية للمزامنة.

يجب دعم:

Create

Update

Archive

Status changes

Assignments

Financial transactions

Documents metadata

Offline queues

ويجب أن توجد استراتيجية:

Conflict Resolution.

لا تستخدم:

Last Write Wins

بشكل عشوائي على كل أنواع البيانات.

بعض البيانات المالية والقانونية يجب ألا يتم overwrite عليها بلا أثر.

احتفظ بـ:

version

updated_at

updated_by

sync_status

أو ما يناسب Architecture.

---

# 9. Multi-Tenant SaaS

Maktabi عبارة عن منصة تدعم عدة مكاتب.

كل مكتب:

Tenant مستقل.

كل بيانات المكتب يجب أن ترتبط بشكل واضح بـ:

`office_id`

ويجب أن يكون هناك عزل حقيقي بين المكاتب.

مثال:

Office A

لا يرى:

Office B.

حتى عبر Direct API calls.

استخدم Supabase RLS فعلياً.

لا تعتمد على Frontend filtering.

---

# 10. Office Membership

أنشئ نظام Membership واضحاً.

مثلاً:

`offices`

`profiles`

`office_members`

بحيث المستخدم يمكن أن يرتبط بمكتب.

والعضوية تحتوي على:

user_id

office_id

role

status

created_at

created_by

وما يلزم.

---

# 11. Roles ليست جامدة للأبد

الكود الحالي قد يحتوي:

platform_owner

admin

lawyer

employee

reception

يمكن الاستمرار بها مؤقتاً.

لكن التصميم النهائي يجب أن يسمح بأدوار مثل:

- صاحب المكتب
- شريك
- محامٍ
- مساعد قانوني
- موظف
- متدرب
- استقبال

ولا تجعل كل Permissions hardcoded داخل Screens.

صمم:

RBAC

وقابل لاحقاً للانتقال إلى:

Permission-Based Access.

مثال:

can_view_finance

can_edit_finance

can_manage_team

can_assign_cases

can_view_documents

can_manage_templates

can_manage_office_settings

can_create_receipts

إلخ.

---

# 12. Platform Owner مختلف عن Office Owner

يوجد مستويان منفصلان.

## Platform Owner

يدير SaaS نفسه:

- المكاتب
- الاشتراكات
- الباقات
- التفعيل
- النظام
- الدعم
- الاستخدام

## Office Owner / Admin

يدير مكتبه فقط:

- فريقه
- القضايا
- العملاء
- المالية
- الصلاحيات
- الإعدادات

لا تخلط بينهم.

---

# 13. Legal Workflow Engine

Maktabi يجب ألا يعامل القضية كـ status بسيط.

القضية تتحرك خلال:

Workflow.

مثال في القضايا الجنائية:

شرطة

↓

نيابة

↓

محكمة أول درجة

↓

استئناف

↓

المحكمة العليا

↓

مراجعة

↓

تنفيذ

ويجب الحفاظ على:

رقم الملف عند كل جهة.

التاريخ.

الحالة.

المستندات.

الملاحظات.

المواعيد.

الموظف المسؤول.

المرحلة التالية.

---

# 14. Police Stage

يدعم مثلاً:

رقم البلاغ

قسم الشرطة

المبلغ

المتهم

الشهود

المادة

ضابط التحري

حالة المتهم

فتح البلاغ

الاستدعاء

التحري

القبض

التفتيش

الحجز

الإفراج بالضمان

الإحالة للنيابة.

---

# 15. Prosecution Stage

يدعم:

رقم الدعوى

النيابة

وكيل النيابة

التهم

الأطراف

الحبس

أوامر القبض

الضمان

مدة الحبس

الإحالة للمحكمة

حفظ الدعوى

التظلم.

ويجب إنشاء:

Deadline Alerts

قبل انتهاء مدد الحبس أو الإجراءات القانونية المهمة.

---

# 16. Courts

يدعم:

المحكمة

درجة المحكمة

الدائرة

القاضي

رقم القضية

الأطراف

الطلبات

الجلسات

الحكم

تاريخ الحكم

تاريخ الإعلان

منطوق الحكم.

Workflow قد يشمل:

First Instance

Appeal

Supreme Court

Review

Execution.

---

# 17. Deadlines Engine

هذا Feature أساسي وليس تجميلياً.

عند وقوع Event قانوني مثل:

صدور الحكم.

يجب للنظام أن يستطيع حساب:

موعد الطعن.

وإنشاء:

Deadline.

ثم:

Notification.

ثم:

Reminder.

لكن:

أي حساب قانوني يجب أن يعتمد على:

قواعد موثوقة ومحدّثة.

ولا تجعل AI يخترع المهلة.

---

# 18. Other Legal Procedures

يدعم النظام أيضاً:

Commercial Registrar.

Land Registrar.

Special Courts.

Government Transactions.

ولا تفترض أن كل ملف هو Court Case فقط.

---

# 19. Clients

Client module يجب أن يحتوي على:

- Personal information
- Contact information
- WhatsApp
- Cases
- Documents
- Fees
- Payments
- Receipts
- Expenses
- Trust balance
- Communication history
- Statements

---

# 20. Hearings & Calendar

أنشئ Calendar حقيقي.

Daily

Weekly

Monthly.

كل Hearing مرتبطة بقضية.

بعد الجلسة:

المحامي يسجل:

ما حدث.

القرار.

الملاحظات.

الجلسة القادمة.

أي Deadline نتج عنها.

---

# 21. Tasks

Task System يجب أن يكون متكاملاً مع:

- Case
- User
- Deadline
- Stage

ويدعم:

assigned_to

created_by

priority

due_date

status

completion.

صاحب المكتب يجب أن يستطيع رؤية:

Team workload.

---

# 22. Matter Assignment

القضية يمكن توزيعها على:

Primary Lawyer.

Supporting Lawyer.

Assistant.

Employee.

أنشئ Assignment History.

لا تخزن فقط:

assigned_user_id

داخل Matter إذا كان ذلك سيحد النظام مستقبلاً.

---

# 23. Documents

Document Management جزء أساسي.

يدعم:

Camera scan

Multiple pages

Edge detection

Perspective correction

PDF merge

Compression

OCR Arabic

Search.

Offline:

يتم حفظ الملف محلياً.

ثم يدخل:

Upload Queue.

وعند توفر الإنترنت:

Supabase Storage أو البنية التخزينية المعتمدة.

---

# 24. Document Security

المستندات القانونية Sensitive.

نفذ:

Tenant Isolation.

Storage Policies.

Authorization.

Signed access إذا لزم.

ولا تجعل معرفة URL كافية للوصول إلى الملف.

---

# 25. Fees

أتعاب المحامي منفصلة عن مصروفات القضية.

يدعم:

Fixed Fee.

Stage-based Fee.

Installments.

Due dates.

Outstanding balance.

---

# 26. Payments

Payment مرتبطة بـ:

Client

Matter

Fee Agreement

User

Office.

وتدعم طرق دفع محلية مثل:

Cash

Bankak

Bank Transfer

Other.

---

# 27. Receipts

عند تسجيل دفعة:

يصدر Receipt.

Receipt يحتوي:

- Office logo
- Office name
- Address
- Phone
- Receipt number
- Date
- Client
- Case
- Amount number
- Amount words
- Payment method
- Remaining balance
- Receiver
- Office stamp

ويتحول إلى:

PDF.

الإيصال لا يتم حذفه بعد الإصدار.

إذا حدث خطأ:

Status = Cancelled/Void.

ويبقى الرقم محفوظاً.

---

# 28. Expenses

Expenses منفصلة عن Fees.

تدعم:

Court fees

Registration fees

Transport

Copies

Experts

Advertisements

Other.

يمكن أن تكون:

Deducted from Trust

أو

Charged to Client.

---

# 29. Client Trust / Amanat

أنشئ Ledger واضحاً.

Deposit

↓

Trust Balance

↓

Expense

↓

New Balance.

لا تتعامل مع الأمانة كرقم واحد قابل للتعديل يدوياً.

استخدم Transaction Ledger.

---

# 30. Financial Integrity

البيانات المالية يجب أن تكون:

Auditable.

لا تسمح بتعديل سجل مالي حساس بدون Trace.

استخدم:

Transactions

Reversals

Status changes

Audit Logs.

---

# 31. Client Statement

يجب إنشاء:

PDF Statement

يعرض:

Fees

Payments

Remaining fees

Trust deposits

Expenses

Trust balance

Receipts.

---

# 32. Notary / Documentation Module

للمحامين الموثقين.

يدعم:

- Sale agreement
- Power of attorney
- Declaration
- Lease
- Mortgage
- Company establishment
- Custom types

مع:

sequential numbering

documents

parties

fees

OCR

PDF

register.

ولا يتم حذف Documentation Record.

يتم فقط:

Cancelled/Void

للحفاظ على التسلسل.

---

# 33. Legal Library

النظام النهائي يحتوي على:

قوانين السودان.

Regulations.

Judicial precedents.

Books.

Publications.

Search.

Categories.

Bookmarks.

Notes.

Offline access where allowed.

---

# 34. Legal Templates

يدعم:

Petitions.

Appeals.

Defence Memoranda.

Replies.

Warnings.

Contracts.

Powers of attorney.

Forms.

مع:

Auto-fill

من بيانات القضية.

---

# 35. Legal AI Assistant

المساعد الذكي جزء من النظام، لكنه لا يسبق Core System.

AI يجب أن يستطيع لاحقاً:

- Legal search
- Judgment summarization
- Extract principles
- Compare judgments
- Suggest references
- Summarize documents
- Draft memoranda
- Draft petitions

لكن:

AI لا يخترع قانوناً.

ولا مادة.

ولا حكم محكمة.

---

# 36. AI Grounding

Legal AI يجب أن يعتمد على:

Maktabi Legal Library.

ويظهر:

Sources.

Citations.

المحامي يراجع الناتج.

---

# 37. Privacy with AI

لا ترسل بيانات العميل الحساسة إلى AI الخارجي بدون:

Anonymization

أو

Explicit Consent

حسب Architecture والسياسات المستخدمة.

---

# 38. WhatsApp

WhatsApp integration جزء مهم.

المرحلة الأولى:

One-tap WhatsApp sharing.

لاحقاً:

WhatsApp Business API.

يستخدم في:

Appointments

Hearings

Payment reminders

Statements

Receipts

Documents

Updates.

---

# 39. Notifications

أنشئ Notification System حقيقي.

مصادر التنبيه:

- Hearing
- Appointment
- Deadline
- Appeal deadline
- Task
- Overdue task
- Payment
- Installment
- Trust balance
- Case assignment
- Workflow stage
- Subscription

---

# 40. Audit Trail

أي نظام متعدد المستخدمين يحتاج Activity Log.

سجل:

Who

Did what

To which entity

When

From which office.

خصوصاً:

Cases

Documents

Financial transactions

Roles

Assignments

Settings.

---

# 41. Search

أنشئ Global Search لاحقاً.

يبحث في:

Cases

Clients

Documents

OCR text

Legal library.

---

# 42. Office Settings

المكتب يضبط:

Name

Logo

Address

Phone

Stamp

Receipt numbering

Legal workflows

Roles

Templates

Preferences.

---

# 43. Subscription System

Maktabi SaaS مدفوع.

يجب أن يدعم:

Plans.

Trial.

Monthly.

Annual.

Upgrade.

Downgrade.

Storage limits.

User limits.

Case limits.

AI quota.

Features.

---

# 44. Subscription Expiry

عند انتهاء الاشتراك:

لا تحذف البيانات.

يتحول المكتب إلى:

Read-Only.

مع إمكانية:

Export.

ويجب وجود:

Grace Period

حتى لا يتعطل Office بسبب انقطاع الإنترنت.

---

# 45. Target Plans

الرؤية الحالية تحتوي تقريباً على:

Basic.

Advanced.

Office.

لكن لا Hardcode تفاصيل الأسعار الآن.

اجعل Plan architecture قابلة للتعديل.

---

# 46. Platform Dashboard

Platform Owner Dashboard يدعم لاحقاً:

- Total Offices
- Active Offices
- Suspended Offices
- Users
- Plans
- Trials
- Subscription Expirations
- Storage
- Usage
- Activation Requests
- System health

---

# 47. Reports

Office Reports تشمل لاحقاً:

Cases.

Hearings.

Collections.

Outstanding fees.

Expenses.

Trust funds.

Employee workload.

Employee activity.

Case status.

Financial summaries.

---

# 48. Sudan-First Product

لا تحول Maktabi إلى Generic US/European law firm system.

المنتج مصمم أساساً للسياق السوداني.

راعِ:

Arabic RTL.

Sudanese legal procedures.

Local payments.

Connectivity.

WhatsApp usage.

Office workflows.

لكن حافظ على Architecture تسمح بالتوسع لدول أخرى مستقبلاً.

---

# 49. Arabic First

الواجهة الأساسية:

Arabic.

RTL.

Mobile-first.

لكن Architecture تدعم localization لاحقاً.

لا تضع Arabic strings عشوائياً داخل Business Logic.

---

# 50. Mobile First

الهدف الرئيسي:

Mobile Application.

لكن النظام قد يحتوي:

Web/Admin portals

عند الحاجة.

لا تجعل Desktop Web assumptions تكسر تجربة الهاتف.

---

# 51. Data Model Principle

لا تصمم Tables بناءً فقط على Screens الحالية.

صممها بناءً على:

Business Domain.

مثال:

لا تنشئ:

dashboard_numbers.

بل احسب Dashboard من:

Cases

Hearings

Tasks

Payments

Deadlines

Audit logs.

---

# 52. No Fake Data in Production

Dummy data ممنوعة في Production flow.

إذا احتجنا Demo:

استخدم:

DEMO_MODE

أو Seed منفصل.

---

# 53. No Hardcoded Business Logic

لا Hardcode:

Roles

Plan rules

Workflow stages

Court names

Payment methods

Case types

إذا كانت تحتاج Configuration مستقبلاً.

---

# 54. Migration not Destruction

عندما تغير Architecture:

أنشئ Migration.

لا تعمل:

drop everything

إلا في بيئة development المعزولة وبقرار هندسي واضح.

---

# 55. Existing App

قبل كل تنفيذ:

افحص الكود الموجود.

حدد:

ما الصحيح.

ما الجزئي.

ما الخاطئ.

ما المتعارض مع Master Vision.

احتفظ بالصحيح.

حسّن الجزئي.

Refactor الخاطئ.

---

# 56. Architecture Drift Rule

من الآن أي كود جديد يجب أن يخضع لهذا القانون:

إذا Feature المقترحة تتعارض مع Master Vision:

**Master Vision wins.**

إذا الكود الحالي يتعارض مع Target Architecture:

**Target Architecture wins.**

لكن التعديل يتم بطريقة آمنة وتدريجية.

---

# 57. Immediate Correction Rule

إذا أثناء تنفيذ أي Task اكتشفت Architecture غير مناسبة تمنع الصورة النهائية:

لا تتجاهلها.

ولا تضف TODO فقط.

إذا كان الإصلاح:

آمناً.

ومحدوداً.

ولا يسبب Migration كارثية.

قم بإصلاحه مباشرة.

ثم حدّث:

MAKTABI_ARCHITECTURE.md

و

IMPLEMENTATION_ROADMAP.md.

---

# 58. Do Not Over-Engineer

في نفس الوقت:

لا تبنِ Features المستقبل كله الآن.

استخدم:

Target-aware architecture.

أي:

نبني المرحلة الحالية بطريقة لا تمنع المراحل القادمة.

---

# 59. Development Priority

الترتيب الاستراتيجي من الآن:

## Foundation

Authentication

Office Membership

Multi-Tenancy

RLS

Local Database

Sync Engine

RBAC

Audit.

↓

## Core Legal Office

Clients

Matters

Assignments

Tasks

Hearings

Deadlines

Workflows

Documents.

↓

## Financial

Fees

Installments

Payments

Receipts

Expenses

Trust Accounts

Statements.

↓

## Legal Operations

Police

Prosecution

Courts

Appeals

Execution

Commercial Registrar

Land Registrar

Notary.

↓

## Knowledge

Legal Library

Judgments

Books

Templates.

↓

## Intelligence

OCR

Smart Search

Legal AI.

↓

## Communication

WhatsApp

Notifications.

↓

## SaaS

Subscriptions

Plans

Platform Owner Dashboard

Reporting

Billing.

---

# 60. المرحلة الحالية

حالياً لا تقفز إلى AI أو WhatsApp API.

الأولوية:

# Foundation + Shared Office Collaboration.

ابدأ من:

Office

↓

Members

↓

Clients

↓

Matters

↓

Assignments

↓

Sync.

---

# 61. أول Proof يجب أن يعمل

اختبر السيناريو التالي:

Office A Admin

ينشئ Client.

↓

يُحفظ Local.

↓

عند وجود الإنترنت Sync إلى Supabase.

↓

Lawyer في Office A يرى Client.

↓

موظف مصرح له يراه.

↓

Office B لا يستطيع الوصول إليه.

ثم:

Office A Admin

ينشئ Matter.

↓

يربطه بالـ Client.

↓

يعيّن Lawyer.

↓

Matter تظهر للمحامي.

↓

تظهر لصاحب المكتب.

↓

تعمل Offline بعد Sync.

↓

Office B لا يستطيع رؤيتها.

إذا نجح هذا:

لدينا Foundation صحيحة.

---

# 62. بعد ذلك

وسع نفس Architecture إلى:

Appointments

Hearings

Tasks

Deadlines

Documents

Workflows

Finance.

---

# 63. Security

راجع باستمرار:

Supabase RLS.

Storage policies.

Authentication.

Authorization.

Secrets.

Service role.

Local encryption.

Sensitive legal data.

Tenant isolation.

---

# 64. Service Role

ممنوع وضع:

Supabase Service Role Key

داخل:

Mobile App

Frontend

Expo bundle.

---

# 65. Testing

كل Module يجب أن يملك Tests.

خصوصاً:

Cross-office isolation.

Offline operations.

Sync.

Conflict handling.

Permissions.

Financial calculations.

Receipt numbering.

Audit trail.

---

# 66. لا تغير UI بلا داعٍ

المرحلة الحالية Architecture أولاً.

لا تعيد تصميم كل التطبيق.

حافظ على التصميم الحالي الجيد.

عدل UI فقط عندما:

Feature تحتاجه.

أو UX الحالي يمنع الوظيفة.

---

# 67. Do Not Hide Technical Debt

إذا اكتشفت مشكلة:

سجلها.

لكن إذا كانت Blocker للمعمارية:

أصلحها فوراً.

---

# 68. كل Task مستقبلية

في بداية أي Task جديدة:

اقرأ على الأقل:

`docs/MAKTABI_MASTER_VISION.md`

`docs/MAKTABI_ARCHITECTURE.md`

`docs/IMPLEMENTATION_ROADMAP.md`

ثم افحص الملفات المرتبطة بالـ Task.

بعدها نفذ.

---

# 69. قبل إنهاء أي Task

راجع:

هل التعديل يتوافق مع:

Case-Centric Architecture؟

Offline First؟

Multi-Tenant؟

Security؟

Sudan Legal Context؟

RBAC؟

Sync؟

Future roadmap؟

إذا لا:

صححه قبل إنهاء المهمة.

---

# 70. Update Documentation Automatically

أي Architecture decision مهم:

سجله مباشرة في:

`docs/MAKTABI_ARCHITECTURE.md`.

أي Feature تم إنجازها:

حدث:

`docs/IMPLEMENTATION_ROADMAP.md`.

وأي تغيير على الهدف الوظيفي:

لا تغير:

`MAKTABI_MASTER_VISION.md`

بشكل صامت.

Master Vision يمثل هدف المنتج.

إذا رأيت ضرورة لتغييره:

اكتب:

Architecture/Product Decision Record

واشرح السبب.

---

# 71. لا تجعل Codex ينتظرني في التفاصيل الصغيرة

إذا القرار هندسي واضح:

اتخذه.

نفذه.

اختبره.

وثقه.

لا تسألني عن:

file names

minor refactors

type definitions

folder names

migration naming

tests

implementation details.

اسأل فقط إذا كان القرار يغير:

Product behavior

Legal workflow

Financial meaning

Security policy

أو Business requirement غير محدد.

---

# 72. Definition of Success

Maktabi النهائي يجب أن يسمح لصاحب مكتب محاماة سوداني أن يدير مكتبه بالكامل من التطبيق.

من أول:

دخول العميل.

↓

فتح القضية.

↓

الشرطة.

↓

النيابة.

↓

المحكمة.

↓

الجلسات.

↓

المستندات.

↓

الموظفين.

↓

الأتعاب.

↓

المصروفات.

↓

الإيصالات.

↓

الحكم.

↓

الاستئناف.

↓

التنفيذ.

↓

الأرشفة.

وفي نفس النظام يستطيع:

البحث في القانون.

البحث في السوابق.

إنشاء مذكرة.

استخدام AI.

إرسال تحديث للعميل.

إدارة موظفيه.

ومراجعة الأداء المالي والإداري للمكتب.

حتى إذا انقطع الإنترنت مؤقتاً.

---

# 73. أهم قاعدة أخيرة

لا تنفذ Tasks بمعزل عن الصورة الكبرى.

أنت لا تبني مجموعة Screens.

أنت تبني:

# Maktabi Legal Practice Operating System.

كل تعديل يجب أن يكون جزءاً من هذه المنظومة.

---

ابدأ الآن بهذه الخطوات:

1. افحص Repository الحالي بالكامل.
2. قارن Architecture الحالية مع Master Vision.
3. أنشئ/حدّث ملفات الوثائق الثلاثة.
4. حدد Architecture Drift الموجود حالياً.
5. صحح أي Foundation Decisions خطيرة قبل البناء فوقها.
6. ضع Target Architecture واضحة لـ Offline-First + Multi-Tenant + Sync.
7. ابدأ تنفيذ المرحلة الحالية:
   Office Membership → Shared Clients → Matters → Assignments → RLS → Offline Sync.
8. شغّل Tests.
9. أصلح الأخطاء.
10. حدّث Roadmap.

لا تتوقف عند كتابة تقرير.

**نفّذ التغييرات فعلياً داخل المشروع حتى تصبح Architecture الحالية خطوة حقيقية نحو الصورة النهائية لـ Maktabi.**