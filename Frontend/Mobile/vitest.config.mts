import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: [
      // MUST come before the generic @ alias — specific first.
      { find: '@/constants/i18n', replacement: path.resolve(__dirname, 'tests/stubs/i18n.ts') },
      { find: '@', replacement: path.resolve(__dirname, '.') },
    ],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/apiClient.security.test.cjs', 'node_modules/**'],
  },
});
