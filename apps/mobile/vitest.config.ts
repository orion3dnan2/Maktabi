import { defineConfig } from 'vitest/config';

const here = (path: string) => decodeURIComponent(new URL(path, import.meta.url).pathname);

export default defineConfig({
  resolve: {
    alias: {
      '@': here('./src'),
      'expo-crypto': here('./src/test/expoCryptoShim.ts'),
    },
  },
});
