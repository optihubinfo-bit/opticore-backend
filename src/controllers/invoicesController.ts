import type { Request, Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { statusForError } from '../lib/httpError.js';
import { createInvoice, listInvoices, type InvoiceLineItemInput } from '../services/invoicesService.js';

export async function getInvoices(req: Request, res: Response) {
  const { supabase } = req as AuthedRequest;
  try {
    const search = typeof req.query.q === 'string' ? req.query.q : undefined;
    const patientId = typeof req.query.patient_id === 'string' ? req.query.patient_id : undefined;
    const data = await listInvoices(supabase, { search, patientId });
    res.json(data);
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}

export async function postInvoice(req: Request, res: Response) {
  const { supabase } = req as AuthedRequest;
  try {
    const { patient_id, store_id, payment_method, line_items } = req.body as {
      patient_id: string;
      store_id: string;
      payment_method: string;
      line_items: InvoiceLineItemInput[];
    };

    if (!patient_id || !store_id || !payment_method || !Array.isArray(line_items) || line_items.length === 0) {
      res.status(400).json({ error: 'patient_id, store_id, payment_method, and at least one line item are required' });
      return;
    }

    const data = await createInvoice(supabase, { patient_id, store_id, payment_method, line_items });
    res.status(201).json(data);
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}
