import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const url = process.env['SUPABASE_URL'];
const key = process.env['SUPABASE_KEY'];

if (!url || !key) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_KEY – create api/.env with both values.'
  );
}

export const supabase = createClient(url, key);
