import type { SupabaseClient } from '@supabase/supabase-js';
import { renderTemplate, sendMessage, type MessageChannel } from '../lib/messaging.js';

export type Audience = 'recall_due' | 'order_ready' | 'all_patients';

const DEFAULT_TRIGGER_BODIES: Record<string, string> = {
  rx_expiry_30d: 'Hi {patient_name}, your prescription is expiring soon. Visit {store_name} to book a recall exam.',
  order_ready: 'Hi {patient_name}, your order is ready for pickup at {store_name}.',
  appointment_reminder_1d: 'Hi {patient_name}, reminder: you have an appointment tomorrow at {store_name}.',
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function listTemplates(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('message_templates').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createTemplate(
  supabase: SupabaseClient,
  organizationId: string,
  input: { name: string; channel: MessageChannel; body: string }
) {
  const { data, error } = await supabase
    .from('message_templates')
    .insert({ ...input, organization_id: organizationId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listRules(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('auto_trigger_rules').select('*').order('trigger_event');
  if (error) throw error;
  return data;
}

export async function updateRuleEnabled(supabase: SupabaseClient, id: string, enabled: boolean) {
  const { data, error } = await supabase
    .from('auto_trigger_rules')
    .update({ enabled })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listSendLog(supabase: SupabaseClient, storeId?: string) {
  let query = supabase.from('send_log').select('*').order('sent_at', { ascending: false }).limit(100);
  if (storeId) query = query.eq('store_id', storeId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

type Recipient = { id: string; name: string; phone: string | null };

async function recallDuePatients(supabase: SupabaseClient, storeId: string): Promise<Recipient[]> {
  const { data, error } = await supabase
    .from('prescriptions')
    .select('patient_id, patient:patients(id, name, phone)')
    .eq('store_id', storeId)
    .lte('expiry_date', addDaysISO(30));
  if (error) throw error;

  const byPatient = new Map<string, Recipient>();
  for (const row of data ?? []) {
    const patient = (row as any).patient;
    if (patient) byPatient.set(patient.id, { id: patient.id, name: patient.name, phone: patient.phone });
  }
  return Array.from(byPatient.values());
}

async function orderReadyPatients(supabase: SupabaseClient, storeId: string): Promise<Recipient[]> {
  const { data, error } = await supabase
    .from('lab_jobs')
    .select('patient_id, patient:patients(id, name, phone)')
    .eq('store_id', storeId)
    .eq('stage', 'ready_for_pickup');
  if (error) throw error;

  const byPatient = new Map<string, Recipient>();
  for (const row of data ?? []) {
    const patient = (row as any).patient;
    if (patient) byPatient.set(patient.id, { id: patient.id, name: patient.name, phone: patient.phone });
  }
  return Array.from(byPatient.values());
}

async function allStorePatients(supabase: SupabaseClient, storeId: string): Promise<Recipient[]> {
  const { data, error } = await supabase.from('patients').select('id, name, phone').eq('assigned_store_id', storeId);
  if (error) throw error;
  return (data ?? []) as Recipient[];
}

async function resolveAudience(supabase: SupabaseClient, storeId: string, audience: Audience): Promise<Recipient[]> {
  if (audience === 'recall_due') return recallDuePatients(supabase, storeId);
  if (audience === 'order_ready') return orderReadyPatients(supabase, storeId);
  return allStorePatients(supabase, storeId);
}

export async function getAudienceCounts(supabase: SupabaseClient, storeId: string) {
  const [recallDue, orderReady, allPatients] = await Promise.all([
    recallDuePatients(supabase, storeId),
    orderReadyPatients(supabase, storeId),
    allStorePatients(supabase, storeId),
  ]);
  return { recallDue: recallDue.length, orderReady: orderReady.length, allPatients: allPatients.length };
}

export async function sendBulkMessage(
  supabase: SupabaseClient,
  options: {
    organizationId: string;
    storeId: string;
    storeName: string;
    audience: Audience;
    audienceLabel: string;
    channel: MessageChannel;
    body: string;
    templateId?: string | null;
    createdBy: string;
  }
) {
  const recipients = (await resolveAudience(supabase, options.storeId, options.audience)).filter((r) => r.phone);

  let sentCount = 0;
  for (const recipient of recipients) {
    const rendered = renderTemplate(options.body, { patient_name: recipient.name, store_name: options.storeName });
    const result = await sendMessage(options.channel, recipient.phone as string, rendered);
    if (result.status === 'sent') sentCount += 1;
  }

  const { data, error } = await supabase
    .from('send_log')
    .insert({
      organization_id: options.organizationId,
      store_id: options.storeId,
      template_id: options.templateId ?? null,
      audience_description: options.audienceLabel,
      channel: options.channel,
      recipient_count: recipients.length,
      sent_count: sentCount,
      status: sentCount === recipients.length && recipients.length > 0 ? 'sent' : recipients.length === 0 ? 'sent' : 'failed',
      triggered_by: 'manual',
      created_by: options.createdBy,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * order_ready is triggered live from the lab job stage-update path.
 * rx_expiry_30d and appointment_reminder_1d have no natural
 * single-request moment to fire from (they're time-window scans), so
 * this is the manual "run the scan now" entry point Auto Reminders
 * exposes - there's no cron/scheduler in this stack yet. Runs once
 * per store the caller can see, only for enabled rules.
 */
export async function runScheduledTriggers(supabase: SupabaseClient, organizationId: string, storeIds: string[]) {
  const { data: rules, error: rulesError } = await supabase
    .from('auto_trigger_rules')
    .select('*, template:message_templates(body)')
    .in('trigger_event', ['rx_expiry_30d', 'appointment_reminder_1d']);
  if (rulesError) throw rulesError;

  const results: any[] = [];

  for (const rule of rules ?? []) {
    if (!rule.enabled) continue;

    for (const storeId of storeIds) {
      const { data: store } = await supabase.from('stores').select('name').eq('id', storeId).single();
      const storeName = store?.name ?? 'your store';
      const body = (rule as any).template?.body ?? DEFAULT_TRIGGER_BODIES[rule.trigger_event];

      let recipients: Recipient[] = [];
      let label = '';
      if (rule.trigger_event === 'rx_expiry_30d') {
        recipients = await recallDuePatients(supabase, storeId);
        label = 'Auto: Prescription recall';
      } else {
        const tomorrow = addDaysISO(1);
        const { data: appts, error: apptError } = await supabase
          .from('appointments')
          .select('patient_id, patient:patients(id, name, phone)')
          .eq('store_id', storeId)
          .eq('status', 'scheduled')
          .gte('start_time', `${tomorrow}T00:00:00`)
          .lt('start_time', `${tomorrow}T23:59:59.999`);
        if (apptError) throw apptError;
        const byPatient = new Map<string, Recipient>();
        for (const row of appts ?? []) {
          const patient = (row as any).patient;
          if (patient) byPatient.set(patient.id, { id: patient.id, name: patient.name, phone: patient.phone });
        }
        recipients = Array.from(byPatient.values());
        label = 'Auto: Appointment reminder';
      }

      const withPhone = recipients.filter((r) => r.phone);
      if (withPhone.length === 0) continue;

      let sentCount = 0;
      for (const recipient of withPhone) {
        const rendered = renderTemplate(body, { patient_name: recipient.name, store_name: storeName });
        const result = await sendMessage(rule.channel, recipient.phone as string, rendered);
        if (result.status === 'sent') sentCount += 1;
      }

      const { data: logRow, error: logError } = await supabase
        .from('send_log')
        .insert({
          organization_id: organizationId,
          store_id: storeId,
          template_id: rule.template_id,
          auto_trigger_rule_id: rule.id,
          audience_description: label,
          channel: rule.channel,
          recipient_count: withPhone.length,
          sent_count: sentCount,
          status: sentCount === withPhone.length ? 'sent' : 'failed',
          triggered_by: 'auto_trigger',
        })
        .select()
        .single();
      if (logError) throw logError;
      results.push(logRow);
    }
  }

  return results;
}

/**
 * The live order_ready hook, called from the lab job stage-update
 * path the moment a job first reaches ready_for_pickup. No-ops
 * (returns null) if the rule is disabled - toggling it off must stop
 * new messages from enqueuing, per the phase's acceptance criterion.
 */
export async function triggerOrderReadyMessage(
  supabase: SupabaseClient,
  job: { id: string; job_number: string; store_id: string; organization_id: string; patient?: { name: string; phone: string | null } }
) {
  const { data: rule, error: ruleError } = await supabase
    .from('auto_trigger_rules')
    .select('*, template:message_templates(body)')
    .eq('trigger_event', 'order_ready')
    .single();
  if (ruleError || !rule || !rule.enabled) return null;

  if (!job.patient?.phone) return null;

  const { data: store } = await supabase.from('stores').select('name').eq('id', job.store_id).single();
  const storeName = store?.name ?? 'your store';
  const body = (rule as any).template?.body ?? DEFAULT_TRIGGER_BODIES.order_ready;
  const rendered = renderTemplate(body, { patient_name: job.patient.name, store_name: storeName });

  const result = await sendMessage(rule.channel, job.patient.phone, rendered);

  await supabase
    .from('send_log')
    .insert({
      organization_id: job.organization_id,
      store_id: job.store_id,
      template_id: rule.template_id,
      auto_trigger_rule_id: rule.id,
      audience_description: `Auto: Order ready - ${job.job_number}`,
      channel: rule.channel,
      recipient_count: 1,
      sent_count: result.status === 'sent' ? 1 : 0,
      status: result.status,
      triggered_by: 'auto_trigger',
    });

  if (result.status === 'sent') {
    await supabase.from('lab_jobs').update({ sms_sent: true }).eq('id', job.id);
  }

  return result;
}
