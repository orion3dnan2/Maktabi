import { afterEach, describe, expect, it, vi } from 'vitest';
import { settleWithin, STARTUP_TIMEOUT_MS } from './settleWithin';

describe('settleWithin', () => {
  afterEach(() => vi.useRealTimers());

  it('returns the result when the work settles in time', async () => {
    expect(await settleWithin(async () => 'ready', 'fallback')).toBe('ready');
    expect(await settleWithin(async () => undefined, 'fallback')).toBeUndefined();
  });

  it('returns the fallback when the work rejects', async () => {
    expect(await settleWithin(() => Promise.reject(new Error('SecureStore unavailable')), 'fallback')).toBe('fallback');
  });

  it('returns the fallback when the work throws synchronously', async () => {
    const work = () => { throw new TypeError('getValueWithKeyAsync is not a function'); };
    expect(await settleWithin(work, 'fallback')).toBe('fallback');
  });

  it('returns the fallback when the work never settles', async () => {
    vi.useFakeTimers();
    const pending = settleWithin(() => new Promise<string>(() => {}), 'fallback');
    await vi.advanceTimersByTimeAsync(STARTUP_TIMEOUT_MS - 1);
    let settled = false;
    void pending.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toBe('fallback');
  });

  it('clears the timeout once the work settles', async () => {
    vi.useFakeTimers();
    await settleWithin(async () => 'ready', 'fallback');
    expect(vi.getTimerCount()).toBe(0);
  });
});
