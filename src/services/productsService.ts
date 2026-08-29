import type { SupabaseClient } from '@supabase/supabase-js';

export type ProductInput = {
  name: string;
  sku: string;
  category: string;
  cost_price: number;
  selling_price: number;
  made_to_order: boolean;
  requires_lab_work: boolean;
  lab_job_type: string | null;
};

export async function listProducts(supabase: SupabaseClient, category?: string) {
  let query = supabase.from('products').select('*').order('name');
  if (category) query = query.eq('category', category);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createProduct(supabase: SupabaseClient, organizationId: string, input: ProductInput) {
  const { data, error } = await supabase
    .from('products')
    .insert({ ...input, organization_id: organizationId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listStock(supabase: SupabaseClient, storeId?: string) {
  let query = supabase.from('store_stock').select('*');
  if (storeId) query = query.eq('store_id', storeId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function upsertStock(
  supabase: SupabaseClient,
  productId: string,
  storeId: string,
  quantity: number,
  lowStockThreshold?: number
) {
  const { data, error } = await supabase
    .from('store_stock')
    .upsert(
      {
        product_id: productId,
        store_id: storeId,
        quantity,
        ...(lowStockThreshold !== undefined ? { low_stock_threshold: lowStockThreshold } : {}),
      },
      { onConflict: 'product_id,store_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}
