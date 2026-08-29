import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.js';
import { patientsRouter } from './routes/patients.js';
import { productsRouter } from './routes/products.js';
import { invoicesRouter } from './routes/invoices.js';
import { appointmentsRouter } from './routes/appointments.js';
import { labJobsRouter } from './routes/labJobs.js';
import { transfersRouter } from './routes/transfers.js';
import { messagingRouter } from './routes/messaging.js';

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/patients', patientsRouter);
app.use('/api/products', productsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/lab-jobs', labJobsRouter);
app.use('/api/transfers', transfersRouter);
app.use('/api/messaging', messagingRouter);

app.listen(env.port, () => {
  console.log(`OptiCore backend listening on port ${env.port}`);
});
