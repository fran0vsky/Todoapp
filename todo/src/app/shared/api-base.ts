import { environment } from '../../environments/environment';

/** REST API root (local Express in dev; Supabase Edge Function in production). */
export const API_BASE_URL = environment.apiBaseUrl;
