# مكتبي — Maktabi

تطبيق جوال عربي أولاً لإدارة أعمال مكاتب المحاماة. التطبيق الأساسي **React Native + Expo + TypeScript + Expo Router** داخل `apps/mobile`.

> كل البيانات الحالية تجريبية. لا توجد مصادقة آمنة أو مزامنة أو تشفير مُنفّذ حتى الآن، ولا ينبغي إدخال بيانات موكلين حقيقية.

## المتطلبات

- Node.js 20+
- pnpm 10+
- تطبيق Expo Go متوافق مع Expo SDK 54، أو محاكي Android/iOS

## التشغيل

```bash
pnpm install
pnpm --filter @maktabi/mobile start
```

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

## الهوية

علامة الميزان الحالية **مؤقتة** وليست شعاراً نهائياً معتمداً. يجب استبدالها بملف الشعار الإنتاجي الذي يقدمه المالك.
