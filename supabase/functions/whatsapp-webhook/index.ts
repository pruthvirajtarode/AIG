// ============================================================
// Supabase Edge Function: whatsapp-webhook
// Handles Meta WhatsApp Cloud API Webhook callbacks:
//   1. GET  — Meta Webhook verification challenge (hub.mode, hub.verify_token, hub.challenge)
//   2. POST — HMAC-SHA256 signature verification (X-Hub-Signature-256 + WHATSAPP_APP_SECRET)
//             and asynchronous delivery status updates ('sent', 'delivered', 'read', 'failed')
//             with automatic idempotent Email fallback when Meta reports delivery failure.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

async function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string | undefined,
): Promise<boolean> {
  if (!signatureHeader || !appSecret) return false;
  const trimmed = signatureHeader.trim();
  if (!trimmed.startsWith('sha256=')) return false;
  const expectedHex = trimmed.slice('sha256='.length).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expectedHex)) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const computedHex = Array.from(new Uint8Array(sigBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  if (computedHex.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < computedHex.length; i++) {
    diff |= computedHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // ── 1. GET: Meta Webhook Challenge Verification ─────────────
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const expectedToken = Deno.env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN');

    if (mode === 'subscribe' && expectedToken && token === expectedToken && challenge) {
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
    return new Response('Forbidden: webhook verify token mismatch', { status: 403 });
  }

  // ── 2. POST: Signed Meta Delivery Status Updates ────────────
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const rawBody = await req.text();
  const sigHeader = req.headers.get('X-Hub-Signature-256') || req.headers.get('x-hub-signature-256');
  const appSecret = Deno.env.get('WHATSAPP_APP_SECRET');

  const isValidSig = await verifySignature(rawBody, sigHeader, appSecret);
  if (!isValidSig) {
    return new Response(JSON.stringify({ error: 'Invalid X-Hub-Signature-256' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Server configuration missing' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);
  const payload = JSON.parse(rawBody || '{}');
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  let processedStatuses = 0;

  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const change of changes) {
      const statuses = Array.isArray(change?.value?.statuses) ? change.value.statuses : [];
      for (const st of statuses) {
        const wamid = st?.id;
        const statusVal = String(st?.status ?? '').toLowerCase();
        if (!wamid || !['sent', 'delivered', 'read', 'failed'].includes(statusVal)) continue;

        processedStatuses++;
        const nowIso = new Date().toISOString();
        const errTitle = st?.errors?.[0]?.title || st?.errors?.[0]?.message || null;

        const { data: notif } = await adminClient
          .from('aigms_notifications')
          .select('*')
          .eq('provider_ref', wamid)
          .maybeSingle();

        if (!notif) continue;

        if (statusVal === 'sent' || statusVal === 'delivered' || statusVal === 'read') {
          await adminClient
            .from('aigms_notifications')
            .update({
              delivery_state: statusVal,
              updated_at: nowIso,
              ...(statusVal === 'delivered' || statusVal === 'read'
                ? { delivered_at: notif.delivered_at ?? nowIso }
                : {}),
            })
            .eq('id', notif.id);
        } else if (statusVal === 'failed') {
          // Asynchronous Meta delivery failure -> trigger Email fallback if not yet sent
          const resendKey = Deno.env.get('RESEND_API_KEY');
          const fromEmail = Deno.env.get('NOTIFICATION_EMAIL_FROM') || 'Al Ihsan Group <noreply@alihsangroup.sg>';

          if (notif.recipient_email && !notif.fallback_used && resendKey) {
            await adminClient
              .from('aigms_notifications')
              .update({
                delivery_state: 'fallback_initiated',
                error_message: errTitle || 'Meta Cloud API asynchronous delivery failed',
                updated_at: nowIso,
              })
              .eq('id', notif.id);

            const emailRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${resendKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: fromEmail,
                to: [notif.recipient_email],
                subject: `Al Ihsan Group — Qurban Notification (${notif.order_ref || 'Update'})`,
                text: `Assalamu Alaikum ${notif.recipient_name || 'Participant'}, please log in to https://www.aigsuite.com/portal to view your latest Qurban order update (${notif.order_ref || ''}).`,
              }),
            });

            await adminClient
              .from('aigms_notifications')
              .update({
                delivery_state: emailRes.ok ? 'fallback_completed' : 'failed',
                channel_used: emailRes.ok ? 'email' : notif.channel_used,
                fallback_used: true,
                updated_at: new Date().toISOString(),
              })
              .eq('id', notif.id);
          } else {
            await adminClient
              .from('aigms_notifications')
              .update({
                delivery_state: 'failed',
                error_message: errTitle || 'Meta Cloud API asynchronous delivery failed',
                updated_at: nowIso,
              })
              .eq('id', notif.id);
          }
        }
      }
    }
  }

  return new Response(JSON.stringify({ received: true, processedStatuses }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
