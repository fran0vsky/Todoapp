---
name: delete-feature
description: Safely removes a feature or entity from the Todoapp across tests, frontend, backend, and database without leaving orphaned code, routes, or references. Use when the user asks to delete, remove, retire, or decommission a feature, entity, endpoint, route, or UI surface. Ends by chaining into verify-feature.
---

# Delete Feature

Reverse-order removal with orphan detection. Stops at the first broken reference.

## Confirm before deleting

Always confirm with the user:

1. **Exact entity / feature name** being removed.
2. **Data retention**: drop table, drop rows, or archive?
3. **Breaking changes**: does any external consumer (outside this repo) use the endpoint? If unknown, treat as yes and stop.

Never delete based on guesswork. If the user only said "remove X" and X could be multiple things, ask.

## Removal order — REVERSE of create

Delete consumers before producers. This prevents dangling imports that fail type-check mid-run.

```
Task Progress:
- [ ] 1. Playwright spec block
- [ ] 2. Frontend route entry
- [ ] 3. Frontend component(s)
- [ ] 4. Frontend state service
- [ ] 5. Frontend *ApiService
- [ ] 6. Frontend model
- [ ] 7. Backend route registration in main.ts
- [ ] 8. Backend controller
- [ ] 9. Backend service
- [ ] 10. Backend types + validators
- [ ] 11. DB drop (SQL snippet for user to run)
- [ ] 12. Orphan sweep
- [ ] 13. Invoke verify-feature
```

### After each removal: orphan check

After every step, Grep for leftover references before continuing:

```bash
rg "<EntityName>" todo/src api/src todo-e2e/src
rg "\b<table_name>\b" api/src
rg "/<api-path>\b" todo/src api/src
rg "<EntityName>ApiService" todo/src
```

If any usage remains, fix it **before** moving to the next step. Do not batch multiple removals without rechecking.

## Specific files to audit

| Layer | File | What to remove |
|---|---|---|
| Tests | [todo-e2e/src/app.spec.ts](../../../todo-e2e/src/app.spec.ts), [public.spec.ts](../../../todo-e2e/src/public.spec.ts), [helpers.ts](../../../todo-e2e/src/helpers.ts) | `describe` blocks, helper exports no longer used |
| Routes | [todo/src/app/app.routes.ts](../../../todo/src/app/app.routes.ts) | Route entry + any nested children |
| Components | `todo/src/app/features/<entity>/`, `todo/src/app/components/` | Whole folder if feature-only; individual components if shared |
| State | `todo/src/app/services/<entity>-state.service.ts` | |
| API services | `todo/src/app/services/<entity>.api.ts` | |
| Models | [todo/src/app/models/](../../../todo/src/app/models/) | Interface + any re-exports |
| Backend routes | [api/src/main.ts](../../../api/src/main.ts) | `app.get/post/put/delete` lines for the entity |
| Controllers | [api/src/controllers/](../../../api/src/controllers/) | `<entity>Controller.ts` |
| Backend services | [api/src/services/](../../../api/src/services/) | `<entity>Service.ts` and related validators in `validation.ts` |
| Types | [api/src/types.ts](../../../api/src/types.ts) | `CreateXBody`, `UpdateXBody`, etc. |
| DB | Supabase | `drop table if exists <table> cascade;` — user runs this |

### Cascading FK data

If the deleted entity is referenced by another table via `*_id`, the DB drop must either (a) drop dependent rows first in the correct order or (b) rely on an existing `on delete cascade`. Per [database.mdc](../../rules/database.mdc), this repo does **not** configure DB-level cascade — write explicit `delete` statements for dependents in the SQL snippet you hand to the user.

## Orphan sweep (final)

Before invoking verify, run one last broad Grep over the whole repo:

```bash
rg -i "<entity_name|EntityName>" .
```

Exclude `node_modules`, `dist`, `.nx`, and this skill file itself. Remaining matches must be intentional (e.g. a comment explaining the deprecation). List them in the chat.

## Invoke verify-feature

Read [verify-feature/SKILL.md](../verify-feature/SKILL.md) and follow it. For a deletion, verify's job is **confirming absence** — no route, no service, no component, no DB table.

## Global rules

- Follow [.cursor/rules/](../../rules/). Link out, don't duplicate.
- Never drop a Supabase table without the user running the SQL themselves.
- Ask the user about data retention before writing any `drop` / `delete` statement.
- Log every file touched and every leftover reference resolved before invoking verify.
