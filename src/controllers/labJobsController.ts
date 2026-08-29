import type { Request, Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { statusForError } from '../lib/httpError.js';
import { listLabJobs, updateLabJobStage } from '../services/labJobsService.js';

const STAGES = ['received', 'edging', 'quality_check', 'ready_for_pickup'];

/**
 * Phase 8 hook point for Phase 11 (Bulk SMS): called the moment a job
 * first reaches ready_for_pickup. Not implemented yet - just the
 * trigger point the phase prompt asked for.
 */
function sendPickupNotificationStub(job: { id: string; job_number: string }) {
  console.log(`[lab-jobs] TODO Phase 11: send pickup SMS for ${job.job_number} (${job.id})`);
}

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
    const data = await updateLabJobStage(supabase, req.params.id, stage);
    if (stage === 'ready_for_pickup' && previous_stage !== 'ready_for_pickup') {
      sendPickupNotificationStub(data);
    }
    res.json(data);
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}
