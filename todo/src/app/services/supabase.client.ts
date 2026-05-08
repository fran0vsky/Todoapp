import { HttpClient } from '@angular/common/http';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../shared/api-base';

let client: SupabaseClient | null = null;

/** Called from APP_INITIALIZER after HttpClient is available. Loads config from GET /api/auth. */
export async function initSupabaseFromApi(http: HttpClient): Promise<void> {
  const { url, anonKey } = await firstValueFrom(
    http.get<{ url: string; anonKey: string }>(`${API_BASE_URL}/api/auth`),
  );
  client = createClient(url, anonKey);
}

export function getSupabase(): SupabaseClient {
  if (!client) {
    throw new Error(
      'Supabase is not initialized yet. Ensure provideAppInitializer(initSupabaseFromApi) runs before AuthService.',
    );
  }
  return client;
}

/** Clears the module singleton; only used from Vitest specs. */
export function resetSupabaseClientForTesting(): void {
  client = null;
}
