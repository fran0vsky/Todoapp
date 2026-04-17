# Todoapp Skills

Project-scoped Cursor skills that orchestrate full-stack work across Angular 21 (`todo/`), Express + Supabase (`api/`), and Playwright E2E (`todo-e2e/`). Skills encode **workflow**; conventions live in [.cursor/rules/](../rules/).

## Skill index

| Skill | Triggers on | Purpose |
|---|---|---|
| [create-feature](create-feature/SKILL.md) | "new feature", "add endpoint + UI", "add entity" | Full-stack scaffold (DB → API → UI → test) |
| [edit-feature](edit-feature/SKILL.md) | "update", "modify", "change behavior of X" | Cross-layer edit with backward-compat guard |
| [delete-feature](delete-feature/SKILL.md) | "remove", "delete feature", "decommission" | Reverse-order removal with orphan check |
| [verify-feature](verify-feature/SKILL.md) | "verify", "consistency check", after any CRUD skill | Cross-layer checklist (DB + API + UI + design + tests) |
| [design-review](design-review/SKILL.md) | "style", "design", "Tailwind", "visual consistency" | Enforce `design-system.mdc` + visual spot-check |
| [testing](testing/SKILL.md) | "tests", "E2E", "Playwright" | Playwright specs in `todo-e2e/` |

## Chaining

CRUD skills (`create`, `edit`, `delete`) always end by invoking `verify-feature`. Skills are not event-hooks — chaining is explicit: each CRUD skill's final step instructs the agent to read and follow `verify-feature/SKILL.md`.

```
create-feature  ─┐
edit-feature    ─┼─► verify-feature ─► report + fixes
delete-feature  ─┘
```

`design-review` and `testing` are standalone and do not auto-trigger verify.

## Global rules (apply to every skill)

- Follow [.cursor/rules/](../rules/) — link out, don't duplicate.
- Work across frontend + backend + database when relevant.
- Never assume missing data. Ask the user via `AskQuestion` when anything is ambiguous.
- CRUD skills must finish by invoking `verify-feature`.
- Log key decisions (files changed, schema diffs, skipped steps with reasons) in the chat.
