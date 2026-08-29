import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getInvoices, postInvoice } from '../controllers/invoicesController.js';

export const invoicesRouter = Router();

invoicesRouter.use(requireAuth);

invoicesRouter.get('/', getInvoices);
invoicesRouter.post('/', postInvoice);
