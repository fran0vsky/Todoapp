import { test, expect } from '@playwright/test';

test('todo app: projects list or login', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  if (page.url().includes('/login')) {
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
    return;
  }

  await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toBeVisible();
  await expect(page.getByRole('button', { name: /create project/i })).toBeVisible();
});

test('board shows project title and add task UI after creating a project', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  if (page.url().includes('/login')) {
    test.skip(true, 'Requires an authenticated session');
  }

  await expect(page.getByRole('button', { name: /create project/i })).toBeVisible({ timeout: 15_000 });
  const projectName = `E2E ${Date.now()}`;
  await page.getByPlaceholder(/project name/i).fill(projectName);
  await page.getByRole('button', { name: /create project/i }).click();
  await page.waitForURL(/\/p\/\d+/, { timeout: 20_000 });

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(projectName);
  await expect(page.getByRole('link', { name: /all projects/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^add$/i })).toBeVisible();
  await page.getByRole('button', { name: /^add$/i }).click();
  await expect(page.getByPlaceholder('Title...')).toBeVisible();
});
