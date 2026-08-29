import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getTransfers, patchTransferApprove, patchTransferReceive, postTransfer } from '../controllers/transfersController.js';

export const transfersRouter = Router();

transfersRouter.use(requireAuth);

transfersRouter.get('/', getTransfers);
transfersRouter.post('/', postTransfer);
transfersRouter.patch('/:id/approve', patchTransferApprove);
transfersRouter.patch('/:id/receive', patchTransferReceive);
