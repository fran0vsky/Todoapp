---
name: design-review
description: Enforces the Todoapp dark-only Tailwind design system (palette, spacing, typography, motion, component patterns) and spot-checks UI changes visually via the cursor-ide-browser MCP. Use when the user asks about styling, design, UI polish, visual consistency, Tailwind classes, theme, or when reviewing any component/template change. Also used inline by create-feature and edit-feature after UI changes.
---

# Design Review

Applies [design-system.mdc](../../rules/design-system.mdc) to any touched template or component styles, then visually verifies the change.

## When to run

- User mentions "style", "design", "look", "UI polish", "Tailwind", "visual consistency", "colors", "spacing".
- After any component/template edit made by `create-feature` or `edit-feature`.
- Before closing a PR that touches `todo/src/**/*.html` or `todo/src/**/*.ts` templates.

## Hard rules (cannot be overridden)

From [design-system.mdc](../../rules/design-system.mdc):

- **Dark-only**. No `dark:` prefix anywhere.
- **No `tailwind.config.js` extensions** for one-off values — use default tokens or arbitrary values in markup.
- **No `ngClass` / `ngStyle`**. Use `[class]` / `[style]` bindings or `host` metadata.
- **No `styles` arrays on components** — global utilities go in [todo/src/styles.css](../../../todo/src/styles.css).

## Palette by role

| Role | Allowed tokens |
|---|---|
| Background / shell | `bg-black`, `bg-neutral-950`, `bg-neutral-900` |
| Cards / surfaces | `bg-neutral-800`, `bg-neutral-900` |
| Borders | `border-neutral-800`, `border-neutral-700` |
| Muted text | `text-neutral-400`, `text-neutral-500` |
| Body text | `text-neutral-200`, `text-neutral-100`, `text-white` |
| Primary accent | `purple-500` / `purple-400` (+ `/15`, `/20`, `/30`, `/50` tints) |
| Assign / info | `cyan-*` |
| Archive / warning | `amber-*` |
| Destructive | `red-*` |

Reject any other accent color (blue, green, pink, emerald, …) unless the user explicitly asks to extend the role table.

## Component patterns — copy these verbatim

- **Primary button**: `bg-purple-500 hover:bg-purple-400 text-white`
- **Ghost button**: `text-neutral-400 hover:text-white hover:bg-neutral-800`
- **Input**: `bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-purple-400 focus:outline-none`
- **Card**: `bg-neutral-900 border border-neutral-800 rounded-xl p-4`
- **Modal**: centered, `max-w-2xl`, `bg-neutral-900 rounded-xl border border-neutral-800`
- **Scroll region**: `flex flex-col flex-1 min-h-0 overflow-y-auto scrollbar-dark` — `min-h-0` is mandatory inside a flex column.

## Spacing, radius, layout

- Gaps: `gap-2`, `gap-3`, `gap-4`, `gap-8`; lists `space-y-2` / `space-y-3`.
- Input padding: `px-3 py-2.5`; section padding `p-4`–`p-8`; section rhythm `mb-4`, `mb-6`, `mb-8`.
- Radius: `rounded-lg` / `rounded-xl` for cards/modals; `rounded-md` for chips/badges.
- Max width: content `max-w-[960px]`, wide boards `max-w-[1600px]`, modals `max-w-2xl` / `max-w-md`.

## Typography

- Default Tailwind sans stack, no custom font.
- Weights: `font-medium`, `font-semibold`, `font-bold`.
- Sizes: `text-xs` → `text-2xl`; arbitrary `text-[0.9375rem]` only when needed.
- `tracking-tight` for headings; `tracking-wide uppercase` for labels/column headers; `tabular-nums` for numbers.

## Motion

- Spinners: `animate-spin` on a bordered `<div>` with `border-t-*` accent.
- Hover: `transition-colors`, `transition-all`, `hover:border-*`, `hover:shadow-md`.
- Expansions: `transition-[width] duration-200 ease-out`.
- No dramatic keyframes unless explicitly designed.

## Review workflow

```
Task Progress:
- [ ] 1. Grep the diff for forbidden patterns
- [ ] 2. Verify palette + component patterns
- [ ] 3. Verify spacing / radius / typography
- [ ] 4. Visual spot-check via cursor-ide-browser MCP
- [ ] 5. Report findings
```

### 1. Grep for forbidden patterns

```bash
rg "ngClass|ngStyle|\bdark:" todo/src
rg "bg-(blue|green|pink|emerald|rose|sky|indigo|teal|lime|yellow|orange|fuchsia)-" todo/src
rg "changeDetection\s*:" todo/src/app
rg "standalone\s*:\s*true" todo/src/app
rg "styles\s*:\s*\[" todo/src/app
```

Every match is a finding unless justified.

### 2–3. Palette / spacing audit

Walk the changed template(s) and map each class to the tables above. Call out any class outside the tables.

### 4. Visual spot-check

Start the dev server if not running (`npx nx serve todo`), then use the `cursor-ide-browser` MCP:

- `browser_navigate` to the affected route.
- `browser_snapshot` for structure + `browser_take_screenshot` for visual confirmation.
- Compare against the palette and component patterns above. Key things to eyeball: focus rings on inputs, hover states on buttons, scroll-region overflow, card borders.

If the dev server is not running and cannot be started safely, skip the visual step and note it in the report.

### 5. Report

```
Design Review — <component / route>

Hard-rule violations:
- <file:line> — uses ngClass → replace with [class] binding

Palette violations:
- <file:line> — uses bg-blue-500 (not in role table) → propose bg-purple-500 or remove

Spacing / typography notes:
- <file:line> — p-5 used; standard scale is p-4 or p-6

Visual spot-check: <pass | skipped — reason>
```

## Global rules

- Follow [.cursor/rules/](../../rules/). This skill is the design-system enforcer; it never overrides other rules.
- Do not propose extending `tailwind.config.js` — if an arbitrary value is needed, use `text-[0.9375rem]`-style syntax in markup.
- `design-review` is standalone and does **not** chain into `verify-feature`. `verify-feature` covers design as one of its checklist items.
