import type { Request, Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { statusForError } from '../lib/httpError.js';
import {
  createAppointment,
  listAppointments,
  updateAppointmentStatus,
  type AppointmentInput,
} from '../services/appointmentsService.js';

const APPOINTMENT_TYPES = ['Eye Exam', 'Follow-up', 'Contact Lens Fit', 'Frame Fitting', 'Other'];
const APPOINTMENT_STATUSES = ['scheduled', 'completed', 'cancelled'];

export async function getAppointments(req: Request, res: Response) {
  const { supabase } = req as AuthedRequest;
  try {
    const storeId = typeof req.query.store_id === 'string' ? req.query.store_id : undefined;
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    const patientId = typeof req.query.patient_id === 'string' ? req.query.patient_id : undefined;
    const data = await listAppointments(supabase, { storeId, date, from, to, patientId });
    res.json(data);
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}

export async function postAppointment(req: Request, res: Response) {
  const { supabase } = req as AuthedRequest;
  try {
    const { patient_id, doctor_user_id, type, start_time, end_time } = req.body as AppointmentInput;
    if (!patient_id || !doctor_user_id || !type || !start_time || !end_time) {
      res.status(400).json({ error: 'patient_id, doctor_user_id, type, start_time, and end_time are required' });
      return;
    }
    if (!APPOINTMENT_TYPES.includes(type)) {
      res.status(400).json({ error: `type must be one of: ${APPOINTMENT_TYPES.join(', ')}` });
      return;
    }
    if (new Date(end_time) <= new Date(start_time)) {
      res.status(400).json({ error: 'end_time must be after start_time' });
      return;
    }
    const data = await createAppointment(supabase, { patient_id, doctor_user_id, type, start_time, end_time });
    res.status(201).json(data);
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}

export async function patchAppointmentStatus(req: Request, res: Response) {
  const { supabase } = req as AuthedRequest;
  try {
    const { status } = req.body as { status: string };
    if (!APPOINTMENT_STATUSES.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${APPOINTMENT_STATUSES.join(', ')}` });
      return;
    }
    const data = await updateAppointmentStatus(supabase, req.params.id, status);
    res.json(data);
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}
