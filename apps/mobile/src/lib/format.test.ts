import { describe, expect, it } from 'vitest';
import { calendarDaysFrom, countLabel, formatCompact, formatDayMonth, formatMoney, formatTime, relativeDay, relativePast, units } from './format';

const now = new Date('2026-09-24T09:00:00Z'); // 11:00 in Khartoum

describe('office-time formatting', () => {
  it('shows session times in Khartoum time, not UTC', () => {
    expect(formatTime('2026-09-24T10:30:00Z')).toMatch(/12:30/);
    expect(formatTime('2026-09-24T06:15:00Z')).toMatch(/08:15/);
  });
  it('formats the real due date instead of a fixed label', () => {
    expect(formatDayMonth('2026-09-27T13:00:00Z')).toContain('27');
    expect(formatDayMonth('2026-09-27T13:00:00Z')).toContain('سبتمبر');
    expect(formatDayMonth('2026-10-02T13:00:00Z')).toContain('أكتوبر');
  });
  it('uses the office calendar day across the UTC midnight boundary', () => {
    // 23:30 UTC on the 24th is already the 25th in Khartoum (UTC+2).
    expect(calendarDaysFrom('2026-09-24T23:30:00Z', now)).toBe(1);
  });
});

describe('Arabic plurals', () => {
  it('agrees counts with the noun', () => {
    expect(countLabel(1, units.session)).toBe('جلسة واحدة');
    expect(countLabel(2, units.session)).toBe('جلستان');
    expect(countLabel(3, units.session)).toBe('3 جلسات');
    expect(countLabel(11, units.session)).toBe('11 جلسة');
    expect(countLabel(103, units.item)).toBe('103 عناصر');
  });
});

describe('relative phrases', () => {
  it('describes upcoming days', () => {
    expect(relativeDay('2026-09-24T20:00:00Z', now)).toBe('اليوم');
    expect(relativeDay('2026-09-25T08:00:00Z', now)).toBe('غداً');
    expect(relativeDay('2026-09-27T13:00:00Z', now)).toBe('بعد 3 أيام');
    expect(relativeDay('2026-10-10T13:00:00Z', now)).toBe('بعد 16 يوماً');
  });
  it('describes past activity', () => {
    expect(relativePast('2026-09-24T08:40:00Z', now)).toBe('منذ 20 دقيقة');
    expect(relativePast('2026-09-24T06:00:00Z', now)).toBe('منذ 3 ساعات');
    expect(relativePast('2026-09-23T11:40:00Z', now)).toBe('أمس');
  });
});

describe('money', () => {
  it('converts minor units and appends the currency symbol', () => {
    expect(formatMoney(485000000, 'SDG')).toBe('4,850,000 ج.س');
    expect(formatMoney(1050, 'USD')).toBe('11 $');
  });
  it('shortens large amounts for metric tiles', () => {
    expect(formatCompact(4_850_000)).toEqual({ value: '4.85', scale: 'مليون' });
    expect(formatCompact(350_000)).toEqual({ value: '350', scale: 'ألف' });
    expect(formatCompact(900)).toEqual({ value: '900', scale: '' });
  });
});
