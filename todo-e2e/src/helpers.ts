import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/** Board toolbar voice button (`aria-label`). */
export const VOICE_BOARD_MIC = 'Voice: new task or board command';

export async function waitForProjectsPage(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { level: 1, name: 'Projects' }),
  ).toBeVisible({
    timeout: 30_000,
  });
}

export async function waitForBoardLoaded(page: Page): Promise<void> {
  await expect(page.getByText('Loading tasks...')).toBeHidden({
    timeout: 30_000,
  });
}

/** Creates a project via the list UI and lands on `/p/:id`. */
export async function createProjectAndOpenBoard(
  page: Page,
  name: string,
): Promise<void> {
  await page.goto('./');
  await waitForProjectsPage(page);
  await page.getByPlaceholder(/project name/i).fill(name);
  await page.getByRole('button', { name: /create project/i }).click();
  await page.waitForURL(/\/p\/\d+/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  await waitForBoardLoaded(page);
}

export async function openAddTaskModal(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^add$/i }).click();
  await expect(page.getByPlaceholder('Title...')).toBeVisible();
}

/**
 * Fills the rich-text description field (a contenteditable div) in the task
 * form modal. Description is required by the app before Save is enabled.
 */
export async function fillDescriptionField(
  page: Page,
  text: string,
): Promise<void> {
  await page.locator('[contenteditable="true"]').fill(text);
}

export async function saveTaskForm(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Save' }).click();
}

export function taskCardInColumn(
  page: Page,
  columnHeading: string,
  taskTitle: string,
) {
  return page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: columnHeading }) })
    .getByRole('listitem')
    .filter({ hasText: taskTitle });
}

export async function expectLoginHeading(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { level: 2, name: 'Login' }),
  ).toBeVisible();
}

export async function expectRegisterHeading(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { level: 2, name: 'Register' }),
  ).toBeVisible();
}

/**
 * Returns locators that contain dynamic content (timestamps, IDs, generated
 * names) which should be masked when taking visual-regression screenshots.
 */
export function dynamicContentMask(page: Page) {
  return [
    page.locator('time'),
    page.locator('[data-testid="project-id"]'),
    page.locator('[data-testid="task-id"]'),
  ];
}
