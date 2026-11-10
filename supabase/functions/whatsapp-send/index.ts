// ============================================================
// Supabase Edge Function: whatsapp-send
// Architecture:
//   AIGMS React Frontend (JWT Authenticated)
//   → Supabase Edge Function (whatsapp-send)
//   → Notification Queue / Logs (aigms_notifications)
//   → Meta WhatsApp Cloud API (Graph API configurable version)
//   → Automatic Email Fallback on WhatsApp Failure
//   → Honest Invoice Send Timestamp (confirmation_email_sent_at)
//
// SECURITY:
//   All Meta & Email credentials (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
//   WHATSAPP_BUSINESS_ACCOUNT_ID, RESEND_API_KEY) are read exclusively from
//   server-side Deno.env secrets — NEVER exposed in browser VITE_* variables.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const APPROVED_TEMPLATES: Record<string, { metaName: string; requiredVars: string[] }> = {
  'order.confirmation': {
    metaName: 'aigms_order_confirmation_v1',
    requiredVars: ['participant_name', 'order_ref', 'programme', 'quantity', 'total_formatted', 'portal_url'],
  },
  'order.created_whatsapp': {
    metaName: 'aigms_order_confirmation_v1',
    requiredVars: ['participant_name', 'order_ref', 'programme'],
  },
  'payment.submitted': {
    metaName: 'aigms_payment_submitted_v1',
    requiredVars: ['participant_name', 'order_ref', 'payment_ref'],
  },
  'payment.verified': {
    metaName: 'aigms_payment_verified_v1',
    requiredVars: ['participant_name', 'order_ref', 'payment_ref', 'amount_formatted'],
  },
  'payment.rejected': {
    metaName: 'aigms_payment_rejected_v1',
    requiredVars: ['participant_name', 'order_ref', 'payment_ref'],
  },
  'animal.allocated': {
    metaName: 'aigms_animal_allocated_v1',
    requiredVars: ['participant_name', 'order_ref', 'programme'],
  },
  'qurban.completed': {
    metaName: 'aigms_qurban_completed_v1',
    requiredVars: ['participant_name', 'order_ref', 'programme'],
  },
  'qurban.status_update': {
    metaName: 'aigms_qurban_status_v1',
    requiredVars: ['participant_name', 'order_ref', 'programme', 'status_label'],
  },
  'delivery.scheduled': {
    metaName: 'aigms_delivery_scheduled_v1',
    requiredVars: ['participant_name', 'order_ref'],
  },
  'delivery.out_for_delivery': {
    metaName: 'aigms_delivery_out_v1',
    requiredVars: ['participant_name', 'order_ref'],
  },
  'delivery.completed': {
    metaName: 'aigms_delivery_completed_v1',
    requiredVars: ['participant_name', 'order_ref'],
  },
  'breeding.weight_update': {
    metaName: 'aigms_breeding_weight_v1',
    requiredVars: ['participant_name', 'order_ref', 'animal_code', 'qurban_holder', 'weight_kg'],
  },
  'certificate.ready': {
    metaName: 'aigms_certificate_ready_v1',
    requiredVars: ['participant_name', 'order_ref', 'certificate_ref', 'programme'],
  },
  'certificate.ready_portal_download': {
    metaName: 'aigms_certificate_ready_v1',
    requiredVars: ['participant_name', 'order_ref', 'certificate_ref', 'programme'],
  },
};

function normaliseE164(raw?: string | null): { valid: true; e164: string; digits: string } | { valid: false; error: string } {
  const cleaned = (raw ?? '').trim();
  if (!cleaned || /[a-zA-Z]/.test(cleaned)) {
    return { valid: false, error: 'Invalid recipient phone number.' };
  }
  let digits = cleaned.replace(/\D+/g, '');
  if (digits.length === 8 && /^[689]/.test(digits)) {
    digits = `65${digits}`;
  }
  if (!/^[1-9]\d{7,14}$/.test(digits)) {
    return { valid: false, error: `Phone "${cleaned}" is not a valid E.164 phone number.` };
  }
  return { valid: true, e164: `+${digits}`, digits };
}

