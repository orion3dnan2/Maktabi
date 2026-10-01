/** Reduce the cheap timing distinction between a duplicate phone and a new account.
 * This is mitigation, not constant-time networking; database attempt budgets also apply.
 */
export async function padOfficeRequest(startedAt: number, now = Date.now, wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))) {
  const remaining = 2000 - (now() - startedAt);
  if (remaining > 0) await wait(remaining);
}
