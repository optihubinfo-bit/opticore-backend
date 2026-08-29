import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

/**
 * Anon client scoped to a single request's user JWT, so every query
 * runs under that user's RLS policies instead of the service role.
 * Create one per request; do not share across users.
 */
export function getSupabaseForUser(accessToken: string): SupabaseClient {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error(
      'Supabase anon client requested but SUPABASE_URL / SUPABASE_ANON_KEY are not set.'
    );
  }
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  });
}
