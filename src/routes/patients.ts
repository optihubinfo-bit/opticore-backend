import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getPatientById,
  getPatientPrescriptions,
  getPatients,
  postPatient,
  postPatientPrescriptions,
} from '../controllers/patientsController.js';

export const patientsRouter = Router();

patientsRouter.use(requireAuth);

patientsRouter.get('/', getPatients);
patientsRouter.post('/', postPatient);
patientsRouter.get('/:id', getPatientById);
patientsRouter.get('/:id/prescriptions', getPatientPrescriptions);
patientsRouter.post('/:id/prescriptions', postPatientPrescriptions);
