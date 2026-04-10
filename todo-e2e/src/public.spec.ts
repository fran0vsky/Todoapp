import { test, expect } from '@playwright/test';

test.describe('without a session', () => {
  test('home redirects to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  });

  test('register page renders', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Register' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Register' })).toBeVisible();
  });
});
