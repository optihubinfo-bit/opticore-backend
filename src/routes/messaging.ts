import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getAudiences,
  getRules,
  getSendLog,
  getTemplates,
  patchRule,
  postRunTriggers,
  postSend,
  postTemplate,
} from '../controllers/messagingController.js';

export const messagingRouter = Router();

messagingRouter.use(requireAuth);

messagingRouter.get('/templates', getTemplates);
messagingRouter.post('/templates', postTemplate);
messagingRouter.get('/rules', getRules);
messagingRouter.patch('/rules/:id', patchRule);
messagingRouter.get('/audiences', getAudiences);
messagingRouter.get('/send-log', getSendLog);
messagingRouter.post('/send', postSend);
messagingRouter.post('/run-triggers', postRunTriggers);
