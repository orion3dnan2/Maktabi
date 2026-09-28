import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveInitialRoute, SESSION_CHECK_TIMEOUT_MS } from "./initialRoute";

describe("resolveInitialRoute", () => {
  afterEach(() => vi.useRealTimers());

  it("opens the tabs when a session is stored", async () => {
    const route = await resolveInitialRoute(async () => ({ data: { session: { access_token: "t" } } }));
    expect(route).toBe("/(tabs)");
  });

  it("opens login when there is no session or getSession reports an error", async () => {
    expect(await resolveInitialRoute(async () => ({ data: { session: null } }))).toBe("/login");
    expect(
      await resolveInitialRoute(async () => ({ data: { session: null }, error: new Error("refresh failed") })),
    ).toBe("/login");
  });

  it("opens login when session storage rejects", async () => {
    const route = await resolveInitialRoute(() => Promise.reject(new Error("SecureStore unavailable")));
    expect(route).toBe("/login");
  });

  it("opens login when getSession throws synchronously", async () => {
    const route = await resolveInitialRoute(() => {
      throw new TypeError("getValueWithKeyAsync is not a function");
    });
    expect(route).toBe("/login");
  });

  it("opens login when getSession never settles", async () => {
    vi.useFakeTimers();
    const pending = resolveInitialRoute(() => new Promise(() => {}));
    await vi.advanceTimersByTimeAsync(SESSION_CHECK_TIMEOUT_MS - 1);
    let settled = false;
    void pending.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toBe("/login");
  });

  it("clears the timeout once getSession settles", async () => {
    vi.useFakeTimers();
    await resolveInitialRoute(async () => ({ data: { session: null } }));
    expect(vi.getTimerCount()).toBe(0);
  });
});
