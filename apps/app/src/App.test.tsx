import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

describe('Maktabi application flow', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it('moves from splash to login and validates credentials', () => {
    render(<App />);
    expect(screen.getByText('مساحتك القانونية، منظمة وآمنة')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(901));
    expect(screen.getByRole('heading', { name: 'أهلاً بك في نظام مكتبي' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'تسجيل الدخول' }));
    expect(screen.getByText('أدخل بيانات الدخول للمتابعة')).toBeInTheDocument();
  });
});
