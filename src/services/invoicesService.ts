import type { SupabaseClient } from '@supabase/supabase-js';

export type InvoiceLineItemInput = {
  product_id?: string | null;
  description?: string;
  qty: number;
  unit_price?: number;
};

export type CreateInvoiceInput = {
  patient_id: string;
  store_id: string;
  payment_method: string;
  line_items: InvoiceLineItemInput[];
};

// Mirrors the sanitizer in patientsService - PostgREST's `.or()`
// filter syntax treats comma/parens as delimiters.
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[^a-zA-Z0-9 +@._-]/g, '').trim();
}

export async function listInvoices(
  supabase: SupabaseClient,
  options: { search?: string; patientId?: string }
) {
  let query = supabase
    .from('invoices')
    .select('*, patient:patients(name, phone)')
    .order('created_at', { ascending: false });

  if (options.patientId) {
    query = query.eq('patient_id', options.patientId);
  }

  if (options.search) {
    const term = sanitizeSearchTerm(options.search);
    if (term) {
      const { data: matchingPatients, error: patientError } = await supabase
        .from('patients')
        .select('id')
        .or(`name.ilike.%${term}%,phone.ilike.%${term}%`);
      if (patientError) throw patientError;

      const patientIds = (matchingPatients ?? []).map((p) => p.id);
      const patientFilter = patientIds.length > 0 ? `,patient_id.in.(${patientIds.join(',')})` : '';
      query = query.or(`invoice_number.ilike.%${term}%${patientFilter}`);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createInvoice(supabase: SupabaseClient, input: CreateInvoiceInput) {
  const { data, error } = await supabase.rpc('create_invoice', {
    p_patient_id: input.patient_id,
    p_store_id: input.store_id,
    p_payment_method: input.payment_method,
    p_line_items: input.line_items,
  });
  if (error) throw error;
  return data;
}
