import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../node_modules/.vite/api',
  plugins: [nxViteTsPaths()],
  test: {
    name: 'api',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
    pool: 'forks',
    coverage: {
      reportsDirectory: '../coverage/api',
      provider: 'v8' as const,
      reporter: ['text', 'html', 'lcov'],
      include: ['src/services/validation.ts'],
      all: false,
      thresholds: {
        lines: 100,
        statements: 100,
        branches: 100,
        functions: 100,
      },
    },
  },
}));
