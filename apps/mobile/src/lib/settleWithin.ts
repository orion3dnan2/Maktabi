// Startup work that reads session storage or calls the server must not keep the splash screen up forever:
// getSession() refreshes an expired session over the network (auth-js retries for up to 30s), and a stalled
// request never settles.
export const STARTUP_TIMEOUT_MS = 10_000;

/** Resolves with `work()`'s result, or with `fallback` if it throws, rejects or takes longer than `timeoutMs`. */
export async function settleWithin<T>(work: () => Promise<T>, fallback: T, timeoutMs = STARTUP_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), timeoutMs); });
  try {
    return await Promise.race([work(), timedOut]);
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
