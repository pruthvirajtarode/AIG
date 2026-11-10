// ============================================================
// Notification Service — Production-Ready Server-Side Adapter,
// Honest Integration-Status Model, Approved WhatsApp Template
// Registry, Webhook Status Tracking & Automatic Email Fallback
// ============================================================

import { OFFICIAL_WHATSAPP_DISPLAY, OFFICIAL_WHATSAPP_NUMBER, normaliseWhatsAppPhoneE164 } from '@/lib/orderRules';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export type NotificationEventType =
  | 'order.confirmation'
  | 'payment.submitted'
  | 'payment.verified'
  | 'payment.rejected'
  | 'animal.allocated'
  | 'qurban.completed'
  | 'delivery.scheduled'
  | 'delivery.out_for_delivery'
  | 'delivery.completed'
  | 'breeding.weight_update'
  | 'certificate.ready';

export type NotificationDeliveryState =
  | 'queued'
  | 'submitted'
  | 'accepted_by_provider'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'fallback_initiated'
  | 'fallback_completed'
  | 'simulated';

export type NotificationProviderMode =
  | 'live_edge_function'
  | 'custom_adapter'
  | 'simulated_sandbox';

export type WhatsAppConnectionStatus =
  | 'connected'
  | 'edge_function_configured'
  | 'setup_required'
  | 'not_connected';

export interface WhatsAppTemplateSpec {
  templateId: string;
  metaTemplateName: string;
  eventType: NotificationEventType;
  category: 'UTILITY';
  language: 'en';
  requiredVariables: ReadonlyArray<string>;
  description: string;
}

/**
 * Approved WhatsApp Utility Template Registry for Meta Cloud API (+65 8545 6783).
 * Maps internal AIGMS event/template IDs to Meta-approved utility templates and required variables.
 */
export const WHATSAPP_TEMPLATE_REGISTRY: Record<string, WhatsAppTemplateSpec> = {
  'order.confirmation': {
    templateId: 'order.confirmation',
    metaTemplateName: 'aigms_order_confirmation_v1',
    eventType: 'order.confirmation',
    category: 'UTILITY',
    language: 'en',
    requiredVariables: ['participant_name', 'order_ref', 'programme', 'quantity', 'total_formatted', 'portal_url'],
    description: 'Order registration confirmation with portal tracking link',
  },
  'order.created_whatsapp': {
    templateId: 'order.created_whatsapp',
    metaTemplateName: 'aigms_order_confirmation_v1',
    eventType: 'order.confirmation',
    category: 'UTILITY',
    language: 'en',
    requiredVariables: ['participant_name', 'order_ref', 'programme'],
    description: 'Order registration confirmation via WhatsApp',
  },
  'payment.submitted': {
    templateId: 'payment.submitted',
    metaTemplateName: 'aigms_payment_submitted_v1',
    eventType: 'payment.submitted',
    category: 'UTILITY',
    language: 'en',
    requiredVariables: ['participant_name', 'order_ref', 'payment_ref'],
    description: 'Payment proof received confirmation',
  },
  'payment.verified': {
    templateId: 'payment.verified',
    metaTemplateName: 'aigms_payment_verified_v1',
    eventType: 'payment.verified',
    category: 'UTILITY',
    language: 'en',
    requiredVariables: ['participant_name', 'order_ref', 'payment_ref', 'amount_formatted'],
    description: 'Payment verified confirmation',
  },
  'payment.rejected': {
    templateId: 'payment.rejected',
    metaTemplateName: 'aigms_payment_rejected_v1',
    eventType: 'payment.rejected',
    category: 'UTILITY',
    language: 'en',
    requiredVariables: ['participant_name', 'order_ref', 'payment_ref'],
    description: 'Payment requires attention / resubmission alert',
  },
  'animal.allocated': {
    templateId: 'animal.allocated',
    metaTemplateName: 'aigms_animal_allocated_v1',
    eventType: 'animal.allocated',
    category: 'UTILITY',
    language: 'en',
    requiredVariables: ['participant_name', 'order_ref', 'programme'],
    description: 'Animal allocated to order notification',
  },
  'qurban.completed': {
    templateId: 'qurban.completed',
    metaTemplateName: 'aigms_qurban_completed_v1',
    eventType: 'qurban.completed',
    category: 'UTILITY',
    language: 'en',
    requiredVariables: ['participant_name', 'order_ref', 'programme'],
    description: 'Qurban/Aqiqah ritual completed notification',
  },
  'qurban.status_update': {
    templateId: 'qurban.status_update',
    metaTemplateName: 'aigms_qurban_status_v1',
    eventType: 'qurban.completed',
    category: 'UTILITY',
    language: 'en',
    requiredVariables: ['participant_name', 'order_ref', 'programme', 'status_label'],
    description: 'General Qurban lifecycle status update',
  },
  'delivery.scheduled': {
    templateId: 'delivery.scheduled',
    metaTemplateName: 'aigms_delivery_scheduled_v1',
    eventType: 'delivery.scheduled',
    category: 'UTILITY',
    language: 'en',
    requiredVariables: ['participant_name', 'order_ref'],
    description: 'Meat delivery scheduled notification',
  },
  'delivery.out_for_delivery': {
    templateId: 'delivery.out_for_delivery',
    metaTemplateName: 'aigms_delivery_out_v1',
    eventType: 'delivery.out_for_delivery',
    category: 'UTILITY',
    language: 'en',
    requiredVariables: ['participant_name', 'order_ref'],
    description: 'Meat delivery out for delivery notification',
  },
  'delivery.completed': {
    templateId: 'delivery.completed',
    metaTemplateName: 'aigms_delivery_completed_v1',
    eventType: 'delivery.completed',
    category: 'UTILITY',
    language: 'en',
    requiredVariables: ['participant_name', 'order_ref'],
    description: 'Meat delivery completed notification',
  },
  'breeding.weight_update': {
    templateId: 'breeding.weight_update',
    metaTemplateName: 'aigms_breeding_weight_v1',
    eventType: 'breeding.weight_update',
    category: 'UTILITY',
    language: 'en',
    requiredVariables: ['participant_name', 'order_ref', 'animal_code', 'qurban_holder', 'weight_kg'],
    description: 'Indonesia Breeding Programme monthly weight progress update',
  },
  'certificate.ready': {
    templateId: 'certificate.ready',
    metaTemplateName: 'aigms_certificate_ready_v1',
    eventType: 'certificate.ready',
    category: 'UTILITY',
    language: 'en',
    requiredVariables: ['participant_name', 'order_ref', 'certificate_ref', 'programme'],
    description: 'Certificate ready for PDF download in Participant Portal',
  },
  'certificate.ready_portal_download': {
    templateId: 'certificate.ready_portal_download',
    metaTemplateName: 'aigms_certificate_ready_v1',
    eventType: 'certificate.ready',
    category: 'UTILITY',
    language: 'en',
    requiredVariables: ['participant_name', 'order_ref', 'certificate_ref', 'programme'],
    description: 'Certificate ready for PDF download in Participant Portal',
  },
};

