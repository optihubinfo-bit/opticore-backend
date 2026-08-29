import type { Request, Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { statusForError } from '../lib/httpError.js';
import {
  createPatient,
  createPrescriptions,
  getPatient,
  listPatients,
  listPrescriptions,
  type PatientInput,
  type PrescriptionInput,
} from '../services/patientsService.js';

export async function getPatients(req: Request, res: Response) {
  const { supabase } = req as AuthedRequest;
  try {
    const search = typeof req.query.q === 'string' ? req.query.q : undefined;
    const data = await listPatients(supabase, search);
    res.json(data);
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}

export async function getPatientById(req: Request, res: Response) {
  const { supabase } = req as AuthedRequest;
  try {
    const data = await getPatient(supabase, req.params.id);
    res.json(data);
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}

export async function postPatient(req: Request, res: Response) {
  const { supabase } = req as AuthedRequest;
  try {
    const { name, phone, email, assigned_store_id } = req.body as PatientInput;
    if (!name || !assigned_store_id) {
      res.status(400).json({ error: 'name and assigned_store_id are required' });
      return;
    }
    const data = await createPatient(supabase, { name, phone, email, assigned_store_id });
    res.status(201).json(data);
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}

export async function getPatientPrescriptions(req: Request, res: Response) {
  const { supabase } = req as AuthedRequest;
  try {
    const data = await listPrescriptions(supabase, req.params.id);
    res.json(data);
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}

export async function postPatientPrescriptions(req: Request, res: Response) {
  const { supabase } = req as AuthedRequest;
  try {
    const rows = req.body as PrescriptionInput[];
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: 'Expected a non-empty array of prescription rows' });
      return;
    }
    for (const row of rows) {
      if (!row.eye || !row.issued_date || !row.expiry_date) {
        res.status(400).json({ error: 'Each row needs eye, issued_date, and expiry_date' });
        return;
      }
    }
    const data = await createPrescriptions(supabase, req.params.id, rows);
    res.status(201).json(data);
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}
