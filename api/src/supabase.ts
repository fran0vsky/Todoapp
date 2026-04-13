import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Nx runs Node from the repo root, so default dotenv would miss api/.env — load explicitly.
const apiEnvPath = resolve(process.cwd(), 'api/.env');
const rootEnvPath = resolve(process.cwd(), '.env');
if (existsSync(apiEnvPath)) {
  config({ path: apiEnvPath });
} else if (existsSync(rootEnvPath)) {
  config({ path: rootEnvPath });
} else {
  config();
}

const url = process.env['SUPABASE_URL'];
const key = process.env['SUPABASE_KEY'];
const anonKey = process.env['SUPABASE_ANON_KEY'];

export const supabase = createClient(url, key);