async function sendEmailViaProvider(params: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ success: boolean; providerRef?: string; error?: string }> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('NOTIFICATION_EMAIL_FROM') || 'Al Ihsan Group <noreply@alihsangroup.sg>';
  if (!resendKey) {
    return {
      success: false,
      error: 'Email provider secret (RESEND_API_KEY) is not configured on the Edge Function.',
    };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [params.to],
      subject: params.subject,
      text: params.body,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      success: false,
      error: (json as { message?: string }).message || `Email provider HTTP ${res.status}`,
    };
  }
  return {
    success: true,
    providerRef: (json as { id?: string }).id || `email-${Date.now()}`,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const authHeader = req.headers.get('Authorization');

  if (!authHeader || !supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Unauthorized: valid Authorization bearer token and server configuration required.',
        errorCode: 'UNAUTHORIZED',
      }),
      { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  // Verify caller identity via JWT
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !authData?.user) {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid or expired authentication token.', errorCode: 'UNAUTHORIZED' }),
      { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  // Verify staff role before allowing outbound notifications
  const { data: profileRow } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle();

  const staffRoles = ['super_admin', 'operations_admin', 'supplier_manager', 'field_team', 'driver', 'd3_technical_admin'];
  if (!profileRow || !staffRoles.includes(profileRow.role)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Forbidden: only authorized AIG staff can dispatch outbound notifications.',
        errorCode: 'FORBIDDEN',
      }),
      { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  const body = await req.json().catch(() => ({}));
  const channel: 'whatsapp' | 'email' = body.channel === 'email' ? 'email' : 'whatsapp';
  const recipient = body.recipient ?? {};
  const idempotencyKey: string | undefined = body.idempotencyKey?.trim() || undefined;
  const orderRef: string | undefined = body.orderRef?.trim() || undefined;
  const templateId: string | undefined = body.templateId?.trim() || undefined;
  const variables: Record<string, string> = body.variables ?? {};

  // Idempotency check against aigms_notifications
  if (idempotencyKey) {
    const { data: existingNotif } = await adminClient
      .from('aigms_notifications')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existingNotif && ['accepted_by_provider', 'sent', 'delivered', 'read', 'fallback_completed'].includes(existingNotif.delivery_state)) {
      return new Response(
        JSON.stringify({
          success: true,
          channelUsed: existingNotif.channel_used,
          fallbackUsed: existingNotif.fallback_used,
          providerRef: existingNotif.provider_ref,
          deliveryState: existingNotif.delivery_state,
          idempotentReplay: true,
        }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }
  }

  // Direct Email Request (e.g., One-Time Order Confirmation & Invoice)
  if (channel === 'email') {
    const emailRes = await sendEmailViaProvider({
      to: recipient.email ?? '',
      subject: body.subject || 'Al Ihsan Group — Qurban Notification',
      body: body.body || '',
    });

    const deliveryState = emailRes.success ? 'accepted_by_provider' : 'failed';
    await adminClient.from('aigms_notifications').upsert(
      {
        id: crypto.randomUUID(),
        idempotency_key: idempotencyKey ?? null,
        event_type: body.eventType ?? 'order.confirmation',
        order_ref: orderRef ?? null,
        recipient_name: recipient.name ?? 'Participant',
        recipient_email: recipient.email ?? null,
        primary_channel: 'email',
        channel_used: 'email',
        template_id: templateId ?? null,
        delivery_state: deliveryState,
        is_simulated: false,
        fallback_used: false,
        provider_ref: emailRes.providerRef ?? null,
        error_message: emailRes.error ?? null,
      },
      { onConflict: 'idempotency_key' },
    );

    // Phase 4.8: Stamp confirmation_email_sent_at ONLY after real email provider acceptance!
    if (emailRes.success && orderRef && templateId === 'order.confirmation_invoice_once') {
      await adminClient.rpc('record_order_invoice_email_sent', {
        p_order_ref: orderRef,
        p_provider_ref: emailRes.providerRef ?? 'email-accepted',
        p_idempotency_key: idempotencyKey ?? `invoice:${orderRef}`,
      });
    }

    return new Response(
      JSON.stringify({
        success: emailRes.success,
        channelUsed: 'email',
        providerRef: emailRes.providerRef,
        deliveryState,
        error: emailRes.error,
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  // Primary Channel: Meta WhatsApp Cloud API
  const phoneCheck = normaliseE164(recipient.phoneE164 || recipient.phone);
  if (!phoneCheck.valid) {
    return new Response(
      JSON.stringify({
        success: false,
        channelUsed: 'whatsapp',
        deliveryState: 'failed',
        error: phoneCheck.error,
        errorCode: 'INVALID_RECIPIENT_PHONE',
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  // Validate template & variables
  const tplSpec = templateId ? APPROVED_TEMPLATES[templateId] : undefined;
  if (templateId && !tplSpec) {
    return new Response(
      JSON.stringify({
        success: false,
        channelUsed: 'whatsapp',
        deliveryState: 'failed',
        error: `Unapproved WhatsApp template "${templateId}".`,
        errorCode: 'INVALID_TEMPLATE',
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
  if (tplSpec) {
    const missing = tplSpec.requiredVars.filter(k => !variables[k] || !String(variables[k]).trim());
    if (missing.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          channelUsed: 'whatsapp',
          deliveryState: 'failed',
          error: `Missing template variable(s): ${missing.join(', ')}`,
          errorCode: 'INVALID_TEMPLATE',
        }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }
  }

  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const graphVersion = Deno.env.get('WHATSAPP_GRAPH_API_VERSION') || 'v21.0';

  if (!accessToken || !phoneNumberId) {
    return new Response(
      JSON.stringify({
        success: false,
        channelUsed: 'whatsapp',
        deliveryState: 'failed',
        error: 'Meta WhatsApp Cloud API secrets (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID) are not configured.',
        errorCode: 'MISSING_CREDENTIALS',
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  const graphUrl = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;
  const metaPayload = tplSpec
    ? {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneCheck.digits,
        type: 'template',
        template: {
          name: tplSpec.metaName,
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: tplSpec.requiredVars.map(varName => ({
                type: 'text',
                text: String(variables[varName] ?? ''),
              })),
            },
          ],
        },
      }
    : {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneCheck.digits,
        type: 'text',
        text: { preview_url: true, body: body.body || '' },
      };

  const waResponse = await fetch(graphUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metaPayload),
  });

  const waJson = await waResponse.json().catch(() => ({}));
  if (waResponse.ok) {
    const wamid =
      (waJson as { messages?: Array<{ id?: string }> }).messages?.[0]?.id || `wamid-${Date.now()}`;

    await adminClient.from('aigms_notifications').upsert(
      {
        id: crypto.randomUUID(),
        idempotency_key: idempotencyKey ?? null,
        event_type: body.eventType ?? 'order.confirmation',
        order_ref: orderRef ?? null,
        recipient_name: recipient.name ?? 'Participant',
        recipient_phone_e164: phoneCheck.e164,
        recipient_email: recipient.email ?? null,
        primary_channel: 'whatsapp',
        channel_used: 'whatsapp',
        template_id: templateId ?? null,
        template_variables: variables,
        delivery_state: 'accepted_by_provider', // Awaits Meta webhook for 'sent' / 'delivered' / 'read'
        is_simulated: false,
        fallback_used: false,
        provider_ref: wamid,
      },
      { onConflict: 'idempotency_key' },
    );

    return new Response(
      JSON.stringify({
        success: true,
        channelUsed: 'whatsapp',
        fallbackUsed: false,
        providerRef: wamid,
        deliveryState: 'accepted_by_provider',
        recipientPhoneE164: phoneCheck.e164,
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  // WhatsApp failed -> Automatic Email Fallback if recipient email is present
  const metaErr =
    (waJson as { error?: { message?: string; code?: number } }).error?.message ||
    `Meta Cloud API HTTP ${waResponse.status}`;

  if (recipient.email?.trim()) {
    const fallbackEmail = await sendEmailViaProvider({
      to: recipient.email.trim(),
      subject: body.subject || `Al Ihsan Group — Qurban Update (${orderRef || 'Notification'})`,
      body: body.body || '',
    });

    const finalState = fallbackEmail.success ? 'fallback_completed' : 'failed';
    await adminClient.from('aigms_notifications').upsert(
      {
        id: crypto.randomUUID(),
        idempotency_key: idempotencyKey ?? null,
        event_type: body.eventType ?? 'order.confirmation',
        order_ref: orderRef ?? null,
        recipient_name: recipient.name ?? 'Participant',
        recipient_phone_e164: phoneCheck.e164,
        recipient_email: recipient.email.trim(),
        primary_channel: 'whatsapp',
        channel_used: 'email',
        template_id: templateId ?? null,
        template_variables: variables,
        delivery_state: finalState,
        is_simulated: false,
        fallback_used: true,
        provider_ref: fallbackEmail.providerRef ?? null,
        error_message: fallbackEmail.success ? `WhatsApp failed (${metaErr}); Email fallback succeeded` : metaErr,
      },
      { onConflict: 'idempotency_key' },
    );

    return new Response(
      JSON.stringify({
        success: fallbackEmail.success,
        channelUsed: 'email',
        fallbackUsed: true,
        providerRef: fallbackEmail.providerRef,
        deliveryState: finalState,
        error: fallbackEmail.success ? undefined : metaErr,
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({
      success: false,
      channelUsed: 'whatsapp',
      fallbackUsed: false,
      deliveryState: 'failed',
      error: metaErr,
    }),
    { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
  );
});
