import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getLabJobs, patchLabJobStage } from '../controllers/labJobsController.js';

export const labJobsRouter = Router();

labJobsRouter.use(requireAuth);

labJobsRouter.get('/', getLabJobs);
labJobsRouter.patch('/:id/stage', patchLabJobStage);
