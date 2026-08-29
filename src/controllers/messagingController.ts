import type { Request, Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { statusForError } from '../lib/httpError.js';
import type { MessageChannel } from '../lib/messaging.js';
import {
  createTemplate,
  getAudienceCounts,
  listRules,
  listSendLog,
  listTemplates,
  runScheduledTriggers,
  sendBulkMessage,
  updateRuleEnabled,
  type Audience,
} from '../services/messagingService.js';

const CHANNELS: MessageChannel[] = ['WhatsApp', 'SMS', 'Email'];
const AUDIENCES: Audience[] = ['recall_due', 'order_ready', 'all_patients'];

export async function getTemplates(req: Request, res: Response) {
  const { supabase } = req as AuthedRequest;
  try {
    res.json(await listTemplates(supabase));
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}

export async function postTemplate(req: Request, res: Response) {
  const { supabase, staff } = req as AuthedRequest;
  try {
    const { name, channel, body } = req.body as { name: string; channel: MessageChannel; body: string };
    if (!name || !channel || !body || !CHANNELS.includes(channel)) {
      res.status(400).json({ error: 'name, a valid channel, and body are required' });
      return;
    }
    const data = await createTemplate(supabase, staff.organization_id, { name, channel, body });
    res.status(201).json(data);
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}

export async function getRules(req: Request, res: Response) {
  const { supabase } = req as AuthedRequest;
  try {
    res.json(await listRules(supabase));
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}

export async function patchRule(req: Request, res: Response) {
  const { supabase } = req as AuthedRequest;
  try {
    const { enabled } = req.body as { enabled: boolean };
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled must be a boolean' });
      return;
    }
    res.json(await updateRuleEnabled(supabase, req.params.id, enabled));
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}

export async function getAudiences(req: Request, res: Response) {
  const { supabase } = req as AuthedRequest;
  try {
    const storeId = typeof req.query.store_id === 'string' ? req.query.store_id : undefined;
    if (!storeId) {
      res.status(400).json({ error: 'store_id is required' });
      return;
    }
    res.json(await getAudienceCounts(supabase, storeId));
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}

export async function getSendLog(req: Request, res: Response) {
  const { supabase } = req as AuthedRequest;
  try {
    const storeId = typeof req.query.store_id === 'string' ? req.query.store_id : undefined;
    res.json(await listSendLog(supabase, storeId));
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}

export async function postSend(req: Request, res: Response) {
  const { supabase, staff } = req as AuthedRequest;
  try {
    const { store_id, store_name, audience, audience_label, channel, body, template_id } = req.body as {
      store_id: string;
      store_name: string;
      audience: Audience;
      audience_label: string;
      channel: MessageChannel;
      body: string;
      template_id?: string | null;
    };
    if (!store_id || !store_name || !audience || !AUDIENCES.includes(audience) || !channel || !CHANNELS.includes(channel) || !body) {
      res.status(400).json({ error: 'store_id, store_name, a valid audience, a valid channel, and body are required' });
      return;
    }
    const data = await sendBulkMessage(supabase, {
      organizationId: staff.organization_id,
      storeId: store_id,
      storeName: store_name,
      audience,
      audienceLabel: audience_label || audience,
      channel,
      body,
      templateId: template_id ?? null,
      createdBy: staff.id,
    });
    res.status(201).json(data);
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}

export async function postRunTriggers(req: Request, res: Response) {
  const { supabase, staff } = req as AuthedRequest;
  try {
    const { store_ids } = req.body as { store_ids: string[] };
    if (!Array.isArray(store_ids) || store_ids.length === 0) {
      res.status(400).json({ error: 'store_ids must be a non-empty array' });
      return;
    }
    const data = await runScheduledTriggers(supabase, staff.organization_id, store_ids);
    res.json(data);
  } catch (error: any) {
    res.status(statusForError(error)).json({ error: error.message });
  }
}
