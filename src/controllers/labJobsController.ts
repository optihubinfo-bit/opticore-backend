import type { Request, Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { statusForError } from '../lib/httpError.js';
import { listLabJobs, updateLabJobStage } from '../services/labJobsService.js';
import { triggerOrderReadyMessage } from '../services/messagingService.js';

const STAGES = ['received', 'edging', 'quality_check', 'ready_for_pickup'];

export async function getLabJobs(req: Request, res: Response) {
  const { supabase } = req as AuthedRequest;
  try {
    const storeId = typeof req.query.store_id === 'string' ? req.query.store_id : undefined;
    const data = await listLabJobs(supabase, { storeId });
    res.json(data);
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}

export async function patchLabJobStage(req: Request, res: Response) {
  const { supabase } = req as AuthedRequest;
  try {
    const { stage, previous_stage } = req.body as { stage: string; previous_stage?: string };
    if (!STAGES.includes(stage)) {
      res.status(400).json({ error: `stage must be one of: ${STAGES.join(', ')}` });
      return;
    }
    let data = await updateLabJobStage(supabase, req.params.id, stage);
    if (stage === 'ready_for_pickup' && previous_stage !== 'ready_for_pickup') {
      const result = await triggerOrderReadyMessage(supabase, data);
      if (result?.status === 'sent') data = { ...data, sms_sent: true };
    }
    res.json(data);
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}
