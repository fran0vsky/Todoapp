# Todoapp

[![CI](https://github.com/fran0vsky/Todoapp/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/fran0vsky/Todoapp/actions/workflows/ci.yml)

Nx monorepo: Angular frontend (Tailwind), Express API, Supabase for auth and data, Playwright E2E tests, and optional voice-to-task via OpenRouter. Personal learning project.

---

## Run locally

```bash
npm install
npm run api:serve   # Express API — port 3333
npm run web:start   # Angular app — port 4200
```

Open http://localhost:4200 with both servers running.

---

## Environment

Copy `api/.env.example` to `api/.env` and fill in the keys.
For authenticated E2E tests, copy `todo-e2e/.env.example` to `todo-e2e/.env`.

---

## NPM scripts

| Script               | Description                                                                          |
| -------------------- | ------------------------------------------------------------------------------------ |
| `npm run test`       | Vitest (Angular + API) with coverage                                                 |
| `npm run lint`       | ESLint across Nx projects                                                            |
| `npm run api:serve`  | Local Express API (`nx run api:serve`)                                               |
| `npm run api:deploy` | Deploy `todo-api` Edge Function (requires Supabase CLI + link; see below)            |
| `npm run web:start`  | Local Angular dev server (`nx run todo:serve`)                                       |
| `npm run web:deploy` | Trigger GitHub Actions workflow `deploy-github-pages.yml` (requires GitHub CLI `gh`) |

Production deployment is documented in [supabase/DEPLOY.md](supabase/DEPLOY.md) (Edge Function + GitHub Pages).

### CI deploy secrets

- **GitHub Pages:** repo variable `SUPABASE_PROJECT_REF`; workflow `deploy-github-pages.yml`.
- **Supabase Function:** repo secret `SUPABASE_ACCESS_TOKEN` (from `supabase login`); same `SUPABASE_PROJECT_REF` for `deploy-supabase-function.yml`.

---

## Tests

```bash
npm run test
npx nx run todo-e2e:e2e
```

Skip auth-only E2E tests with `-- --project=chromium-public`.

---

## Build

```bash
npx nx run-many -t build --projects=api,todo
```

1234
