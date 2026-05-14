import { test, expect } from '@playwright/test';
import {
  createProjectAndOpenBoard,
  fillDescriptionField,
  openAddTaskModal,
  saveTaskForm,
  taskCardInColumn,
  VOICE_BOARD_MIC,
  waitForBoardLoaded,
  waitForProjectsPage,
} from './helpers';

// Real microphone recording is unavailable in headless CI environments.
const skipVoiceRecording = !!process.env['CI'];

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
    await fillDescriptionField(page, 'Test description.');
    await saveTaskForm(page);
    await expect(page.getByPlaceholder('Title...')).toBeHidden({
      timeout: 10_000,
    });

    await waitForBoardLoaded(page);
    await expect(taskCardInColumn(page, 'To be done', title)).toBeVisible();
  });

  test('edits a task title', async ({ page }) => {
    const projectName = `P ${Date.now()}`;
    await createProjectAndOpenBoard(page, projectName);

    const original = `Orig ${Date.now()}`;
    await openAddTaskModal(page);
    await page.getByPlaceholder('Title...').fill(original);
    await fillDescriptionField(page, 'Test description.');
    await saveTaskForm(page);
    await expect(page.getByPlaceholder('Title...')).toBeHidden({
      timeout: 10_000,
    });
    await waitForBoardLoaded(page);

    const updated = `Updated ${Date.now()}`;
    await taskCardInColumn(page, 'To be done', original)
      .getByRole('button', { name: 'Edit' })
      .click();
    await expect(page.getByPlaceholder('Title...')).toBeVisible();
    await page.getByPlaceholder('Title...').fill(updated);
    await saveTaskForm(page);
    await expect(page.getByPlaceholder('Title...')).toBeHidden({
      timeout: 10_000,
    });
    await waitForBoardLoaded(page);

    await expect(taskCardInColumn(page, 'To be done', updated)).toBeVisible();
  });

  test('moves task to Done and archives, then restores', async ({ page }) => {
    const projectName = `P ${Date.now()}`;
    await createProjectAndOpenBoard(page, projectName);

    const title = `Archive ${Date.now()}`;
    await openAddTaskModal(page);
    await page.getByPlaceholder('Title...').fill(title);
    await fillDescriptionField(page, 'Test description.');
    await saveTaskForm(page);
    await expect(page.getByPlaceholder('Title...')).toBeHidden({
      timeout: 10_000,
    });
    await waitForBoardLoaded(page);

    await taskCardInColumn(page, 'To be done', title)
      .getByRole('button', { name: 'Edit' })
      .click();
    await page.getByLabel('Task status').selectOption('done');
    await saveTaskForm(page);
    await expect(page.getByPlaceholder('Title...')).toBeHidden({
      timeout: 10_000,
    });
    await waitForBoardLoaded(page);

    await expect(taskCardInColumn(page, 'Done', title)).toBeVisible();
    await taskCardInColumn(page, 'Done', title)
      .getByRole('button', { name: 'Archive' })
      .click();
    await waitForBoardLoaded(page);
    await expect(taskCardInColumn(page, 'Done', title)).toBeHidden({
      timeout: 15_000,
    });

    const archiveRegion = page.getByRole('region', { name: 'Archived tasks' });
    await archiveRegion.locator('button').first().click();
    await expect(
      page.getByRole('heading', { name: 'Archived tasks' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await page
      .getByRole('listitem')
      .filter({ hasText: title })
      .getByRole('button', { name: 'Restore' })
      .click();
    await waitForBoardLoaded(page);
    await expect(taskCardInColumn(page, 'Done', title)).toBeVisible();
  });

  test('exposes a dictation microphone button in the add task form', async ({
    page,
  }) => {
    const projectName = `P ${Date.now()}`;
    await createProjectAndOpenBoard(page, projectName);

    await openAddTaskModal(page);
    // Button is rendered in the idle state with this aria-label; transcription itself is not
    // driven end-to-end here because it requires a real microphone + model weights.
    const micButton = page.getByRole('button', { name: 'Dictate description' });
    await expect(micButton).toBeVisible();
    await expect(micButton).toBeEnabled();
  });

  test('deletes a task from the board', async ({ page }) => {
    const projectName = `P ${Date.now()}`;
    await createProjectAndOpenBoard(page, projectName);

    const title = `Delete ${Date.now()}`;
    await openAddTaskModal(page);
    await page.getByPlaceholder('Title...').fill(title);
    await fillDescriptionField(page, 'Test description.');
    await saveTaskForm(page);
    await expect(page.getByPlaceholder('Title...')).toBeHidden({
      timeout: 10_000,
    });
    await waitForBoardLoaded(page);

    await taskCardInColumn(page, 'To be done', title)
      .getByRole('button', { name: 'Remove' })
      .click();
    await waitForBoardLoaded(page);
    await expect(taskCardInColumn(page, 'To be done', title)).toHaveCount(0);
  });
});

test.describe('voice task', () => {
  test('mic button is visible on the board toolbar', async ({ page }) => {
    const projectName = `Voice ${Date.now()}`;
    await createProjectAndOpenBoard(page, projectName);

    const micBtn = page.getByRole('button', { name: VOICE_BOARD_MIC });
    await expect(micBtn).toBeVisible();
    await expect(micBtn).toBeEnabled();
  });

  test('clicking mic button opens the voice task modal', async ({
    page,
    context,
  }) => {
    test.skip(skipVoiceRecording, 'Real microphone unavailable in headless CI');
    // Grant microphone permission so the browser does not show a native prompt.
    await context.grantPermissions(['microphone']);

    const projectName = `Voice ${Date.now()}`;
    await createProjectAndOpenBoard(page, projectName);

    await page.getByRole('button', { name: VOICE_BOARD_MIC }).click();

    // The modal should appear in recording state with the "Listening…" heading.
    await expect(page.getByRole('heading', { name: /listening/i })).toBeVisible(
      { timeout: 5_000 },
    );
  });

  test('voice modal can be closed with the close button', async ({
    page,
    context,
  }) => {
    test.skip(skipVoiceRecording, 'Real microphone unavailable in headless CI');
    await context.grantPermissions(['microphone']);

    const projectName = `Voice ${Date.now()}`;
    await createProjectAndOpenBoard(page, projectName);

    await page.getByRole('button', { name: VOICE_BOARD_MIC }).click();
    await expect(page.getByRole('heading', { name: /listening/i })).toBeVisible(
      { timeout: 5_000 },
    );

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('heading', { name: /listening/i })).toBeHidden({
      timeout: 5_000,
    });
  });
});
