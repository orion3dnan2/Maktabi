// Test-only stand-in for expo-crypto (its real entry point loads native modules).
// Wired through the resolve.alias in vitest.config.ts.
export const randomUUID = (): string => globalThis.crypto.randomUUID();
export const getRandomBytes = (length: number): Uint8Array => globalThis.crypto.getRandomValues(new Uint8Array(length));
export const getRandomBytesAsync = async (length: number): Promise<Uint8Array> => getRandomBytes(length);
