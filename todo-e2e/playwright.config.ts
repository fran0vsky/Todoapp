import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';
import { join } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: join(workspaceRoot, 'todo-e2e/.env') });
loadEnv({ path: join(workspaceRoot, '.env') });

const authFile = join(workspaceRoot, 'todo-e2e/.auth/user.json');

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npx nx run api:serve',
      url: 'http://localhost:3333/api/health',
      reuseExistingServer: !process.env['CI'],
      cwd: workspaceRoot,
    },
    {
      command: 'npx nx run todo:serve',
      url: 'http://localhost:4200',
      reuseExistingServer: !process.env['CI'],
      cwd: workspaceRoot,
    },
  ],
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium-public',
      testMatch: /public\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['setup'],
      testMatch: /app\.spec\.ts/,
    },
  ],
});
