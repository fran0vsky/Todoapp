import { test, expect } from '@playwright/test';
import { expectLoginHeading, expectRegisterHeading } from './helpers';

test.describe('without a session', () => {
  test('home redirects to login', async ({ page }) => {
    await page.goto('./');
    await expect(page).toHaveURL(/\/login/);
    await expectLoginHeading(page);
  });

  test('deep link to project board redirects to login', async ({ page }) => {
    await page.goto('p/1');
    await expect(page).toHaveURL(/\/login/);
    await expectLoginHeading(page);
  });

  test('invalid project route still redirects to login', async ({ page }) => {
    await page.goto('p/abc');
    await expect(page).toHaveURL(/\/login/);
  });

  test('register page renders', async ({ page }) => {
    await page.goto('register');
    await expectRegisterHeading(page);
    await expect(page.getByRole('button', { name: 'Register' })).toBeVisible();
  });

  test('login shows disabled submit until valid credentials', async ({
    page,
  }) => {
    await page.goto('login');
    await expectLoginHeading(page);

    const submit = page.getByRole('button', { name: 'Login' });
    await expect(submit).toBeDisabled();

    await page.getByPlaceholder('you@example.com').fill('a@b.co');
    await expect(submit).toBeDisabled();

    await page.getByPlaceholder('Your password').fill('secret');
    await expect(submit).toBeEnabled();
  });

  test('invalid email shows validation border after typing', async ({
    page,
  }) => {
    await page.goto('login');
    const email = page.getByPlaceholder('you@example.com');
    await email.fill('not-an-email');
    await expect(email).toHaveClass(/border-red-500/);
  });

  test('navigation between login and register', async ({ page }) => {
    await page.goto('login');
    await page.getByRole('link', { name: 'Register' }).click();
    await expect(page).toHaveURL(/\/register/);
    await expectRegisterHeading(page);

    await page.getByRole('link', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/login/);
    await expectLoginHeading(page);
  });
});
