import type { SupabaseClient } from '@supabase/supabase-js';

export type PatientInput = {
  name: string;
  phone?: string;
  email?: string;
  assigned_store_id: string;
};

export type PrescriptionInput = {
  eye: 'OD' | 'OS';
  sph?: number | null;
  cyl?: number | null;
  axis?: number | null;
  add_power?: number | null;
  issued_date: string;
  expiry_date: string;
};

// PostgREST's `.or()` filter syntax treats comma/parens as
// delimiters; strip anything that isn't safe inside an ilike pattern
// so a search term can't break out of the filter expression.
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[^a-zA-Z0-9 +@._-]/g, '').trim();
}

export async function listPatients(supabase: SupabaseClient, search?: string) {
  let query = supabase.from('patients').select('*').order('name');

  const term = search ? sanitizeSearchTerm(search) : '';
  if (term) {
    query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getPatient(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from('patients').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createPatient(supabase: SupabaseClient, input: PatientInput) {
  const { data, error } = await supabase.from('patients').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function listPrescriptions(supabase: SupabaseClient, patientId: string) {
  const { data, error } = await supabase
    .from('prescriptions')
    .select('*')
    .eq('patient_id', patientId)
    .order('issued_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createPrescriptions(
  supabase: SupabaseClient,
  patientId: string,
  rows: PrescriptionInput[]
) {
  const payload = rows.map((row) => ({ ...row, patient_id: patientId }));
  const { data, error } = await supabase.from('prescriptions').insert(payload).select();
  if (error) throw error;
  return data;
}
