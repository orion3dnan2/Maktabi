# مكتبي — Maktabi

تطبيق جوال عربي أولاً لإدارة أعمال مكاتب المحاماة. التطبيق الأساسي **React Native + Expo + TypeScript + Expo Router** داخل `apps/mobile`.

> المصادقة والصلاحيات (Supabase + RLS) منفذة في المرحلة 1. بيانات شاشات المكتب ما زالت محلية مشفّرة على الجهاز حتى المرحلة 2، فلا تُدخل بيانات موكلين حقيقية بعد.

## المتطلبات

- Node.js 20+
- pnpm 10+
- تطبيق Expo Go متوافق مع Expo SDK 57، أو محاكي Android/iOS

## التشغيل

```bash
pnpm install
copy apps\mobile\.env.example apps\mobile\.env
pnpm --filter @maktabi/mobile exec expo start -c
```

الدخول برقم الهاتف وكلمة المرور. الحسابات تُنشأ من داخل التطبيق فقط: مالك المنصة ← مدير المكتب ← فريق المكتب والموكلين. التفاصيل في [المرحلة 1 — الحسابات والصلاحيات](docs/phase-1-accounts.md).

بعد بدء Metro استخدم `a` لمحاكي Android، أو `i` لمحاكي iOS على macOS، أو امسح رمز QR من Expo Go. للويب الثانوي استخدم `w`.

## بنية المستودع

- `apps/mobile`: تطبيق Expo الأساسي.
- `apps/web`: مساحة محجوزة للوحة المكتب المستقبلية؛ غير منفذة.
- `apps/api`: مساحة محجوزة للخادم المستقبلي؛ غير منفذ.
- `packages/domain`: نماذج المجال وعقود المستودعات والقواعد غير المرتبطة بواجهة.
- `packages/ui`: رموز ومكونات تصميم React Native مشتركة.
- `packages/types`, `packages/validation`, `packages/config`: أساس المشاركة المستقبلية.

## اختبار Android عن بُعد

ملف `apps/mobile/eas.json` يحتوي ملف تعريف `preview` مهيأ لإخراج APK داخلي، لكن لم يُنشأ APK في هذه الدفعة. يتطلب البناء لاحقاً حساب Expo/EAS وأمر `eas build --platform android --profile preview` بعد موافقة المالك.

## الهوية البصرية

المرجع البصري المعتمد موثّق في `docs/ui-visual-spec.md`، وتُطبَّق رموزه من `packages/ui/src/theme.ts` (الألوان، الخط Tajawal، المسافات، الظلال، ومساعدات الاتجاه `rtl`). لقطات المعاينة في `docs/screenshots/`.


علامة الميزان الحالية **مؤقتة** وليست شعاراً نهائياً معتمداً. يجب استبدالها بملف الشعار الإنتاجي الذي يقدمه المالك.
