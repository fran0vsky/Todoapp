import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type UserPickerRow = { email: string; nickname: string | null };

export async function listUsersForPicker(
  supabase: SupabaseClient
): Promise<{ ok: true; users: UserPickerRow[] } | { ok: false; message: string }> {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (error) {
    return { ok: false, message: error.message };
  }
  const users = (data.users ?? [])
    .map((u) => {
      const email = typeof u.email === 'string' ? u.email : '';
      const raw = u.user_metadata?.['nickname'];
      let nickname: string | null = null;
      if (typeof raw === 'string') {
        const t = raw.trim();
        nickname = t.length > 0 ? t : null;
      }
      return { email, nickname };
    })
    .filter((row) => row.email.length > 0)
    .sort((a, b) => a.email.localeCompare(b.email));
  return { ok: true, users };
}