export function validateWhatsAppTemplate(
  templateId?: string,
  variables?: Record<string, string>,
): { valid: true; spec?: WhatsAppTemplateSpec } | { valid: false; error: string } {
  if (!templateId) {
    return { valid: true };
  }
  const spec = WHATSAPP_TEMPLATE_REGISTRY[templateId];
  if (!spec) {
    return {
      valid: false,
      error: `Unapproved WhatsApp template identifier "${templateId}". Only registered Meta utility templates are allowed.`,
    };
  }
  if (variables) {
    const missing = spec.requiredVariables.filter(key => !variables[key] || !String(variables[key]).trim());
    if (missing.length > 0) {
      return {
        valid: false,
        error: `WhatsApp template "${spec.metaTemplateName}" is missing required variable(s): ${missing.join(', ')}`,
      };
    }
  }
  return { valid: true, spec };
}

export interface NotificationPayload {
  recipient: {
    email?: string;
    phone?: string;
    name: string;
    optedOut?: boolean;
  };
  eventType?: NotificationEventType;
  templateId?: string;
  subject?: string;
  body: string;
  variables?: Record<string, string>;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  orderRef?: string;
}

export interface NotificationResult {
  success: boolean;
  channelUsed?: 'whatsapp' | 'email' | 'sms';
  fallbackUsed?: boolean;
  providerRef?: string;
  deliveryState?: NotificationDeliveryState;
  providerMode?: NotificationProviderMode;
  isSimulated?: boolean;
  recipientPhoneE164?: string;
  retryCount?: number;
  idempotentReplay?: boolean;
  error?: string;
  errorCode?: string;
}

export interface NotificationProvider {
  name: string;
  isSimulated?: boolean;
  send(payload: NotificationPayload): Promise<NotificationResult>;
}

export interface NotificationLogEntry {
  id: string;
  idempotencyKey?: string;
  eventType?: NotificationEventType;
  orderRef?: string;
  recipientName: string;
  recipientPhoneE164?: string;
  recipientEmail?: string;
  primaryChannel: 'whatsapp' | 'email' | 'sms';
  channelUsed: 'whatsapp' | 'email' | 'sms';
  templateId?: string;
  subject?: string;
  body: string;
  deliveryState: NotificationDeliveryState;
  isSimulated: boolean;
  fallbackUsed: boolean;
  providerRef?: string;
  error?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
}

export interface IntegrationDiagnostics {
  whatsappConnectionStatus: WhatsAppConnectionStatus;
  whatsappStatusLabel: string;
  providerType: string;
  officialPhoneNumber: string;
  maskedPhoneNumber: string;
  businessAccountStatus: string;
  templateReadiness: string;
  approvedTemplateCount: number;
  webhookHealth: string;
  emailProviderStatus: string;
  queueSummary: {
    totalLogged: number;
    queuedOrSubmitted: number;
    acceptedOrSent: number;
    deliveredOrRead: number;
    fallbackCompleted: number;
    simulatedCount: number;
    failedCount: number;
  };
  lastSuccessfulMessage: NotificationLogEntry | null;
  lastFailedMessage: NotificationLogEntry | null;
}

// ── Development / Sandbox Providers (Explicitly Tagged as Simulated) ─────────
class SimulatedEmailProvider implements NotificationProvider {
  name = 'simulated-email-sandbox';
  isSimulated = true;

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    return {
      success: true,
      channelUsed: 'email',
      providerRef: `sim-email-${Date.now()}`,
      deliveryState: 'simulated',
      providerMode: 'simulated_sandbox',
      isSimulated: true,
    };
  }
}

class SimulatedWhatsAppProvider implements NotificationProvider {
  name = 'simulated-whatsapp-sandbox';
  isSimulated = true;

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    const phoneCheck = normaliseWhatsAppPhoneE164(payload.recipient.phone);
    if (!phoneCheck.valid) {
      return {
        success: false,
        channelUsed: 'whatsapp',
        deliveryState: 'failed',
        providerMode: 'simulated_sandbox',
        isSimulated: true,
        error: phoneCheck.error,
        errorCode: 'INVALID_RECIPIENT_PHONE',
      };
    }
    return {
      success: true,
      channelUsed: 'whatsapp',
      providerRef: `sim-wa-${Date.now()}`,
      deliveryState: 'simulated',
      providerMode: 'simulated_sandbox',
      isSimulated: true,
      recipientPhoneE164: phoneCheck.e164,
    };
  }
}

class SimulatedSmsProvider implements NotificationProvider {
  name = 'simulated-sms-sandbox';
  isSimulated = true;

  async send(_payload: NotificationPayload): Promise<NotificationResult> {
    return {
      success: true,
      channelUsed: 'sms',
      providerRef: `sim-sms-${Date.now()}`,
      deliveryState: 'simulated',
      providerMode: 'simulated_sandbox',
      isSimulated: true,
    };
  }
}

// ── Production Supabase Edge Function Providers (Server-Side Meta Cloud API) ──
class EdgeFunctionWhatsAppProvider implements NotificationProvider {
  name = 'supabase-edge-whatsapp-cloud-api';
  isSimulated = false;

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    if (!isSupabaseConfigured) {
      return {
        success: false,
        channelUsed: 'whatsapp',
        deliveryState: 'failed',
        providerMode: 'live_edge_function',
        isSimulated: false,
        error: 'Supabase is not configured for Edge Function WhatsApp invocation.',
        errorCode: 'SUPABASE_NOT_CONFIGURED',
      };
    }

    const phoneCheck = normaliseWhatsAppPhoneE164(payload.recipient.phone);
    if (!phoneCheck.valid) {
      return {
        success: false,
        channelUsed: 'whatsapp',
        deliveryState: 'failed',
        providerMode: 'live_edge_function',
        isSimulated: false,
        error: phoneCheck.error,
        errorCode: 'INVALID_RECIPIENT_PHONE',
      };
    }

