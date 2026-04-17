---
name: create-feature
description: Scaffolds a new full-stack feature in the Todoapp (Supabase schema, Express controller/service/route, Angular model/api/state/component/route, Playwright spec). Use when the user asks to add a new feature, new entity, new endpoint with UI, or create something from scratch across the stack. Ends by chaining into verify-feature.
---

# Create Feature

End-to-end scaffold: DB → API → Frontend → Design → Tests → Verify.

## Discovery gate — do NOT proceed without these

Ask the user (via `AskQuestion` when available) if any of the following are unclear:

1. **Entity name** (singular + plural) and whether it belongs to an existing entity (e.g. belongs to `projects`).
2. **Fields**: names, types, required vs optional, and any enum/union values (e.g. status values).
3. **Auth**: public, authenticated, or admin-only?
4. **UI placement**: new top-level route, nested under an existing page, modal, or sidebar?
5. **Validation rules** that cannot be inferred (length limits, allowed values, formats).

Never invent schema. If one field is ambiguous, ask — don't guess.

## Execution order

Follow this order strictly — each layer depends on the previous one.

```
Task Progress:
- [ ] 1. DB migration (Supabase SQL)
- [ ] 2. API types + validators
- [ ] 3. API service (Supabase wrapper)
- [ ] 4. API controller (validate-early)
- [ ] 5. API route registration in main.ts
- [ ] 6. Frontend model
- [ ] 7. Frontend *ApiService
- [ ] 8. Frontend state service (signal + computed)
- [ ] 9. Frontend components (smart + presentational)
- [ ] 10. Frontend route (lazy loadComponent + guard)
- [ ] 11. Design pass (design-system.mdc tokens)
- [ ] 12. Playwright spec
- [ ] 13. Invoke verify-feature
```

### 1. DB migration

Output a SQL snippet the user runs in Supabase (we do not auto-apply). Every table: `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`, `snake_case` columns. Follow [database.mdc](../../rules/database.mdc).

### 2. API types + validators

- Add request body shape to [api/src/types.ts](../../../api/src/types.ts).
- Add validator(s) to [api/src/services/validation.ts](../../../api/src/services/validation.ts) (e.g. `isXStatus`, `parseY`).

### 3. API service

Create `api/src/services/<entity>Service.ts` with thin `supabase.from(table)` wrappers that return raw `{ data, error }`. Use explicit column selects over `*`. See [backend-architecture.mdc](../../rules/backend-architecture.mdc) and [database.mdc](../../rules/database.mdc).

### 4. API controller

Create `api/src/controllers/<entity>Controller.ts`. Each handler:

```typescript
export const createX: RequestHandler = async (req, res) => {
  const body = req.body as CreateXBody;
  if (!body.title || !validator(body.status)) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  const { data, error } = await xService.create(body);
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
};
```

Map `PGRST116` → 404. Admin-only routes: `getUserFromBearer` + `isAdmin`.

### 5. Route registration

Register every new route in [api/src/main.ts](../../../api/src/main.ts) — this is the single source of truth for route order.

### 6. Frontend model

Add an `interface` to [todo/src/app/models/](../../../todo/src/app/models/). Align string-union status values with the API.

### 7. `*ApiService`

- One service per entity in `todo/src/app/services/`.
- `inject(HttpClient)` (never constructor DI).
- Import `API_BASE_URL` from `todo/src/app/shared/api-base.ts`.
- Return `Observable<T>`; conversion to signals happens in the state service or component.

### 8. State service

- `providedIn: 'root'` singleton.
- Private `readonly #state = signal<XState>(initial)`.
- Public `readonly items = computed(() => this.#state().items)` selectors.
- Bridge HTTP with `toSignal()` — never `.set()` inside a `subscribe`.

### 9. Components

- Smart component injects the state service; presentational components take `input()` and emit `output()`.
- Use `host` metadata for root classes — no wrapper `<div>`.
- Templates: `@if`, `@for`, `@switch`. No `*ngIf`, no `ngModel`, no `ngClass`, no `ngStyle`, no `async` pipe.
- Reactive forms only.

### 10. Route

Add to [todo/src/app/app.routes.ts](../../../todo/src/app/app.routes.ts):

```typescript
{
  path: 'x',
  loadComponent: () => import('./features/x/x-page.component').then(m => m.XPageComponent),
  canActivate: [authGuard],
}
```

### 11. Design

Apply [design-system.mdc](../../rules/design-system.mdc): dark palette, purple accent, documented component patterns. When in doubt invoke `design-review` inline.

### 12. Playwright spec

Add a `test.describe('<entity>', ...)` block in [todo-e2e/src/app.spec.ts](../../../todo-e2e/src/app.spec.ts) (authenticated) or [todo-e2e/src/public.spec.ts](../../../todo-e2e/src/public.spec.ts). Selectors: role+name first. Shared locators in [todo-e2e/src/helpers.ts](../../../todo-e2e/src/helpers.ts).

### 13. Invoke verify-feature

Read [verify-feature/SKILL.md](../verify-feature/SKILL.md) and follow it. Do not mark the task complete until verify passes with no Critical findings.

## Global rules

- Follow [.cursor/rules/](../../rules/). Link out, don't duplicate.
- Work across all three layers — partial implementations are not allowed.
- Ask the user when inputs are ambiguous. Never invent schema, auth, or enum values.
- Log the final file list (created + modified) at the end of the run before verify.
