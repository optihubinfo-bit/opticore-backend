import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getAppointments, patchAppointmentStatus, postAppointment } from '../controllers/appointmentsController.js';

export const appointmentsRouter = Router();

appointmentsRouter.use(requireAuth);

appointmentsRouter.get('/', getAppointments);
appointmentsRouter.post('/', postAppointment);
appointmentsRouter.patch('/:id/status', patchAppointmentStatus);
