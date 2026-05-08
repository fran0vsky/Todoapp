import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Nx runs Node from the repo root, so default dotenv would miss api/.env — load explicitly.
// Load root first, then api/.env with override so secrets can live in either file (voice keys often sit in root .env).
const apiEnvPath = resolve(process.cwd(), 'api/.env');
const rootEnvPath = resolve(process.cwd(), '.env');
if (existsSync(rootEnvPath)) {
  config({ path: rootEnvPath });
}
if (existsSync(apiEnvPath)) {
  config({ path: apiEnvPath, override: true });
}
if (!existsSync(rootEnvPath) && !existsSync(apiEnvPath)) {
  config();
}

const url = process.env['SUPABASE_URL'];
const key = process.env['SUPABASE_KEY'];

export const supabase = createClient(url, key);