    const { data, error } = await supabase.functions.invoke('whatsapp-send', {
      body: {
        channel: 'whatsapp',
        recipient: {
          name: payload.recipient.name,
          phoneE164: phoneCheck.e164,
          email: payload.recipient.email,
        },
        eventType: payload.eventType,
        templateId: payload.templateId,
        variables: payload.variables,
        subject: payload.subject,
        body: payload.body,
        orderRef: payload.orderRef,
        idempotencyKey: payload.idempotencyKey,
        metadata: payload.metadata,
      },
    });

    if (error) {
      return {
        success: false,
        channelUsed: 'whatsapp',
        deliveryState: 'failed',
        providerMode: 'live_edge_function',
        isSimulated: false,
        recipientPhoneE164: phoneCheck.e164,
        error: error.message || 'Edge Function whatsapp-send invocation failed',
        errorCode: 'EDGE_FUNCTION_ERROR',
      };
    }

    const res = (data ?? {}) as Partial<NotificationResult>;
    return {
      success: Boolean(res.success),
      channelUsed: res.channelUsed ?? 'whatsapp',
      fallbackUsed: Boolean(res.fallbackUsed),
      providerRef: res.providerRef,
      // IMPORTANT: HTTP 200 from Meta Cloud API means 'accepted_by_provider', NOT 'delivered'.
      // Final 'delivered'/'read' states are set only by verified Meta webhook callbacks.
      deliveryState: res.deliveryState ?? (res.success ? 'accepted_by_provider' : 'failed'),
      providerMode: 'live_edge_function',
      isSimulated: false,
      recipientPhoneE164: phoneCheck.e164,
      error: res.error,
      errorCode: res.errorCode,
    };
  }
}

class EdgeFunctionEmailProvider implements NotificationProvider {
  name = 'supabase-edge-email';
  isSimulated = false;

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    if (!isSupabaseConfigured) {
      return {
        success: false,
        channelUsed: 'email',
        deliveryState: 'failed',
        providerMode: 'live_edge_function',
        isSimulated: false,
        error: 'Supabase is not configured for Edge Function email invocation.',
        errorCode: 'SUPABASE_NOT_CONFIGURED',
      };
    }

    const { data, error } = await supabase.functions.invoke('whatsapp-send', {
      body: {
        channel: 'email',
        recipient: {
          name: payload.recipient.name,
          email: payload.recipient.email,
        },
        eventType: payload.eventType,
        templateId: payload.templateId,
        subject: payload.subject,
        body: payload.body,
        orderRef: payload.orderRef,
        idempotencyKey: payload.idempotencyKey,
        metadata: payload.metadata,
      },
    });

    if (error) {
      return {
        success: false,
        channelUsed: 'email',
        deliveryState: 'failed',
        providerMode: 'live_edge_function',
        isSimulated: false,
        error: error.message || 'Edge Function email invocation failed',
        errorCode: 'EDGE_FUNCTION_ERROR',
      };
    }

    const res = (data ?? {}) as Partial<NotificationResult>;
    return {
      success: Boolean(res.success),
      channelUsed: 'email',
      providerRef: res.providerRef,
      deliveryState: res.deliveryState ?? (res.success ? 'accepted_by_provider' : 'failed'),
      providerMode: 'live_edge_function',
      isSimulated: false,
      error: res.error,
      errorCode: res.errorCode,
    };
  }
}

