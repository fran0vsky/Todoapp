import { test, expect } from '@playwright/test';
import {
  createProjectAndOpenBoard,
  dynamicContentMask,
  waitForBoardLoaded,
  waitForProjectsPage,
} from './helpers';

const SCREENSHOT_OPTIONS = {
  fullPage: true,
  maxDiffPixelRatio: 0.01,
} as const;

test.describe('visual regression - authenticated', () => {
  test('projects list page', async ({ page }) => {
    await page.goto('./');
    await waitForProjectsPage(page);
    await expect(page).toHaveScreenshot('projects-list.png', {
      ...SCREENSHOT_OPTIONS,
      mask: dynamicContentMask(page),
    });
  });

  test('board view', async ({ page }) => {
    const boardName = 'Visual Regression Board';
    await createProjectAndOpenBoard(page, boardName);
    await waitForBoardLoaded(page);
    await expect(page).toHaveScreenshot('board-view.png', {
      ...SCREENSHOT_OPTIONS,
      mask: dynamicContentMask(page),
    });
  });
});
