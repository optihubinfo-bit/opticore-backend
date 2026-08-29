import type { SupabaseClient } from '@supabase/supabase-js';

export async function listLabJobs(supabase: SupabaseClient, options: { storeId?: string }) {
  let query = supabase
    .from('lab_jobs')
    .select('*, patient:patients(name, phone)')
    .order('created_at');

  if (options.storeId) query = query.eq('store_id', options.storeId);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function updateLabJobStage(supabase: SupabaseClient, id: string, stage: string) {
  const { data, error } = await supabase
    .from('lab_jobs')
    .update({ stage })
    .eq('id', id)
    .select('*, patient:patients(name, phone)')
    .single();
  if (error) throw error;
  return data;
}
