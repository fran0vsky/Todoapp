/* eslint-disable playwright/no-standalone-expect -- setup project persists auth; expect is intentional */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test as setup, expect } from '@playwright/test';
import { workspaceRoot } from '@nx/devkit';

const authFile = join(workspaceRoot, 'todo-e2e/.auth/user.json');

setup('authenticate', async ({ page }) => {
  const email = process.env['E2E_EMAIL'];
  const password = process.env['E2E_PASSWORD'];
  if (!email?.trim() || !password) {
    throw new Error(
      'Set E2E_EMAIL and E2E_PASSWORD for Playwright (see todo-e2e/.env.example).',
    );
  }

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Projects' }),
  ).toBeVisible({
    timeout: 30_000,
  });

  mkdirSync(dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
