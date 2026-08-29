export type MessageChannel = 'WhatsApp' | 'SMS' | 'Email';

export type SendMessageResult = {
  status: 'sent' | 'failed';
  providerRef?: string;
  error?: string;
};

/**
 * The single seam every send in the app goes through. Behind the
 * MESSAGING_PROVIDER env flag, defaulting to 'stub' since no real
 * WhatsApp/SMS/Email provider credentials exist yet - confirm which
 * provider before wiring a real one in here. Swapping providers later
 * only touches this function, never the callers.
 */
export async function sendMessage(channel: MessageChannel, to: string, body: string): Promise<SendMessageResult> {
  const provider = process.env.MESSAGING_PROVIDER ?? 'stub';

  if (provider === 'stub') {
    console.log(`[messaging:stub] ${channel} -> ${to}: ${body}`);
    return { status: 'sent', providerRef: `stub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
  }

  throw new Error(`Unknown MESSAGING_PROVIDER "${provider}" - no real provider is wired up yet`);
}

export function renderTemplate(body: string, vars: { patient_name: string; store_name: string }): string {
  return body.replace(/\{patient_name\}/g, vars.patient_name).replace(/\{store_name\}/g, vars.store_name);
}
