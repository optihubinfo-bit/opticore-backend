import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getProducts, getStock, postProduct, postStock } from '../controllers/productsController.js';

export const productsRouter = Router();

productsRouter.use(requireAuth);

productsRouter.get('/', getProducts);
productsRouter.post('/', postProduct);
productsRouter.get('/stock', getStock);
productsRouter.post('/stock', postStock);
