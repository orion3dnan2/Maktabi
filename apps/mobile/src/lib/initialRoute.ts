export type InitialRoute = '/(tabs)' | '/login';

// getSession() refreshes an expired stored session over the network: auth-js retries for up to 30s,
// and a stalled request never settles. The splash must not wait on that indefinitely.
export const SESSION_CHECK_TIMEOUT_MS = 10_000;

export async function resolveInitialRoute(
  getSession: () => Promise<{ data: { session: unknown } }>,
  timeoutMs = SESSION_CHECK_TIMEOUT_MS,
): Promise<InitialRoute> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); });
  try {
    const result = await Promise.race([getSession(), timedOut]);
    return result?.data.session ? '/(tabs)' : '/login';
  } catch {
    // Storage failures and unreadable sessions fall back to login instead of leaving the splash stuck.
    return '/login';
  } finally {
    clearTimeout(timer);
  }
}
