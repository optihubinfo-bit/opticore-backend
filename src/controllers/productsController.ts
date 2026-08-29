import type { Request, Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { statusForError } from '../lib/httpError.js';
import {
  createProduct,
  listProducts,
  listStock,
  upsertStock,
  type ProductInput,
} from '../services/productsService.js';

const COST_PRICE_ROLES = new Set(['owner_admin', 'store_manager']);

/**
 * Omits cost_price entirely for roles without cost-price access, so
 * the field never reaches the client, not just gets hidden in the UI.
 */
function stripCostPrice(rows: Record<string, unknown>[], role: string | null): Record<string, unknown>[] {
  if (role && COST_PRICE_ROLES.has(role)) return rows;
  return rows.map(({ cost_price, ...rest }) => rest);
}

export async function getProducts(req: Request, res: Response) {
  const { supabase, staff } = req as AuthedRequest;
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const data = await listProducts(supabase, category);
    res.json(stripCostPrice(data, staff.role));
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}

export async function postProduct(req: Request, res: Response) {
  const { supabase, staff } = req as AuthedRequest;
  try {
    const { name, sku, category, cost_price, selling_price, made_to_order, requires_lab_work, lab_job_type } =
      req.body as ProductInput;
    if (!name || !sku || !category) {
      res.status(400).json({ error: 'name, sku, and category are required' });
      return;
    }
    const data = await createProduct(supabase, staff.organization_id, {
      name,
      sku,
      category,
      cost_price: cost_price ?? 0,
      selling_price: selling_price ?? 0,
      made_to_order: !!made_to_order,
      requires_lab_work: !!requires_lab_work,
      lab_job_type: requires_lab_work ? lab_job_type ?? 'Other' : null,
    });
    res.status(201).json(data);
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}

export async function getStock(req: Request, res: Response) {
  const { supabase } = req as AuthedRequest;
  try {
    const storeId = typeof req.query.store_id === 'string' ? req.query.store_id : undefined;
    const data = await listStock(supabase, storeId);
    res.json(data);
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}

export async function postStock(req: Request, res: Response) {
  const { supabase } = req as AuthedRequest;
  try {
    const { product_id, store_id, quantity, low_stock_threshold } = req.body;
    if (!product_id || !store_id || quantity === undefined) {
      res.status(400).json({ error: 'product_id, store_id, and quantity are required' });
      return;
    }
    const data = await upsertStock(supabase, product_id, store_id, quantity, low_stock_threshold);
    res.status(201).json(data);
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}
