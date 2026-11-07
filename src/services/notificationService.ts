// ============================================================
// Notification Service — WhatsApp Primary (+6585456783) with
// Automatic Email Fallback & One-Time Order Invoice Email Rule
// ============================================================

import { OFFICIAL_WHATSAPP_NUMBER } from '@/lib/orderRules';

export interface NotificationPayload {
  recipient: {
    email?: string;
    phone?: string;
    name: string;
  };
  templateId?: string;
  subject?: string;
  body: string;
  variables?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface NotificationResult {
  success: boolean;
  channelUsed?: 'whatsapp' | 'email' | 'sms';
  fallbackUsed?: boolean;
  providerRef?: string;
  error?: string;
}

export interface NotificationProvider {
  name: string;
  send(payload: NotificationPayload): Promise<NotificationResult>;
}

// ── Providers ────────────────────────────────────────────────
class MockEmailProvider implements NotificationProvider {
  name = 'mock-email';

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    console.log('[MockEmail] Sending email:', {
      to: payload.recipient.email,
      subject: payload.subject,
      body: payload.body.slice(0, 100) + '...',
    });
    return { success: true, channelUsed: 'email', providerRef: `mock-email-${Date.now()}` };
  }
}

class MockWhatsAppProvider implements NotificationProvider {
  name = 'mock-whatsapp';

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    const sender =
      (import.meta.env.VITE_WHATSAPP_BUSINESS_NUMBER as string | undefined) ||
      OFFICIAL_WHATSAPP_NUMBER;
    console.log('[MockWhatsApp] Sending message:', {
      from: sender,
      to: payload.recipient.phone,
      templateId: payload.templateId,
      body: payload.body.slice(0, 100) + '...',
    });
    return { success: true, channelUsed: 'whatsapp', providerRef: `mock-wa-${Date.now()}` };
  }
}

class MockSmsProvider implements NotificationProvider {
  name = 'mock-sms';

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    console.log('[MockSMS] Sending SMS:', {
      to: payload.recipient.phone,
      body: payload.body.slice(0, 100) + '...',
    });
    return { success: true, channelUsed: 'sms', providerRef: `mock-sms-${Date.now()}` };
  }
}

// ── Notification Service ──────────────────────────────────────
class NotificationService {
  private emailProvider: NotificationProvider;
  private whatsappProvider: NotificationProvider;
  private smsProvider: NotificationProvider;

  readonly officialWhatsAppSender: string;
  readonly portalBaseUrl: string;

