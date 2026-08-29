import type { Request, Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { statusForError } from '../lib/httpError.js';
import {
  approveTransfer,
  createTransfer,
  listTransfers,
  receiveTransfer,
  type TransferInput,
} from '../services/transfersService.js';

export async function getTransfers(req: Request, res: Response) {
  const { supabase } = req as AuthedRequest;
  try {
    const data = await listTransfers(supabase);
    res.json(data);
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}

export async function postTransfer(req: Request, res: Response) {
  const { supabase } = req as AuthedRequest;
  try {
    const { from_store_id, to_store_id, product_id, quantity } = req.body as TransferInput;
    if (!from_store_id || !to_store_id || !product_id || !quantity) {
      res.status(400).json({ error: 'from_store_id, to_store_id, product_id, and quantity are required' });
      return;
    }
    if (from_store_id === to_store_id) {
      res.status(400).json({ error: 'from_store_id and to_store_id must be different stores' });
      return;
    }
    if (quantity <= 0) {
      res.status(400).json({ error: 'quantity must be a positive number' });
      return;
    }
    const data = await createTransfer(supabase, { from_store_id, to_store_id, product_id, quantity });
    res.status(201).json(data);
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}

export async function patchTransferApprove(req: Request, res: Response) {
  const { supabase } = req as AuthedRequest;
  try {
    const data = await approveTransfer(supabase, req.params.id);
    res.json(data);
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}

export async function patchTransferReceive(req: Request, res: Response) {
  const { supabase } = req as AuthedRequest;
  try {
    const data = await receiveTransfer(supabase, req.params.id);
    res.json(data);
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}
