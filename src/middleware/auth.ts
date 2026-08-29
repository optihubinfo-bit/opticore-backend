import type { NextFunction, Request, Response } from 'express';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '../lib/supabaseAdmin.js';
import { getSupabaseForUser } from '../lib/supabaseClient.js';
import type { StaffRecord } from '../types/db.js';

export interface AuthedRequest extends Request {
  user: User;
  supabase: SupabaseClient;
  staff: StaffRecord;
}

/**
 * Validates the caller's Supabase session token (via the service-role
 * client, which only reads the auth schema here, nothing privileged),
 * attaches a per-request anon client scoped to that same token so
 * every controller query runs under the caller's own RLS policies,
 * and loads their staff record (org/role/store) so controllers can
 * make field-level decisions (e.g. omitting cost_price) that RLS
 * alone can't express.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  const supabase = getSupabaseForUser(token);
  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .select('id, organization_id, primary_store_id, role')
    .eq('id', data.user.id)
    .single();

  if (staffError || !staff) {
    res.status(403).json({ error: 'No staff record for this account' });
    return;
  }

  (req as AuthedRequest).user = data.user;
  (req as AuthedRequest).supabase = supabase;
  (req as AuthedRequest).staff = staff as StaffRecord;
  next();
}
