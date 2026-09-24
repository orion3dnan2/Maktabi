/** Office-local presentation helpers. Pure functions so they can be unit-tested without React Native. */
export const OFFICE_TIME_ZONE = 'Africa/Khartoum';
const LOCALE = 'ar-SD-u-nu-latn';
const DAY_MS = 86_400_000;

const timeFormat = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: OFFICE_TIME_ZONE });
const dayMonthFormat = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', timeZone: OFFICE_TIME_ZONE });
const ymdFormat = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: OFFICE_TIME_ZONE });
const integerFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

/** "09:30 ص" in office time. */
export const formatTime = (iso: string): string => timeFormat.format(new Date(iso));
/** "الأحد 27 سبتمبر" in office time. */
export const formatDayMonth = (iso: string): string => dayMonthFormat.format(new Date(iso));
export const formatInteger = (value: number): string => integerFormat.format(value);

const currencySymbol: Record<string, string> = { SDG: 'ج.س', USD: '$' };
export const currencyLabel = (currency: string): string => currencySymbol[currency] ?? currency;
/** Short form for tight tiles, split so the scale word can sit with the unit: {4.85, مليون} / {350, ألف}. */
export function formatCompact(value: number): { value: string; scale: string } {
  if (Math.abs(value) >= 1_000_000) return { value: new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 }).format(value / 1_000_000), scale: 'مليون' };
  if (Math.abs(value) >= 1_000) return { value: new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(value / 1_000), scale: 'ألف' };
  return { value: formatInteger(value), scale: '' };
}
/** Money is stored in minor units (1/100). */
export const formatMoney = (amountMinor: number, currency: string): string => `${formatInteger(amountMinor / 100)} ${currencyLabel(currency)}`;

const officeDayIndex = (date: Date): number => Date.parse(`${ymdFormat.format(date)}T00:00:00Z`) / DAY_MS;
/** Whole calendar days between `now` and `iso` in office time (negative = past). */
export const calendarDaysFrom = (iso: string, now: Date): number => officeDayIndex(new Date(iso)) - officeDayIndex(now);

/** Arabic count phrase with correct plural agreement, e.g. countLabel(3, units.day) → "3 أيام". */
export interface PluralForms { one: string; two: string; few: string; many: string }
export function countLabel(n: number, forms: PluralForms): string {
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  const mod100 = n % 100;
  if (mod100 >= 3 && mod100 <= 10) return `${formatInteger(n)} ${forms.few}`;
  return `${formatInteger(n)} ${forms.many}`;
}
export const units = {
  day: { one: 'يوم واحد', two: 'يومان', few: 'أيام', many: 'يوماً' },
  hour: { one: 'ساعة', two: 'ساعتين', few: 'ساعات', many: 'ساعة' },
  minute: { one: 'دقيقة', two: 'دقيقتين', few: 'دقائق', many: 'دقيقة' },
  session: { one: 'جلسة واحدة', two: 'جلستان', few: 'جلسات', many: 'جلسة' },
  item: { one: 'عنصر واحد', two: 'عنصران', few: 'عناصر', many: 'عنصراً' },
  deadline: { one: 'موعد واحد', two: 'موعدان', few: 'مواعيد', many: 'موعداً' },
} satisfies Record<string, PluralForms>;

/** "اليوم" / "غداً" / "بعد 3 أيام" / "أمس" / "منذ 3 أيام". */
export function relativeDay(iso: string, now: Date): string {
  const days = calendarDaysFrom(iso, now);
  if (days === 0) return 'اليوم';
  if (days === 1) return 'غداً';
  if (days === -1) return 'أمس';
  const unit = { ...units.day, one: 'يوم', two: 'يومين' };
  return days > 0 ? `بعد ${countLabel(days, unit)}` : `منذ ${countLabel(-days, unit)}`;
}

/** Past-event phrase: "الآن" / "منذ 20 دقيقة" / "منذ 3 ساعات" / "أمس" / "منذ 4 أيام". */
export function relativePast(iso: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `منذ ${countLabel(minutes, units.minute)}`;
  if (calendarDaysFrom(iso, now) === 0) return `منذ ${countLabel(Math.floor(minutes / 60), units.hour)}`;
  return relativeDay(iso, now);
}
