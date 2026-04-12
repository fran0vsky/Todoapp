import type { Request, Response } from 'express';

/** Public Supabase settings for the browser client (anon key is safe to expose when RLS is enforced). */
export function getAuthConfig(_req: Request, res: Response): void {
  const url = process.env['SUPABASE_URL'];
  const anonKey = process.env['SUPABASE_ANON_KEY'];
  if (!url || !anonKey) {
    res.status(500).json({
      error:
        'Server is missing SUPABASE_URL or SUPABASE_ANON_KEY — add them to api/.env (see api/.env.example).',
    });
    return;
  }
  res.json({ url, anonKey });
}
