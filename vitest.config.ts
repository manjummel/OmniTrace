import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 25000,
    include: ['packages/*/test/**/*.test.ts', 'src/test/**/*.test.ts']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@blast-radius/core': path.resolve(__dirname, './packages/core/src/index.ts')
    }
  }
});
