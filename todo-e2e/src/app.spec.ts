import { test, expect } from '@playwright/test';
import {
  createProjectAndOpenBoard,
  openAddTaskModal,
  saveTaskForm,
  taskCardInColumn,
  waitForBoardLoaded,
  waitForProjectsPage,
} from './helpers';

test.describe('projects', () => {
  test('lists projects and opens a board from View', async ({ page }) => {
    const boardName = `Board ${Date.now()}`;
    await createProjectAndOpenBoard(page, boardName);

    await page.getByRole('link', { name: /all projects/i }).click();
    await waitForProjectsPage(page);

    await expect(page.getByText(boardName)).toBeVisible();
    await page
      .getByRole('listitem')
      .filter({ hasText: boardName })
      .getByRole('button', { name: 'View' })
      .click();
    await page.waitForURL(/\/p\/\d+/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(boardName);
  });
});

test.describe('tasks', () => {
  test('adds a task and shows it in To be done', async ({ page }) => {
    const projectName = `P ${Date.now()}`;
    await createProjectAndOpenBoard(page, projectName);

    const title = `Task ${Date.now()}`;
    await openAddTaskModal(page);
    await page.getByPlaceholder('Title...').fill(title);
    await saveTaskForm(page);
    await expect(page.getByPlaceholder('Title...')).toBeHidden({ timeout: 10_000 });

    await waitForBoardLoaded(page);
    await expect(taskCardInColumn(page, 'To be done', title)).toBeVisible();
  });

  test('edits a task title', async ({ page }) => {
    const projectName = `P ${Date.now()}`;
    await createProjectAndOpenBoard(page, projectName);

    const original = `Orig ${Date.now()}`;
    await openAddTaskModal(page);
    await page.getByPlaceholder('Title...').fill(original);
    await saveTaskForm(page);
    await expect(page.getByPlaceholder('Title...')).toBeHidden({ timeout: 10_000 });
    await waitForBoardLoaded(page);

    const updated = `Updated ${Date.now()}`;
    await taskCardInColumn(page, 'To be done', original).getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByPlaceholder('Title...')).toBeVisible();
    await page.getByPlaceholder('Title...').fill(updated);
    await saveTaskForm(page);
    await expect(page.getByPlaceholder('Title...')).toBeHidden({ timeout: 10_000 });
    await waitForBoardLoaded(page);

    await expect(taskCardInColumn(page, 'To be done', updated)).toBeVisible();
  });

  test('moves task to Done and archives, then restores', async ({ page }) => {
    const projectName = `P ${Date.now()}`;
    await createProjectAndOpenBoard(page, projectName);

    const title = `Archive ${Date.now()}`;
    await openAddTaskModal(page);
    await page.getByPlaceholder('Title...').fill(title);
    await saveTaskForm(page);
    await expect(page.getByPlaceholder('Title...')).toBeHidden({ timeout: 10_000 });
    await waitForBoardLoaded(page);

    await taskCardInColumn(page, 'To be done', title).getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Task status').selectOption('done');
    await saveTaskForm(page);
    await expect(page.getByPlaceholder('Title...')).toBeHidden({ timeout: 10_000 });
    await waitForBoardLoaded(page);

    await expect(taskCardInColumn(page, 'Done', title)).toBeVisible();
    await taskCardInColumn(page, 'Done', title).getByRole('button', { name: 'Archive' }).click();
    await waitForBoardLoaded(page);
    await expect(taskCardInColumn(page, 'Done', title)).toBeHidden({ timeout: 15_000 });

    const archiveRegion = page.getByRole('region', { name: 'Archived tasks' });
    await archiveRegion.locator('button').first().click();
    await expect(page.getByRole('heading', { name: 'Archived tasks' })).toBeVisible();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await page
      .getByRole('listitem')
      .filter({ hasText: title })
      .getByRole('button', { name: 'Restore' })
      .click();
    await waitForBoardLoaded(page);
    await expect(taskCardInColumn(page, 'Done', title)).toBeVisible();
  });

  test('deletes a task from the board', async ({ page }) => {
    const projectName = `P ${Date.now()}`;
    await createProjectAndOpenBoard(page, projectName);

    const title = `Delete ${Date.now()}`;
    await openAddTaskModal(page);
    await page.getByPlaceholder('Title...').fill(title);
    await saveTaskForm(page);
    await expect(page.getByPlaceholder('Title...')).toBeHidden({ timeout: 10_000 });
    await waitForBoardLoaded(page);

    await taskCardInColumn(page, 'To be done', title).getByRole('button', { name: 'Remove' }).click();
    await waitForBoardLoaded(page);
    await expect(taskCardInColumn(page, 'To be done', title)).toHaveCount(0);
  });
});
