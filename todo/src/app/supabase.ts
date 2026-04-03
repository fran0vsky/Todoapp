import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lujvqcopzqukyyyxhrju.supabase.co';
const supabaseAnonKey = 'sb_publishable_eBSrtd5hxIhifHoYaDTQAw_HWC_m1nr';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
