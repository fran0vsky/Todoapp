export const environment = {
  production: true,
  /**
   * Supabase Edge Function base (no trailing slash). Replace PLACEHOLDER_PROJECT_REF
   * with your project ref, or let `.github/workflows/deploy-github-pages.yml` substitute it via `SUPABASE_PROJECT_REF`.
   */
  apiBaseUrl:
    'https://PLACEHOLDER_PROJECT_REF.supabase.co/functions/v1/todo-api',
};
