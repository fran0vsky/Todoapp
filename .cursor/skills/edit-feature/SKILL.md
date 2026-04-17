---
name: edit-feature
description: Updates an existing Todoapp feature across database, API, and Angular frontend while preserving backward compatibility. Use when the user asks to modify, update, change, extend, or refactor an existing feature or entity. Scans every layer for the touched entity before editing so no layer is missed. Ends by chaining into verify-feature.
---

# Edit Feature

Cross-layer modification of an existing entity. Designed to prevent drift between DB, API, and UI.

## Discovery — scan before editing

Before touching any file, Grep across the stack for the entity/type/route name so you know every consumer:

```bash
rg "<EntityName>" api/src todo/src todo-e2e/src
rg "\b<table_name>\b" api/src
rg "/<api-path>\b" todo/src api/src
```

If you find usages in layers the user didn't mention, surface them and ask whether the change should propagate there too.

## Backward compatibility guard

Before applying any change, classify it:

| Change | Breaking? | Action |
|---|---|---|
| Add optional field | No | Proceed |
| Add required field | Yes | Ask user: migration path for existing rows? |
| Rename column / route / type | Yes | Ask user to confirm; plan a deprecation or coordinated rename |
| Remove field / route | Yes | Route to `delete-feature` instead |
| Widen an enum (e.g. add status) | No | Ensure every layer handles the new value |
| Narrow an enum (remove a value) | Yes | Ask about migrating existing rows |

If the classification is "Yes" and the user hasn't explicitly acknowledged the break, stop and ask.

## Execution order

```
Task Progress:
- [ ] 1. Scan all layers for the entity
- [ ] 2. Classify change (breaking or not)
- [ ] 3. DB migration (if schema changes)
- [ ] 4. API types + validators
- [ ] 5. API service + controller
- [ ] 6. API route registration (only if path changes)
- [ ] 7. Frontend model
- [ ] 8. Frontend *ApiService
- [ ] 9. Frontend state service
- [ ] 10. Frontend components + templates
- [ ] 11. Frontend route (if path changes)
- [ ] 12. Design pass for any new/changed UI
- [ ] 13. Update Playwright spec
- [ ] 14. Invoke verify-feature
```

Skip steps that don't apply, but **log why** ("no DB change — step 3 skipped").

## Layer-by-layer rules

Each layer still follows its rule file. Use these links for the exact patterns:

- DB: [database.mdc](../../rules/database.mdc)
- API: [backend-architecture.mdc](../../rules/backend-architecture.mdc)
- Frontend: [angular-guide.mdc](../../rules/angular-guide.mdc) + [angular-style-guide.mdc](../../rules/angular-style-guide.mdc)
- Design: [design-system.mdc](../../rules/design-system.mdc)
- Tests: [testing.mdc](../../rules/testing.mdc)

## Regression prevention

- Keep existing API route signatures stable unless explicitly renaming.
- Keep existing `Observable<T>` return types on `*ApiService` methods — downstream `toSignal()` consumers depend on them.
- When widening a status union, handle the new value in every `@switch` and every Playwright assertion that enumerates statuses.
- Do not edit shared helpers in [todo-e2e/src/helpers.ts](../../../todo-e2e/src/helpers.ts) unless every spec that uses them is re-run.

## Invoke verify-feature

Final step: read [verify-feature/SKILL.md](../verify-feature/SKILL.md) and follow it. Do not close the task until verify reports no Critical findings.

## Global rules

- Follow [.cursor/rules/](../../rules/). Link out, don't duplicate.
- Never rename public API paths or DB columns without explicit user confirmation.
- Ask the user when inputs are ambiguous.
- Log the final file list (created + modified + skipped-with-reason) before invoking verify.
