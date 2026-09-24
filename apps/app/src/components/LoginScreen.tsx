import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react';
import { Button, Field } from '@maktabi/ui';
import { BrandMark } from './BrandMark';

export function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!data.get('identity') || !data.get('password')) { setError('أدخل بيانات الدخول للمتابعة'); return; }
    onLogin();
  }
  return (
    <main className="login-page">
      <div className="login-page__legal" aria-hidden="true"><span>§</span></div>
      <form className="login-card" onSubmit={submit} noValidate>
        <BrandMark />
        <header><h1>أهلاً بك في نظام مكتبي</h1><p>أدخل بياناتك للوصول إلى مساحة عملك القانونية</p></header>
        <Field name="identity" label="اسم المستخدم أو البريد الإلكتروني" autoComplete="username" icon={<UserRound size={20} />} error={error || undefined} />
        <div className="password-wrap">
          <Field name="password" type={showPassword ? 'text' : 'password'} label="كلمة المرور" autoComplete="current-password" icon={<LockKeyhole size={20} />} />
          <button type="button" className="password-toggle" aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
        </div>
        <div className="login-options"><label><input type="checkbox" defaultChecked /> تذكرني</label><button type="button">نسيت كلمة المرور؟</button></div>
        <Button type="submit">تسجيل الدخول</Button>
        <p className="login-card__support">تحتاج إلى مساعدة؟ <button type="button">تواصل مع الدعم</button></p>
      </form>
    </main>
  );
}
