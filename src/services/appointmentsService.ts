import type { SupabaseClient } from '@supabase/supabase-js';

export type AppointmentInput = {
  patient_id: string;
  doctor_user_id: string;
  type: string;
  start_time: string;
  end_time: string;
};

export async function listAppointments(
  supabase: SupabaseClient,
  options: { storeId?: string; date?: string; from?: string; to?: string; patientId?: string }
) {
  let query = supabase
    .from('appointments')
    .select('*, patient:patients(name, phone)')
    .order('start_time');

  if (options.storeId) query = query.eq('store_id', options.storeId);
  if (options.patientId) query = query.eq('patient_id', options.patientId);

  if (options.date) {
    query = query.gte('start_time', `${options.date}T00:00:00`).lt('start_time', `${options.date}T23:59:59.999`);
  } else if (options.from && options.to) {
    query = query.gte('start_time', options.from).lt('start_time', options.to);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createAppointment(supabase: SupabaseClient, input: AppointmentInput) {
  const { data, error } = await supabase
    .from('appointments')
    .insert(input)
    .select('*, patient:patients(name, phone)')
    .single();
  if (error) throw error;
  return data;
}

export async function updateAppointmentStatus(supabase: SupabaseClient, id: string, status: string) {
  const { data, error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', id)
    .select('*, patient:patients(name, phone)')
    .single();
  if (error) throw error;
  return data;
}
