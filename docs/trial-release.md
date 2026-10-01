# إرسال نسخة تجريبية للعميل

آخر تحديث: 2026-10-01

النسخة التجريبية للعرض فقط: مسار القضية (المواعيد والمستندات والأتعاب والإيصالات والمراحل) ما زال على الجهاز، فلا تُدخل بيانات موكلين حقيقية.

لا نرسل رابط Expo Go: منذ SDK 57 يجب أن يدخل المطوّر والعميل بحساب Expo نفسه، ويعمل الرابط فقط ما دام جهاز المطوّر شغالاً.

## الإعداد (مرة واحدة)

```bash
npm i -g eas-cli
eas login
cd apps/mobile
eas init        # يكتب projectId في app.json؛ اعمل commit للتغيير
```

إعدادات Supabase للبناء في `apps/mobile/eas.json` (`build.base.env`)، لأن `.env` مستثنى من Git ولا يصل إلى خوادم EAS. المفتاح publishable وليس سراً؛ لا تضع أبداً مفتاح `service_role` في التطبيق.

## أندرويد: رابط APK

```bash
cd apps/mobile
eas build --profile preview --platform android
```

في النهاية يعطيك EAS رابطاً و QR. أرسل الرابط للعميل؛ يفتحه من جواله، ينزّل الـAPK، يسمح بتثبيت التطبيقات من مصادر غير معروفة، ثم يثبّته. الرابط يفتح لأي شخص يملكه دون حساب Expo.

## آيفون: TestFlight

يحتاج اشتراك Apple Developer.

```bash
eas build --profile production --platform ios
eas submit -p ios
```

ثم أضف بريد العميل كمختبر في TestFlight.

## بدون تثبيت: رابط ويب

```bash
cd apps/mobile
cp .env.example .env
npx expo export --platform web --clear
eas deploy --prod
```

على الويب، تحديث الصفحة يطلب كلمة المرور من جديد (لفتح المساحة المحلية المشفّرة).

## حساب العميل

إما أن ينشئ مالك المنصة مكتباً ومديره من `/platform`، أو يطلب العميل بنفسه من شاشة الدخول ← «اطلب مكتباً تجريبياً»، ثم يوافق مالك المنصة على الطلب من بطاقة «طلبات المكاتب التجريبية» في `/platform`. رقم الهاتف سوداني (`09xxxxxxxx`) ولا تُرسل رسائل SMS، فالرقم اسم مستخدم فقط. كلمة المرور 10 أحرف على الأقل.

قبل الإرسال تأكد في Supabase: Authentication ← تعطيل «Allow new users to sign up» (الحسابات تُنشأ من `manage-users` فقط)، وتفعيل Leaked password protection.
