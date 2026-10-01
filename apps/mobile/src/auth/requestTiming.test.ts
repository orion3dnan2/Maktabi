import { describe, expect, it, vi } from 'vitest';
import { padOfficeRequest } from '../../../../supabase/functions/manage-users/requestTiming';

describe('public office request timing mitigation', () => {
  it('pads both fast duplicate and slower new-account responses to the same minimum', async () => {
    const waits: number[] = [];
    await padOfficeRequest(1000, () => 1100, async ms => { waits.push(ms); });
    await padOfficeRequest(1000, () => 2400, async ms => { waits.push(ms); });
    expect(waits).toEqual([1900, 600]);
  });
  it('adds no delay when the Auth service already took longer than the minimum', async () => {
    const wait = vi.fn();
    await padOfficeRequest(1000, () => 5000, wait);
    expect(wait).not.toHaveBeenCalled();
  });
});
