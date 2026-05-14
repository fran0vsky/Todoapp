import { test, expect } from '@playwright/test';
import {
  dynamicContentMask,
  expectLoginHeading,
  expectRegisterHeading,
} from './helpers';

const SCREENSHOT_OPTIONS = {
  fullPage: true,
  maxDiffPixelRatio: 0.01,
} as const;

test.describe('visual regression - public', () => {
  test('login page', async ({ page }) => {
    await page.goto('login');
    await expectLoginHeading(page);
    await expect(page).toHaveScreenshot('login-page.png', {
      ...SCREENSHOT_OPTIONS,
      mask: dynamicContentMask(page),
    });
  });

  test('register page', async ({ page }) => {
    await page.goto('register');
    await expectRegisterHeading(page);
    await expect(page).toHaveScreenshot('register-page.png', {
      ...SCREENSHOT_OPTIONS,
      mask: dynamicContentMask(page),
    });
  });
});
