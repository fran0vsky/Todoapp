---
name: testing
description: Authors and maintains Playwright E2E tests for the Todoapp in the todo-e2e Nx project. Use when the user asks to add tests, update tests, run E2E, cover a new flow with Playwright, or debug failing specs. Also used inline by create-feature and edit-feature to add or update a spec. Covers selector priority, helper reuse, authenticated vs public flows, and cursor-ide-browser MCP for interactive debugging.
---

# Testing

E2E-only scope. No unit / integration suite exists in this repo and this skill does not create one.

## When to run

- User asks to "add a test", "cover this with Playwright", "update the E2E spec", "run the tests", "fix failing tests".
- `create-feature` / `edit-feature` reach their test step.
- Before closing a task that modified user-visible behavior.

## Project layout — per [testing.mdc](../../rules/testing.mdc)

```
todo-e2e/src/
  auth.setup.ts    ← global auth; writes .auth/user.json
  app.spec.ts      ← authenticated flows
  public.spec.ts   ← unauthenticated flows
  helpers.ts       ← shared locators + waits
```

- Spec files end in `.spec.ts`. `auth.setup.ts` is matched via `testMatch`, not a spec.
- Put new shared locators in [todo-e2e/src/helpers.ts](../../../todo-e2e/src/helpers.ts) — never duplicate selector logic.

## Choosing the right spec file

| Flow | File | Project |
|---|---|---|
| Redirects, login page, public landing | [public.spec.ts](../../../todo-e2e/src/public.spec.ts) | `chromium-public` |
| Any authenticated action (projects, tasks, archive, assign) | [app.spec.ts](../../../todo-e2e/src/app.spec.ts) | depends on the `setup` project |

Authenticated specs depend on `auth.setup.ts`, which reads `E2E_EMAIL` / `E2E_PASSWORD` from [todo-e2e/.env](../../../todo-e2e/.env) (or the workspace `.env`). Never hard-code credentials.

## Selector priority — strict order

1. `page.getByRole('button', { name: 'Add Task' })` — role + accessible name
2. `page.getByPlaceholder('Task title')` / `page.getByLabel(...)`
3. `page.getByText('...')`
4. `page.getByTestId('...')` — add `data-testid` to the template only when 1–3 are impossible

Never use CSS class selectors. Tailwind classes are refactor targets, not stable selectors.

## Test structure

```typescript
test.describe('<feature>', () => {
  test('should <observable behavior>', async ({ page }) => {
    await createProjectAndOpenBoard(page, 'My Project');
    // actions
    await expect(taskCardInColumn(page, 'To do', 'My Task')).toBeVisible();
  });
});
```

- One `test.describe` per feature area.
- Tests must be **independent** — each sets up its own state via helpers. No shared mutable state across tests.
- Assertions: `toBeVisible` / `toBeHidden` / `toHaveURL` / `toHaveText`.

## Helper pattern

Add reusable waits and locators to [todo-e2e/src/helpers.ts](../../../todo-e2e/src/helpers.ts):

```typescript
export async function waitForBoardLoaded(page: Page) {
  await expect(page.getByText('Loading tasks…')).toBeHidden();
}

export function taskCardInColumn(page: Page, column: string, title: string) {
  return page.getByRole('region', { name: column }).getByText(title);
}
```

When adding a new selector that two specs need, export it from `helpers.ts` first, then use it.

## Commands

```bash
npx nx run todo-e2e:e2e                             # full suite (needs E2E creds)
npx nx run todo-e2e:e2e -- --project=chromium-public  # public flows only
```

Both dev servers (`api:serve` + `todo:serve`) auto-start via the Playwright config; `reuseExistingServer: true` is active, so running servers are reused.

## Coverage checklist per [testing.mdc](../../rules/testing.mdc)

| Area | Minimum coverage |
|---|---|
| Routing / guards | Redirects (e.g. `/` → `/login` without session) |
| Projects | Create, list, open (URL + heading) |
| Tasks | Full CRUD: add, edit, move status, archive, restore, delete |
| New feature | New `test.describe` block covering the primary user flow |

After every feature or behavior change, the corresponding spec must be added or updated. A CRUD skill that skips this step is incomplete.

## Debugging with cursor-ide-browser MCP

For exploratory work while authoring a spec (picking the right selector, understanding DOM state, reproducing a failure manually):

- `browser_navigate` to the page under test.
- `browser_snapshot` to inspect accessible roles and names — use these to craft `getByRole(...)` queries.
- `browser_take_screenshot` for visual evidence.

This is **not** a replacement for writing the spec — it's a way to pick selectors confidently.

## Authoring workflow

```
Task Progress:
- [ ] 1. Identify target spec file (app vs public)
- [ ] 2. Reuse or add helpers in helpers.ts
- [ ] 3. Write test.describe + tests (one per observable behavior)
- [ ] 4. Run the affected project locally
- [ ] 5. If failing: debug with cursor-ide-browser MCP, fix, rerun
- [ ] 6. Report pass/fail summary
```

## Global rules

- Follow [.cursor/rules/testing.mdc](../../rules/testing.mdc). This skill encodes the workflow; the rule encodes the conventions.
- Never hard-code credentials — rely on `auth.setup.ts` and `.env`.
- Never use CSS class selectors.
- Tests must be independent — no relying on another test's side effects.
- `testing` is standalone and does **not** chain into `verify-feature`. `verify-feature` checks that a spec exists as one of its items.
