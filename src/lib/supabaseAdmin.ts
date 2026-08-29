import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

let client: SupabaseClient | null = null;

/**
 * Service-role client. Bypasses RLS - use only in trusted server-side
 * code (seed scripts, privileged admin operations), never per-request
 * on behalf of an arbitrary user.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error(
      'Supabase admin client requested but SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set.'
    );
  }
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });
  }
  return client;
}