// ── Webhook HMAC-SHA256 Signature Verification Helper ────────────────────────
export async function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  appSecret: string | null | undefined,
): Promise<boolean> {
  if (!signatureHeader || !appSecret) return false;
  const trimmed = signatureHeader.trim();
  if (!trimmed.startsWith('sha256=')) return false;
  const expectedHex = trimmed.slice('sha256='.length).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expectedHex)) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(appSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    const computedHex = Array.from(new Uint8Array(sigBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    // Constant-time comparison
    if (computedHex.length !== expectedHex.length) return false;
    let diff = 0;
    for (let i = 0; i < computedHex.length; i++) {
      diff |= computedHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

// ── Notification Service ──────────────────────────────────────
class NotificationService {
  private emailProvider: NotificationProvider;
  private whatsappProvider: NotificationProvider;
  private smsProvider: NotificationProvider;

  private logs: NotificationLogEntry[] = [];
  private idempotencyMap = new Map<string, NotificationResult>();
  private recentSendTimestamps: number[] = [];
  private maxMessagesPerMinute = 60;
  private maxRetries = 2;

  readonly officialWhatsAppSender: string;
  readonly portalBaseUrl: string;
  readonly liveNotificationsEnabled: boolean;

  constructor() {
    this.officialWhatsAppSender =
      (import.meta.env.VITE_WHATSAPP_BUSINESS_NUMBER as string | undefined) ||
      OFFICIAL_WHATSAPP_NUMBER;
    this.portalBaseUrl =
      (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '') ||
      (typeof window !== 'undefined' ? window.location.origin : 'https://www.aigsuite.com');
    this.liveNotificationsEnabled =
      String(import.meta.env.VITE_ENABLE_LIVE_NOTIFICATIONS ?? '').toLowerCase() === 'true' &&
      isSupabaseConfigured;

    if (this.liveNotificationsEnabled) {
      this.emailProvider = new EdgeFunctionEmailProvider();
      this.whatsappProvider = new EdgeFunctionWhatsAppProvider();
    } else {
      this.emailProvider = new SimulatedEmailProvider();
      this.whatsappProvider = new SimulatedWhatsAppProvider();
    }
    this.smsProvider = new SimulatedSmsProvider();
  }

  /** Replace providers in tests or server adapters if needed. */
  setProviders(overrides: {
    email?: NotificationProvider;
    whatsapp?: NotificationProvider;
    sms?: NotificationProvider;
  }): void {
    if (overrides.email) this.emailProvider = overrides.email;
    if (overrides.whatsapp) this.whatsappProvider = overrides.whatsapp;
    if (overrides.sms) this.smsProvider = overrides.sms;
  }

  /** Restore default environment-configured providers (for test cleanup). */
  resetProviders(): void {
    if (this.liveNotificationsEnabled) {
      this.emailProvider = new EdgeFunctionEmailProvider();
      this.whatsappProvider = new EdgeFunctionWhatsAppProvider();
    } else {
      this.emailProvider = new SimulatedEmailProvider();
      this.whatsappProvider = new SimulatedWhatsAppProvider();
    }
    this.smsProvider = new SimulatedSmsProvider();
  }

  /** Configure rate limit and retry policy (useful for tests and runtime tuning). */
  setPolicy(options: { maxMessagesPerMinute?: number; maxRetries?: number }): void {
    if (typeof options.maxMessagesPerMinute === 'number' && options.maxMessagesPerMinute > 0) {
      this.maxMessagesPerMinute = options.maxMessagesPerMinute;
    }
    if (typeof options.maxRetries === 'number' && options.maxRetries >= 0) {
      this.maxRetries = options.maxRetries;
    }
  }

  /** Clear in-memory idempotency cache, rate limit window, and delivery logs (for test isolation). */
  resetState(): void {
    this.logs = [];
    this.idempotencyMap.clear();
    this.recentSendTimestamps = [];
  }

  getDeliveryLogs(): ReadonlyArray<NotificationLogEntry> {
    return this.logs;
  }

  getDiagnostics(): IntegrationDiagnostics {
    const isSimulated = Boolean(this.whatsappProvider.isSimulated);
    const whatsappConnectionStatus: WhatsAppConnectionStatus = this.liveNotificationsEnabled
      ? 'edge_function_configured'
      : isSimulated
        ? 'setup_required'
        : 'connected';

    const whatsappStatusLabel =
      whatsappConnectionStatus === 'connected'
        ? 'Connected (Meta Cloud API)'
        : whatsappConnectionStatus === 'edge_function_configured'
          ? 'Edge Function Configured (Awaiting Meta Webhook Verification)'
          : 'Setup Required — Sandbox Mode (Not Connected to Meta Cloud API)';

    const approvedCount = new Set(
      Object.values(WHATSAPP_TEMPLATE_REGISTRY).map(t => t.metaTemplateName),
    ).size;

    const digits = this.officialWhatsAppSender.replace(/\D+/g, '');
    const maskedPhoneNumber =
      digits.length >= 8
        ? `+${digits.slice(0, 2)} •••• ${digits.slice(-4)}`
        : OFFICIAL_WHATSAPP_DISPLAY;

    const successfulLogs = this.logs.filter(l =>
      ['accepted_by_provider', 'sent', 'delivered', 'read', 'fallback_completed', 'simulated'].includes(l.deliveryState),
    );
    const failedLogs = this.logs.filter(l => l.deliveryState === 'failed');

    return {
      whatsappConnectionStatus,
      whatsappStatusLabel,
      providerType: isSimulated
        ? 'Development Sandbox Adapter (No Live Meta Cloud API Calls)'
        : `Supabase Edge Function → Meta WhatsApp Cloud API (${this.whatsappProvider.name})`,
      officialPhoneNumber: OFFICIAL_WHATSAPP_DISPLAY,
      maskedPhoneNumber,
      businessAccountStatus: this.liveNotificationsEnabled
        ? 'Server-Side Secrets Configured'
        : 'Pending Client Meta WABA ID, Phone Number ID & Coexistence Confirmation',
      templateReadiness: `${approvedCount} Utility Templates Defined in Code (Pending Meta Business Suite Approval)`,
      approvedTemplateCount: approvedCount,
      webhookHealth: this.liveNotificationsEnabled
        ? 'Edge Function Endpoint Ready (/functions/v1/whatsapp-webhook)'
        : 'Not Connected (Awaiting Meta App Secret & Verify Token)',
      emailProviderStatus: this.emailProvider.isSimulated
        ? 'Development Sandbox (Invoice & Fallback Logged Locally)'
        : 'Configured via Server-Side Edge Function',
      queueSummary: {
        totalLogged: this.logs.length,
        queuedOrSubmitted: this.logs.filter(l => ['queued', 'submitted'].includes(l.deliveryState)).length,
        acceptedOrSent: this.logs.filter(l => ['accepted_by_provider', 'sent'].includes(l.deliveryState)).length,
        deliveredOrRead: this.logs.filter(l => ['delivered', 'read'].includes(l.deliveryState)).length,
        fallbackCompleted: this.logs.filter(l => l.deliveryState === 'fallback_completed').length,
        simulatedCount: this.logs.filter(l => l.isSimulated).length,
        failedCount: failedLogs.length,
      },
      lastSuccessfulMessage: successfulLogs[0] ?? null,
      lastFailedMessage: failedLogs[0] ?? null,
    };
  }

  private checkRateLimit(): { allowed: true } | { allowed: false; error: string } {
    const now = Date.now();
    this.recentSendTimestamps = this.recentSendTimestamps.filter(ts => now - ts < 60_000);
    if (this.recentSendTimestamps.length >= this.maxMessagesPerMinute) {
      return {
        allowed: false,
        error: `Rate limit exceeded (${this.maxMessagesPerMinute} messages/minute). Message queued for retry.`,
      };
    }
    this.recentSendTimestamps.push(now);
    return { allowed: true };
  }

  private recordLog(entry: Omit<NotificationLogEntry, 'id' | 'createdAt' | 'updatedAt'>): NotificationLogEntry {
    const now = new Date().toISOString();
    const full: NotificationLogEntry = {
      ...entry,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    this.logs = [full, ...this.logs].slice(0, 200);
    return full;
  }

  private isPermanentError(error?: string, errorCode?: string): boolean {
    if (!error && !errorCode) return false;
    const code = (errorCode ?? '').toUpperCase();
    if (
      [
        'INVALID_RECIPIENT_PHONE',
        'INVALID_TEMPLATE',
        'RECIPIENT_OPTED_OUT',
        'UNREGISTERED_NUMBER',
        'INVALID_CREDENTIALS',
        'MISSING_CREDENTIALS',
      ].includes(code)
    ) {
      return true;
    }
    const msg = (error ?? '').toLowerCase();
    return (
      msg.includes('unapproved whatsapp template') ||
      msg.includes('missing required variable') ||
      msg.includes('not a valid international e.164') ||
      msg.includes('opted out') ||
      msg.includes('invalid credentials') ||
      msg.includes('missing credentials') ||
      msg.includes('unregistered') ||
      msg.includes('not connected')
    );
  }

  async sendEmail(payload: NotificationPayload): Promise<NotificationResult> {
    if (payload.recipient.optedOut) {
      return {
        success: false,
        channelUsed: 'email',
        deliveryState: 'failed',
        error: 'Recipient has opted out of notifications',
        errorCode: 'RECIPIENT_OPTED_OUT',
      };
    }
    if (!payload.recipient.email?.trim()) {
      return {
        success: false,
        channelUsed: 'email',
        deliveryState: 'failed',
        error: 'No email address provided',
        errorCode: 'INVALID_RECIPIENT_EMAIL',
      };
    }

    if (payload.idempotencyKey) {
      const existing = this.idempotencyMap.get(`email:${payload.idempotencyKey}`);
      if (existing) {
        return { ...existing, idempotentReplay: true };
      }
    }

    const rate = this.checkRateLimit();
    if (!rate.allowed) {
      return {
        success: false,
        channelUsed: 'email',
        deliveryState: 'queued',
        error: rate.error,
        errorCode: 'RATE_LIMITED',
      };
    }

    let attempt = 0;
    let lastRes: NotificationResult = {
      success: false,
      channelUsed: 'email',
      deliveryState: 'failed',
      error: 'Email send failed',
    };

    while (attempt <= this.maxRetries) {
      try {
        const res = await this.emailProvider.send(payload);
        const isSimulated = Boolean(res.isSimulated ?? this.emailProvider.isSimulated);
        const deliveryState: NotificationDeliveryState = res.deliveryState
          ? res.deliveryState
          : res.success
            ? isSimulated
              ? 'simulated'
              : 'accepted_by_provider'
            : 'failed';

        lastRes = {
          ...res,
          channelUsed: 'email',
          isSimulated,
          deliveryState,
          providerMode: res.providerMode ?? (isSimulated ? 'simulated_sandbox' : 'custom_adapter'),
          retryCount: attempt,
        };

        if (lastRes.success || this.isPermanentError(lastRes.error, lastRes.errorCode)) {
          break;
        }
      } catch (e) {
        lastRes = {
          success: false,
          channelUsed: 'email',
          deliveryState: 'failed',
          error: e instanceof Error ? e.message : 'Email send failed',
          retryCount: attempt,
        };
        if (this.isPermanentError(lastRes.error, lastRes.errorCode)) break;
      }
      attempt++;
    }

    this.recordLog({
      idempotencyKey: payload.idempotencyKey,
      eventType: payload.eventType,
      orderRef: payload.orderRef,
      recipientName: payload.recipient.name,
      recipientEmail: payload.recipient.email.trim(),
      primaryChannel: 'email',
      channelUsed: 'email',
      templateId: payload.templateId,
      subject: payload.subject,
      body: payload.body,
      deliveryState: lastRes.deliveryState ?? (lastRes.success ? 'accepted_by_provider' : 'failed'),
      isSimulated: Boolean(lastRes.isSimulated),
      fallbackUsed: Boolean(lastRes.fallbackUsed),
      providerRef: lastRes.providerRef,
      error: lastRes.error,
      retryCount: lastRes.retryCount ?? 0,
    });

    if (payload.idempotencyKey && lastRes.success) {
      this.idempotencyMap.set(`email:${payload.idempotencyKey}`, lastRes);
    }

    return lastRes;
  }

  async sendWhatsApp(payload: NotificationPayload): Promise<NotificationResult> {
    if (payload.recipient.optedOut) {
      return {
        success: false,
        channelUsed: 'whatsapp',
        deliveryState: 'failed',
        error: 'Recipient has opted out of WhatsApp notifications',
        errorCode: 'RECIPIENT_OPTED_OUT',
      };
    }
    if (!payload.recipient.phone?.trim()) {
      return {
        success: false,
        channelUsed: 'whatsapp',
        deliveryState: 'failed',
        error: 'No phone number provided for WhatsApp',
        errorCode: 'INVALID_RECIPIENT_PHONE',
      };
    }

    // Normalize and validate E.164 recipient phone
    const phoneCheck = normaliseWhatsAppPhoneE164(payload.recipient.phone);
    if (!phoneCheck.valid) {
      const failRes: NotificationResult = {
        success: false,
        channelUsed: 'whatsapp',
        deliveryState: 'failed',
        error: phoneCheck.error,
        errorCode: 'INVALID_RECIPIENT_PHONE',
      };
      this.recordLog({
        idempotencyKey: payload.idempotencyKey,
        eventType: payload.eventType,
        orderRef: payload.orderRef,
        recipientName: payload.recipient.name,
        recipientEmail: payload.recipient.email,
        primaryChannel: 'whatsapp',
        channelUsed: 'whatsapp',
        templateId: payload.templateId,
        subject: payload.subject,
        body: payload.body,
        deliveryState: 'failed',
        isSimulated: Boolean(this.whatsappProvider.isSimulated),
        fallbackUsed: false,
        error: phoneCheck.error,
        retryCount: 0,
      });
      return failRes;
    }

    // Validate approved template & required variables if provided
    const tplValidation = validateWhatsAppTemplate(payload.templateId, payload.variables);
    if (!tplValidation.valid) {
      const failRes: NotificationResult = {
        success: false,
        channelUsed: 'whatsapp',
        deliveryState: 'failed',
        recipientPhoneE164: phoneCheck.e164,
        error: tplValidation.error,
        errorCode: 'INVALID_TEMPLATE',
      };
      this.recordLog({
        idempotencyKey: payload.idempotencyKey,
        eventType: payload.eventType,
        orderRef: payload.orderRef,
        recipientName: payload.recipient.name,
        recipientPhoneE164: phoneCheck.e164,
        recipientEmail: payload.recipient.email,
        primaryChannel: 'whatsapp',
        channelUsed: 'whatsapp',
        templateId: payload.templateId,
        subject: payload.subject,
        body: payload.body,
        deliveryState: 'failed',
        isSimulated: Boolean(this.whatsappProvider.isSimulated),
        fallbackUsed: false,
        error: tplValidation.error,
        retryCount: 0,
      });
      return failRes;
    }

    if (payload.idempotencyKey) {
      const existing = this.idempotencyMap.get(`wa:${payload.idempotencyKey}`);
      if (existing) {
        return { ...existing, idempotentReplay: true };
      }
    }

    const rate = this.checkRateLimit();
    if (!rate.allowed) {
      return {
        success: false,
        channelUsed: 'whatsapp',
        deliveryState: 'queued',
        recipientPhoneE164: phoneCheck.e164,
        error: rate.error,
        errorCode: 'RATE_LIMITED',
      };
    }

    const normalizedPayload: NotificationPayload = {
      ...payload,
      recipient: {
        ...payload.recipient,
        phone: phoneCheck.e164,
      },
    };

    let attempt = 0;
    let lastRes: NotificationResult = {
      success: false,
      channelUsed: 'whatsapp',
      deliveryState: 'failed',
      recipientPhoneE164: phoneCheck.e164,
      error: 'WhatsApp send failed',
    };

    while (attempt <= this.maxRetries) {
      try {
        const res = await this.whatsappProvider.send(normalizedPayload);
        const isSimulated = Boolean(res.isSimulated ?? this.whatsappProvider.isSimulated);
        // Never equate provider HTTP 200 acceptance with 'delivered'
        const deliveryState: NotificationDeliveryState = res.deliveryState
          ? res.deliveryState
          : res.success
            ? isSimulated
              ? 'simulated'
              : 'accepted_by_provider'
            : 'failed';

        lastRes = {
          ...res,
          channelUsed: 'whatsapp',
          isSimulated,
          deliveryState,
          providerMode: res.providerMode ?? (isSimulated ? 'simulated_sandbox' : 'custom_adapter'),
          recipientPhoneE164: phoneCheck.e164,
          retryCount: attempt,
        };

        if (lastRes.success || this.isPermanentError(lastRes.error, lastRes.errorCode)) {
          break;
        }
      } catch (e) {
        lastRes = {
          success: false,
          channelUsed: 'whatsapp',
          deliveryState: 'failed',
          recipientPhoneE164: phoneCheck.e164,
          error: e instanceof Error ? e.message : 'WhatsApp send failed',
          retryCount: attempt,
        };
        if (this.isPermanentError(lastRes.error, lastRes.errorCode)) break;
      }
      attempt++;
    }

    this.recordLog({
      idempotencyKey: payload.idempotencyKey,
      eventType: payload.eventType,
      orderRef: payload.orderRef,
      recipientName: payload.recipient.name,
      recipientPhoneE164: phoneCheck.e164,
      recipientEmail: payload.recipient.email,
      primaryChannel: 'whatsapp',
      channelUsed: 'whatsapp',
      templateId: payload.templateId,
      subject: payload.subject,
      body: payload.body,
      deliveryState: lastRes.deliveryState ?? (lastRes.success ? 'accepted_by_provider' : 'failed'),
      isSimulated: Boolean(lastRes.isSimulated),
      fallbackUsed: false,
      providerRef: lastRes.providerRef,
      error: lastRes.error,
      retryCount: lastRes.retryCount ?? 0,
    });

    if (payload.idempotencyKey && lastRes.success) {
      this.idempotencyMap.set(`wa:${payload.idempotencyKey}`, lastRes);
    }

    return lastRes;
  }

  async sendSMS(payload: NotificationPayload): Promise<NotificationResult> {
    if (!payload.recipient.phone?.trim()) {
      return { success: false, error: 'No phone number provided' };
    }
    return this.smsProvider.send(payload);
  }

  /**
   * Primary Channel Rule:
   * Attempt WhatsApp (+6585456783) first.
   * If WhatsApp delivery fails (or phone is unavailable/invalid), automatically fall back to Email.
   */
  async sendWhatsAppWithEmailFallback(payload: NotificationPayload): Promise<NotificationResult> {
    if (payload.idempotencyKey) {
      const existing = this.idempotencyMap.get(`wafallback:${payload.idempotencyKey}`);
      if (existing) {
        return { ...existing, idempotentReplay: true };
      }
    }

    const waResult = await this.sendWhatsApp(payload);
    if (waResult.success) {
      const finalWa: NotificationResult = {
        ...waResult,
        channelUsed: 'whatsapp',
        fallbackUsed: false,
      };
      if (payload.idempotencyKey) {
        this.idempotencyMap.set(`wafallback:${payload.idempotencyKey}`, finalWa);
      }
      return finalWa;
    }

    if (payload.recipient.email?.trim() && !payload.recipient.optedOut) {
      const emailResult = await this.sendEmail({
        ...payload,
        idempotencyKey: payload.idempotencyKey ? `${payload.idempotencyKey}:fallback` : undefined,
        subject: payload.subject || 'Al Ihsan Group — Qurban Notification',
      });
      if (emailResult.success) {
        const fallbackRes: NotificationResult = {
          ...emailResult,
          channelUsed: 'email',
          fallbackUsed: true,
          deliveryState: emailResult.isSimulated ? 'simulated' : 'fallback_completed',
        };
        // Update most recent log to reflect fallback completion
        if (this.logs.length > 0 && this.logs[0].recipientEmail === payload.recipient.email.trim()) {
          this.logs[0].fallbackUsed = true;
          this.logs[0].primaryChannel = 'whatsapp';
          if (!this.logs[0].isSimulated) {
            this.logs[0].deliveryState = 'fallback_completed';
          }
        }
        if (payload.idempotencyKey) {
          this.idempotencyMap.set(`wafallback:${payload.idempotencyKey}`, fallbackRes);
        }
        return fallbackRes;
      }
      return {
        success: false,
        channelUsed: 'email',
        fallbackUsed: true,
        deliveryState: 'failed',
        error: `WhatsApp failed (${waResult.error ?? 'unknown'}); Email fallback failed (${emailResult.error ?? 'unknown'})`,
      };
    }

    return waResult;
  }

  /**
   * Process an incoming Meta Cloud API webhook status update ('sent' | 'delivered' | 'read' | 'failed').
   * If Meta asynchronously reports 'failed' on an accepted message, automatically initiates Email fallback.
   */
  async applyWebhookStatusUpdate(update: {
    providerRef: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    timestamp?: string;
    errorMessage?: string;
  }): Promise<{
    updated: boolean;
    deliveryState?: NotificationDeliveryState;
    fallbackTriggered?: boolean;
    fallbackResult?: NotificationResult;
  }> {
    const log = this.logs.find(l => l.providerRef === update.providerRef);
    if (!log) {
      return { updated: false };
    }

    const now = update.timestamp || new Date().toISOString();
    log.updatedAt = now;

    if (update.status === 'sent' || update.status === 'delivered' || update.status === 'read') {
      log.deliveryState = update.status;
      log.isSimulated = false;
      if (update.status === 'delivered' || update.status === 'read') {
        log.deliveredAt = log.deliveredAt ?? now;
      }
      return { updated: true, deliveryState: log.deliveryState, fallbackTriggered: false };
    }

    // Status === 'failed' asynchronously reported by Meta Cloud API webhook
    log.deliveryState = 'failed';
    log.error = update.errorMessage || 'Meta Cloud API asynchronous delivery failure';

    if (log.recipientEmail && !log.fallbackUsed) {
      log.deliveryState = 'fallback_initiated';
      const fallbackRes = await this.sendEmail({
        recipient: {
          name: log.recipientName,
          email: log.recipientEmail,
        },
        eventType: log.eventType,
        orderRef: log.orderRef,
        subject: log.subject || `Al Ihsan Group — Notification (${log.orderRef || 'Update'})`,
        body: log.body,
        idempotencyKey: log.idempotencyKey ? `${log.idempotencyKey}:webhook-fallback` : undefined,
      });
      if (fallbackRes.success) {
        log.deliveryState = 'fallback_completed';
        log.fallbackUsed = true;
      } else {
        log.deliveryState = 'failed';
      }
      return {
        updated: true,
        deliveryState: log.deliveryState,
        fallbackTriggered: true,
        fallbackResult: fallbackRes,
      };
    }

    return { updated: true, deliveryState: 'failed', fallbackTriggered: false };
  }

  /**
   * Confirmed Rule 1 — Order Confirmation & Invoice:
   * - Formal Order Confirmation & Invoice is sent ONCE to Email (`alreadySentEmail` / `idempotencyKey` guard).
   * - `confirmation_email_sent_at` must ONLY be stamped when `emailTrulySubmitted` is true (non-simulated provider acceptance),
   *   never merely because an order was created or a mock provider ran.
   */
  async notifyOrderCreatedAndInvoice(params: {
    recipient: { name: string; email?: string; phone?: string };
    orderRef: string;
    programme: string;
    serviceTypeLabel: string;
    quantity: number;
    totalFormatted: string;
    paymentMethodLabel: string;
    alreadySentEmail?: boolean;
  }): Promise<{
    emailSent: boolean;
    whatsappSent: boolean;
    emailTrulySubmitted: boolean;
    emailDeliveryState: NotificationDeliveryState;
    emailProviderRef?: string;
    idempotencyKey: string;
  }> {
    const portalOrdersUrl = `${this.portalBaseUrl}/portal/orders`;
    const invoiceIdempotencyKey = `invoice:${params.orderRef}`;
    let emailSent = false;
    let emailTrulySubmitted = false;
    let emailDeliveryState: NotificationDeliveryState = 'queued';
    let emailProviderRef: string | undefined;

    if (!params.alreadySentEmail && params.recipient.email?.trim()) {
      const emailRes = await this.sendEmail({
        recipient: params.recipient,
        eventType: 'order.confirmation',
        orderRef: params.orderRef,
        idempotencyKey: invoiceIdempotencyKey,
        templateId: 'order.confirmation_invoice_once',
        subject: `Al Ihsan Group — Order Confirmation & Invoice (${params.orderRef})`,
        body:
          `Assalamu Alaikum ${params.recipient.name},\n\n` +
          `Thank you for your ${params.serviceTypeLabel} registration with Al Ihsan Group.\n\n` +
          `ORDER CONFIRMATION & INVOICE\n` +
          `Order Reference: ${params.orderRef}\n` +
          `Programme: ${params.programme}\n` +
          `Quantity: ${params.quantity}\n` +
          `Payment Method: ${params.paymentMethodLabel}\n` +
          `Total Amount: ${params.totalFormatted}\n\n` +
          `Track your order anytime in your Participant Portal: ${portalOrdersUrl}\n` +
          `Subsequent updates will be sent via WhatsApp from ${this.officialWhatsAppSender}.`,
      });
      emailSent = emailRes.success;
      emailDeliveryState = emailRes.deliveryState ?? (emailRes.success ? 'accepted_by_provider' : 'failed');
      emailProviderRef = emailRes.providerRef;
      // Only mark as truly submitted when a non-simulated email provider accepted the submission
      emailTrulySubmitted = Boolean(emailRes.success && !emailRes.isSimulated);
    }

    const waRes = await this.sendWhatsApp({
      recipient: params.recipient,
      eventType: 'order.confirmation',
      orderRef: params.orderRef,
      idempotencyKey: `order-wa:${params.orderRef}`,
      templateId: 'order.created_whatsapp',
      variables: {
        participant_name: params.recipient.name,
        order_ref: params.orderRef,
        programme: params.programme,
        quantity: String(params.quantity),
        total_formatted: params.totalFormatted,
        portal_url: portalOrdersUrl,
      },
      subject: `Al Ihsan Group — Order ${params.orderRef} Received`,
      body:
        `Assalamu Alaikum ${params.recipient.name}, your ${params.serviceTypeLabel} order ${params.orderRef} (${params.programme}, Qty: ${params.quantity}, ${params.totalFormatted}) has been recorded. ` +
        `Your official Order Confirmation & Invoice has been sent to your email. Portal: ${portalOrdersUrl}`,
    });

    // If WhatsApp failed AND we hadn't already sent email, fallback to email
    if (!waRes.success && !emailSent && params.recipient.email?.trim()) {
      const fallback = await this.sendEmail({
        recipient: params.recipient,
        eventType: 'order.confirmation',
        orderRef: params.orderRef,
        idempotencyKey: invoiceIdempotencyKey,
        templateId: 'order.created_fallback',
        subject: `Al Ihsan Group — Order ${params.orderRef} Confirmation`,
        body: `Assalamu Alaikum ${params.recipient.name}, your order ${params.orderRef} (${params.programme}) has been recorded. Portal: ${portalOrdersUrl}`,
      });
      emailSent = fallback.success;
      emailDeliveryState = fallback.deliveryState ?? (fallback.success ? 'fallback_completed' : 'failed');
      emailProviderRef = fallback.providerRef;
      emailTrulySubmitted = Boolean(fallback.success && !fallback.isSimulated);
    }

    return {
      emailSent,
      whatsappSent: waRes.success,
      emailTrulySubmitted,
      emailDeliveryState,
      emailProviderRef,
      idempotencyKey: invoiceIdempotencyKey,
    };
  }

  /**
   * Confirmed Rule 2 — Payment Updates (Submitted / Verified / Rejected) — WhatsApp primary, Email fallback.
   */
  async notifyPaymentUpdate(params: {
    recipient: { name: string; email?: string; phone?: string };
    orderRef: string;
    paymentRef: string;
    status: 'verified' | 'rejected' | 'submitted';
    amountFormatted: string;
    reason?: string;
  }): Promise<NotificationResult> {
    const portalOrdersUrl = `${this.portalBaseUrl}/portal/orders`;
    const eventType: NotificationEventType =
      params.status === 'verified'
        ? 'payment.verified'
        : params.status === 'rejected'
          ? 'payment.rejected'
          : 'payment.submitted';

    const statusText =
      params.status === 'verified'
        ? `Alhamdulillah! Your payment (${params.amountFormatted}) for Order ${params.orderRef} has been verified.`
        : params.status === 'rejected'
          ? `Your payment submission (${params.paymentRef}) for Order ${params.orderRef} requires attention${params.reason ? `: ${params.reason}` : ''}.`
          : `We received your payment submission (${params.paymentRef}) for Order ${params.orderRef}.`;

    return this.sendWhatsAppWithEmailFallback({
      recipient: params.recipient,
      eventType,
      orderRef: params.orderRef,
      idempotencyKey: `payment:${params.paymentRef}:${params.status}`,
      templateId: `payment.${params.status}`,
      variables: {
        participant_name: params.recipient.name,
        order_ref: params.orderRef,
        payment_ref: params.paymentRef,
        amount_formatted: params.amountFormatted,
        reason: params.reason || 'Verification required',
        portal_url: portalOrdersUrl,
      },
      subject: `Al Ihsan Group — Payment Update (${params.orderRef})`,
      body: `Assalamu Alaikum ${params.recipient.name}, ${statusText} View details: ${portalOrdersUrl}`,
    });
  }

  /**
   * Confirmed Rule 3 — Qurban & Delivery Lifecycle Status Updates (WhatsApp primary, Email fallback).
   * Maps specific milestones (Animal Allocated, Qurban Completed, Delivery Scheduled, Out for Delivery, Delivered)
   * to their dedicated approved utility templates.
   */
  async notifyQurbanStatusUpdate(params: {
    recipient: { name: string; email?: string; phone?: string };
    orderRef: string;
    programme: string;
    statusLabel: string;
    animalCode?: string;
    scheduledDate?: string;
  }): Promise<NotificationResult> {
    const portalOrdersUrl = `${this.portalBaseUrl}/portal/orders`;
    const lower = params.statusLabel.toLowerCase();

    let eventType: NotificationEventType = 'qurban.completed';
    if (lower.includes('allocat')) eventType = 'animal.allocated';
    else if (lower.includes('schedule')) eventType = 'delivery.scheduled';
    else if (lower.includes('out for delivery')) eventType = 'delivery.out_for_delivery';
    else if (lower.includes('delivered')) eventType = 'delivery.completed';

    return this.sendWhatsAppWithEmailFallback({
      recipient: params.recipient,
      eventType,
      orderRef: params.orderRef,
      idempotencyKey: `status:${params.orderRef}:${lower.replace(/\s+/g, '_')}`,
      templateId: 'qurban.status_update',
      variables: {
        participant_name: params.recipient.name,
        order_ref: params.orderRef,
        programme: params.programme,
        status_label: params.statusLabel,
        animal_code: params.animalCode || 'Assigned',
        scheduled_date: params.scheduledDate || 'Scheduled',
        portal_url: portalOrdersUrl,
      },
      subject: `Al Ihsan Group — Order ${params.orderRef}: ${params.statusLabel}`,
      body:
        `Assalamu Alaikum ${params.recipient.name}, update for Order ${params.orderRef} (${params.programme}): ` +
        `status is now "${params.statusLabel}". Track in your portal: ${portalOrdersUrl}`,
    });
  }

  /**
   * Indonesia Breeding Programme — Weight Update Notification (WhatsApp primary, Email fallback).
   */
  async notifyBreedingWeightUpdate(params: {
    recipient: { name: string; email?: string; phone?: string };
    orderRef: string;
    animalCode: string;
    qurbanHolder: string;
    weightKg: number;
  }): Promise<NotificationResult> {
    const portalOrdersUrl = `${this.portalBaseUrl}/portal/orders`;
    return this.sendWhatsAppWithEmailFallback({
      recipient: params.recipient,
      eventType: 'breeding.weight_update',
      orderRef: params.orderRef,
      idempotencyKey: `weight:${params.animalCode}:${params.weightKg}`,
      templateId: 'breeding.weight_update',
      variables: {
        participant_name: params.recipient.name,
        order_ref: params.orderRef,
        animal_code: params.animalCode,
        qurban_holder: params.qurbanHolder,
        weight_kg: String(params.weightKg),
        portal_url: portalOrdersUrl,
      },
      subject: `Al Ihsan Group — Breeding Weight Update (${params.animalCode})`,
      body:
        `Assalamu Alaikum ${params.recipient.name}, weight update for your Indonesia Breeding Programme animal ` +
        `${params.animalCode} (${params.qurbanHolder}, Order ${params.orderRef}): current weight is now ${params.weightKg} kg. ` +
        `View weight timeline in your portal: ${portalOrdersUrl}`,
    });
  }

  /**
   * Confirmed Rule 4 — Certificate-Ready Notification:
   * Sent via WhatsApp (with Email fallback if WhatsApp fails), directing the
   * participant to download their PDF certificate directly from the Participant Portal.
   */
  async notifyCertificateReady(params: {
    recipient: { name: string; email?: string; phone?: string };
    orderRef: string;
    certificateRef: string;
    programme: string;
  }): Promise<NotificationResult> {
    const portalCertUrl = `${this.portalBaseUrl}/portal/certificates`;
    return this.sendWhatsAppWithEmailFallback({
      recipient: params.recipient,
      eventType: 'certificate.ready',
      orderRef: params.orderRef,
      idempotencyKey: `cert-ready:${params.certificateRef}`,
      templateId: 'certificate.ready_portal_download',
      variables: {
        participant_name: params.recipient.name,
        order_ref: params.orderRef,
        certificate_ref: params.certificateRef,
        programme: params.programme,
        portal_url: portalCertUrl,
      },
      subject: `Al Ihsan Group — Qurban Certificate Ready (${params.orderRef})`,
      body:
        `Assalamu Alaikum ${params.recipient.name}, Alhamdulillah! Your Qurban Certificate (${params.certificateRef}) ` +
        `for Order ${params.orderRef} (${params.programme}) is now ready. ` +
        `Please log in to your Participant Portal to view and download your PDF certificate: ${portalCertUrl}`,
    });
  }

  /**
   * Controlled admin diagnostic test notification (used from Settings -> Integrations).
   */
  async sendAdminTestNotification(params: {
    recipientName: string;
    recipientPhone: string;
    recipientEmail?: string;
  }): Promise<NotificationResult> {
    return this.sendWhatsAppWithEmailFallback({
      recipient: {
        name: params.recipientName,
        phone: params.recipientPhone,
        email: params.recipientEmail,
      },
      eventType: 'order.confirmation',
      orderRef: 'ORD-TEST-DIAG',
      templateId: 'order.created_whatsapp',
      variables: {
        participant_name: params.recipientName,
        order_ref: 'ORD-TEST-DIAG',
        programme: 'Diagnostic Connectivity Check',
        quantity: '1',
        total_formatted: 'SGD 0',
        portal_url: `${this.portalBaseUrl}/portal`,
      },
      subject: 'Al Ihsan Group — AIGMS Diagnostic Test Notification',
      body: `Assalamu Alaikum ${params.recipientName}, this is a controlled diagnostic test from AIGMS (${OFFICIAL_WHATSAPP_DISPLAY}).`,
    });
  }

  interpolate(template: string, variables: Record<string, string>): string {
    return Object.entries(variables).reduce(
      (str, [key, val]) => str.replaceAll(`{{${key}}}`, val),
      template,
    );
  }
}

export const notificationService = new NotificationService();
