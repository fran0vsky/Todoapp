---
name: verify-feature
description: Verifies a Todoapp feature is implemented consistently across database, API, frontend, design, and tests. Use after any feature creation, update, or deletion; when the user asks to verify, audit, or consistency-check a feature; or when another skill (create-feature, edit-feature, delete-feature) chains into it. Reports Critical / Warning / Info findings and blocks completion if critical layers are missing.
---

# Verify Feature

Cross-layer audit for a single feature or entity. Runs after every CRUD skill and on demand.

## When to run

- Invoked explicitly by `create-feature`, `edit-feature`, or `delete-feature` at their final step.
- User asks to "verify", "audit", "consistency check", or "make sure X is wired end-to-end".
- Before closing out any task that touched more than one layer.

## Inputs

Before starting, confirm the **feature name** and **entity** (e.g. "labels on tasks", "project archive"). If not obvious from context, ask the user via `AskQuestion`.

## Checklist (run in order)

Copy this list into the chat and tick items as you verify them:

```
- [ ] DB schema
- [ ] API types
- [ ] API service
- [ ] API controller
- [ ] API route registration
- [ ] Frontend model
- [ ] Frontend *ApiService
- [ ] Frontend state (signal + computed)
- [ ] Frontend component(s)
- [ ] Frontend route (lazy + guard)
- [ ] Design tokens
- [ ] Playwright spec
- [ ] Build / typecheck / lint
```

### 1. DB schema — per [database.mdc](../../rules/database.mdc)

- Table exists in Supabase with `snake_case` columns.
- Every table has `id` (uuid) and `created_at` (timestamptz).
- Validation helpers in [api/src/services/validation.ts](../../../api/src/services/validation.ts) cover each user-supplied column.

### 2. API — per [backend-architecture.mdc](../../rules/backend-architecture.mdc)

- Request body shape exists in [api/src/types.ts](../../../api/src/types.ts).
- Service function in [api/src/services/](../../../api/src/services/) returns raw `{ data, error }` from Supabase — no throws, no status code decisions.
- Controller in [api/src/controllers/](../../../api/src/controllers/) validates early, maps `PGRST116` → 404, never exposes stack traces.
- Route registered in [api/src/main.ts](../../../api/src/main.ts). Admin-only routes use `getUserFromBearer` + `isAdmin`.

### 3. Frontend — per [angular-guide.mdc](../../rules/angular-guide.mdc) and [angular-style-guide.mdc](../../rules/angular-style-guide.mdc)

- Model interface in [todo/src/app/models/](../../../todo/src/app/models/); no duplicate type elsewhere.
- `*ApiService` uses `HttpClient` and imports `API_BASE_URL` from `todo/src/app/shared/api-base.ts`. No `fetch()`.
- State exposed via `signal()` + `computed()` (or `toSignal()`). No `BehaviorSubject`, no `async` pipe (app is zoneless), no `.set()` inside `subscribe`.
- Components use `input()` / `output()` signal functions — not `@Input()` / `@Output()`. No `standalone: true`, no `changeDetection`, no `ngModel`, no `ngClass`, no `ngStyle`.
- Route added to [todo/src/app/app.routes.ts](../../../todo/src/app/app.routes.ts) with `loadComponent`; protected routes use `authGuard`.

### 4. Design — per [design-system.mdc](../../rules/design-system.mdc)

- Dark-only palette (no `dark:` prefix). Accents follow the role table (purple primary, cyan assign, amber archive, red destructive).
- Buttons / inputs / cards / modals match the documented component patterns.
- Scroll regions use `flex-1 min-h-0 overflow-y-auto scrollbar-dark`.
- Focus rings use `focus:ring-2 focus:ring-purple-400` (or /30–/50 variants).
- No extensions to `tailwind.config.js`.

### 5. Tests — per [testing.mdc](../../rules/testing.mdc)

- A `test.describe` block exists or is updated in [todo-e2e/src/app.spec.ts](../../../todo-e2e/src/app.spec.ts) (authenticated) or [todo-e2e/src/public.spec.ts](../../../todo-e2e/src/public.spec.ts) (public).
- Selectors follow priority: role+name → placeholder/label → text → `data-testid`. No CSS class selectors.
- Shared locators live in [todo-e2e/src/helpers.ts](../../../todo-e2e/src/helpers.ts) — no duplicated selector logic.

### 6. Sanity checks

Run when changes are staged (skip if the workspace has unrelated dirty files):

```bash
npx nx run todo:build
npx nx run api:build
npx nx lint
```

## Reporting format

Group findings by severity and include file paths + suggested fix:

```
Critical (blocks completion):
- api/src/main.ts:42 — POST /api/labels route is not registered
  Fix: add `app.post('/api/labels', labelsController.create)` after the tasks routes.

Warning:
- todo/src/app/features/labels/label-list.component.ts:18 — uses `*ngIf`
  Fix: replace with `@if` per angular-style-guide.mdc.

Info:
- No Playwright coverage yet for "delete label"
  Suggest: add a test in app.spec.ts under the labels describe block.
```

## Exit behavior

- Any **Critical** finding: report and stop. Ask the user whether to fix now or defer.
- **Warning** / **Info** only: report and mark the originating task complete.
- Never silently "pass" if a layer was not checked — say explicitly which layers were out of scope and why.
