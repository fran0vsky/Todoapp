# Deploy: Supabase Edge Functions + GitHub Pages

This app’s production API is the **`todo-api`** Edge Function. The Angular UI is deployed from `.github/workflows/deploy-github-pages.yml` to the **`gh-pages`** branch.

## 1. Edge Function (`todo-api`)

### Secrets (Dashboard → Edge Functions → `todo-api` → Secrets, or CLI)

Set at least:

| Secret | Purpose |
|--------|---------|
| `SUPABASE_URL` | Usually auto-provided when deployed with Supabase CLI. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role access for DB + `auth.admin` (same as backend `SUPABASE_KEY`). |
| `SUPABASE_ANON_KEY` | Returned by `GET /api/auth` for the browser Supabase client. |

**CORS:** set **`ALLOWED_ORIGINS`** to a comma-separated list of origins that may call the API, for example:

- `http://localhost:4200`
- `https://<your-github-username>.github.io`

(Optional) **`ALLOW_ANY_ORIGIN`**=`true` only for debugging (not recommended in production).

**Voice / AI (same as local `api/.env`):**

- `OPENROUTER_API_KEY` (required for voice unless you rely only on OpenAI)
- `OPENAI_API_KEY` (recommended for WebM / Whisper)
- Optional: `OPENROUTER_TRANSCRIPTION_MODEL`, `OPENROUTER_VOICE_INTENT_MODEL`, `OPENROUTER_HTTP_REFERER`

**Admin delete project:**

- `ADMIN_EMAIL` — must match the signed-in user email allowed to delete projects.

Deploy from the repo root:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase secrets set ALLOWED_ORIGINS=http://localhost:4200,https://youruser.github.io
# …set other secrets as needed…
supabase functions deploy todo-api --no-verify-jwt
```

`verify_jwt` is disabled in [`supabase/config.toml`](config.toml); the handler validates Bearer tokens where needed.

## 2. GitHub Pages (Angular)

1. **Repository variable:** `SUPABASE_PROJECT_REF` = your Supabase project ref (used to replace `PLACEHOLDER_PROJECT_REF` in the production environment file before build).

2. **Pages:** Settings → Pages → Build and deployment → Source: **Deploy from a branch** → Branch **`gh-pages`** / **`/ (root)`**.

3. If your GitHub repo name is not **`Todoapp`**, change `--base-href` and `publish` assumptions in [`.github/workflows/deploy-github-pages.yml`](../.github/workflows/deploy-github-pages.yml) to match `https://<user>.github.io/<repo>/`.

4. After deploy, open `https://<user>.github.io/Todoapp/` and confirm login, tasks, and (if configured) voice.

## 3. Local development

Unchanged: run `npx nx run api:serve` and `npx nx run todo:serve` — the app uses [`todo/src/environments/environment.ts`](../todo/src/environments/environment.ts) (`http://localhost:3333`).
