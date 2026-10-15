// ============================================================
// Notification Service — abstracted provider architecture
// ============================================================

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
  providerRef?: string;
  error?: string;
}

export interface NotificationProvider {
  name: string;
  send(payload: NotificationPayload): Promise<NotificationResult>;
}

// ── Mock Provider (development fallback) ─────────────────────
class MockEmailProvider implements NotificationProvider {
  name = 'mock-email';

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    console.log('[MockEmail] Sending email:', {
      to: payload.recipient.email,
      subject: payload.subject,
      body: payload.body.slice(0, 100) + '...',
    });
    return { success: true, providerRef: `mock-${Date.now()}` };
  }
}

class MockWhatsAppProvider implements NotificationProvider {
  name = 'mock-whatsapp';

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    console.log('[MockWhatsApp] Sending message:', {
      to: payload.recipient.phone,
      body: payload.body.slice(0, 100) + '...',
    });
    return { success: true, providerRef: `mock-wa-${Date.now()}` };
  }
}

class MockSmsProvider implements NotificationProvider {
  name = 'mock-sms';

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    console.log('[MockSMS] Sending SMS:', {
      to: payload.recipient.phone,
      body: payload.body.slice(0, 100) + '...',
    });
    return { success: true, providerRef: `mock-sms-${Date.now()}` };
  }
}

// ── Notification Service ──────────────────────────────────────
class NotificationService {
  private emailProvider: NotificationProvider;
  private whatsappProvider: NotificationProvider;
  private smsProvider: NotificationProvider;

  constructor() {
    const env = import.meta.env.VITE_APP_ENV ?? 'development';
    const isDev = env === 'development';

    // In production, swap these with real providers
    this.emailProvider = isDev ? new MockEmailProvider() : new MockEmailProvider();
    this.whatsappProvider = isDev ? new MockWhatsAppProvider() : new MockWhatsAppProvider();
    this.smsProvider = isDev ? new MockSmsProvider() : new MockSmsProvider();
  }

  async sendEmail(payload: NotificationPayload): Promise<NotificationResult> {
    if (!payload.recipient.email) {
      return { success: false, error: 'No email address provided' };
    }
    return this.emailProvider.send(payload);
  }

  async sendWhatsApp(payload: NotificationPayload): Promise<NotificationResult> {
    if (!payload.recipient.phone) {
      return { success: false, error: 'No phone number provided' };
    }
    return this.whatsappProvider.send(payload);
  }

  async sendSMS(payload: NotificationPayload): Promise<NotificationResult> {
    if (!payload.recipient.phone) {
      return { success: false, error: 'No phone number provided' };
    }
    return this.smsProvider.send(payload);
  }

  interpolate(template: string, variables: Record<string, string>): string {
    return Object.entries(variables).reduce(
      (str, [key, val]) => str.replaceAll(`{{${key}}}`, val),
      template
    );
  }
}

export const notificationService = new NotificationService();
