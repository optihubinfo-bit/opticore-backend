import type { SupabaseClient } from '@supabase/supabase-js';

export type TransferInput = {
  from_store_id: string;
  to_store_id: string;
  product_id: string;
  quantity: number;
};

export async function listTransfers(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('transfer_requests')
    .select('*, product:products(name, sku)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createTransfer(supabase: SupabaseClient, input: TransferInput) {
  const { data, error } = await supabase
    .from('transfer_requests')
    .insert(input)
    .select('*, product:products(name, sku)')
    .single();
  if (error) throw error;
  return data;
}

export async function approveTransfer(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from('transfer_requests')
    .update({ status: 'in_transit' })
    .eq('id', id)
    .select('*, product:products(name, sku)')
    .single();
  if (error) throw error;
  return data;
}

export async function receiveTransfer(supabase: SupabaseClient, id: string) {
  const { error: rpcError } = await supabase.rpc('receive_transfer', { p_transfer_id: id });
  if (rpcError) throw rpcError;

  const { data, error } = await supabase
    .from('transfer_requests')
    .select('*, product:products(name, sku)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}
