import { test, expect } from '@playwright/test';

test('todo page shows tasks UI', async ({ page }) => {
  await page.goto('/');

  // Should show the Tasks heading (not a blank page)
  await expect(page.locator('h1')).toHaveText('Tasks');
  // Add button visible
  await expect(page.getByRole('button', { name: /add/i })).toBeVisible();
  // Placeholder in input
  await expect(page.getByPlaceholder(/new task/i)).toBeVisible();
});
