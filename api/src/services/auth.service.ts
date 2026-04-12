import type { User } from '@supabase/supabase-js';
import type { Request } from 'express';
import { supabase } from '../supabase';

export async function getUserFromBearer(req: Request): Promise<User | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return null;
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }
  return data.user;
}

export function isAdmin(user: User): boolean {
  const adminEmail = (process.env['ADMIN_EMAIL'] ?? 'admin@admin.com').trim().toLowerCase();
  return user.email?.trim().toLowerCase() === adminEmail;
}
