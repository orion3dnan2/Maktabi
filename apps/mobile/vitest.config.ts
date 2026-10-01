import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': here('./src'),
      'expo-crypto': here('./src/test/expoCryptoShim.ts'),
    },
  },
});