  constructor() {
    this.officialWhatsAppSender =
      (import.meta.env.VITE_WHATSAPP_BUSINESS_NUMBER as string | undefined) ||
      OFFICIAL_WHATSAPP_NUMBER;
    this.portalBaseUrl =
      (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '') ||
      (typeof window !== 'undefined' ? window.location.origin : 'https://alihsangroupsg.com');

    // Server-side Edge Functions handle real Meta WhatsApp Cloud API / SMTP secrets in production
    this.emailProvider = new MockEmailProvider();
    this.whatsappProvider = new MockWhatsAppProvider();
    this.smsProvider = new MockSmsProvider();
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

  async sendEmail(payload: NotificationPayload): Promise<NotificationResult> {
    if (!payload.recipient.email?.trim()) {
      return { success: false, error: 'No email address provided' };
    }
    try {
      const res = await this.emailProvider.send(payload);
      return { ...res, channelUsed: 'email' };
    } catch (e) {
      return {
        success: false,
        channelUsed: 'email',
        error: e instanceof Error ? e.message : 'Email send failed',
      };
    }
  }

  async sendWhatsApp(payload: NotificationPayload): Promise<NotificationResult> {
    if (!payload.recipient.phone?.trim()) {
      return { success: false, error: 'No phone number provided for WhatsApp' };
    }
    try {
      const res = await this.whatsappProvider.send(payload);
      return { ...res, channelUsed: 'whatsapp' };
    } catch (e) {
      return {
        success: false,
        channelUsed: 'whatsapp',
        error: e instanceof Error ? e.message : 'WhatsApp send failed',
      };
    }
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
   * If WhatsApp delivery fails (or phone is unavailable), automatically fall back to Email.
   */
  async sendWhatsAppWithEmailFallback(payload: NotificationPayload): Promise<NotificationResult> {
    const waResult = await this.sendWhatsApp(payload);
    if (waResult.success) {
      return { ...waResult, channelUsed: 'whatsapp', fallbackUsed: false };
    }

    if (payload.recipient.email?.trim()) {
      const emailResult = await this.sendEmail({
        ...payload,
        subject: payload.subject || 'Al Ihsan Group — Qurban Notification',
      });
      if (emailResult.success) {
        return { ...emailResult, channelUsed: 'email', fallbackUsed: true };
      }
      return {
        success: false,
        channelUsed: 'email',
        fallbackUsed: true,
        error: `WhatsApp failed (${waResult.error ?? 'unknown'}); Email fallback failed (${emailResult.error ?? 'unknown'})`,
      };
    }

    return waResult;
  }

  /**
   * Confirmed Rule 1 — Order Confirmation & Invoice:
   * - Formal Order Confirmation & Invoice is sent ONCE to Email (`alreadySentEmail` guard).
   * - Order & payment summary notification is also sent via WhatsApp.
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
  }): Promise<{ emailSent: boolean; whatsappSent: boolean }> {
    const portalOrdersUrl = `${this.portalBaseUrl}/portal/orders`;
    let emailSent = false;

    if (!params.alreadySentEmail && params.recipient.email?.trim()) {
      const emailRes = await this.sendEmail({
        recipient: params.recipient,
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
    }

    const waRes = await this.sendWhatsApp({
      recipient: params.recipient,
      templateId: 'order.created_whatsapp',
      subject: `Al Ihsan Group — Order ${params.orderRef} Received`,
      body:
        `Assalamu Alaikum ${params.recipient.name}, your ${params.serviceTypeLabel} order ${params.orderRef} (${params.programme}, Qty: ${params.quantity}, ${params.totalFormatted}) has been recorded. ` +
        `Your official Order Confirmation & Invoice has been sent to your email. Portal: ${portalOrdersUrl}`,
    });

    // If WhatsApp failed AND we hadn't already sent email (e.g. edge case), fallback to email
    if (!waRes.success && !emailSent && params.recipient.email?.trim()) {
      const fallback = await this.sendEmail({
        recipient: params.recipient,
        templateId: 'order.created_fallback',
        subject: `Al Ihsan Group — Order ${params.orderRef} Confirmation`,
        body: `Assalamu Alaikum ${params.recipient.name}, your order ${params.orderRef} (${params.programme}) has been recorded. Portal: ${portalOrdersUrl}`,
      });
      emailSent = fallback.success;
    }

    return { emailSent, whatsappSent: waRes.success };
  }

  /**
   * Confirmed Rule 2 — Payment Updates (WhatsApp primary, Email fallback).
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
    const statusText =
      params.status === 'verified'
        ? `Alhamdulillah! Your payment (${params.amountFormatted}) for Order ${params.orderRef} has been verified.`
        : params.status === 'rejected'
          ? `Your payment submission (${params.paymentRef}) for Order ${params.orderRef} requires attention${params.reason ? `: ${params.reason}` : ''}.`
          : `We received your payment submission (${params.paymentRef}) for Order ${params.orderRef}.`;

    return this.sendWhatsAppWithEmailFallback({
      recipient: params.recipient,
      templateId: `payment.${params.status}`,
      subject: `Al Ihsan Group — Payment Update (${params.orderRef})`,
      body: `Assalamu Alaikum ${params.recipient.name}, ${statusText} View details: ${portalOrdersUrl}`,
    });
  }

  /**
   * Confirmed Rule 3 — Qurban Status Updates (WhatsApp primary, Email fallback).
   */
  async notifyQurbanStatusUpdate(params: {
    recipient: { name: string; email?: string; phone?: string };
    orderRef: string;
    programme: string;
    statusLabel: string;
  }): Promise<NotificationResult> {
    const portalOrdersUrl = `${this.portalBaseUrl}/portal/orders`;
    return this.sendWhatsAppWithEmailFallback({
      recipient: params.recipient,
      templateId: 'qurban.status_update',
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
      templateId: 'breeding.weight_update',
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
      templateId: 'certificate.ready_portal_download',
      subject: `Al Ihsan Group — Qurban Certificate Ready (${params.orderRef})`,
      body:
        `Assalamu Alaikum ${params.recipient.name}, Alhamdulillah! Your Qurban Certificate (${params.certificateRef}) ` +
        `for Order ${params.orderRef} (${params.programme}) is now ready. ` +
        `Please log in to your Participant Portal to view and download your PDF certificate: ${portalCertUrl}`,
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
