// ============================================================
// Payment Service — provider adapter architecture
// ============================================================

export interface PaymentInitParams {
  orderId: string;
  amount: number;
  currency: string;
  participantEmail: string;
  participantName: string;
  description: string;
  redirectUrl?: string;
  webhookUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentInitResult {
  success: boolean;
  paymentUrl?: string;
  transactionRef?: string;
  providerData?: Record<string, unknown>;
  error?: string;
}

export interface PaymentVerifyResult {
  success: boolean;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  transactionRef?: string;
  paidAmount?: number;
  paidAt?: string;
  error?: string;
}

export interface PaymentProvider {
  name: string;
  initiate(params: PaymentInitParams): Promise<PaymentInitResult>;
  verify(transactionRef: string): Promise<PaymentVerifyResult>;
}

// ── Mock Payment Provider (development) ──────────────────────
class MockPaymentProvider implements PaymentProvider {
  name = 'mock';

  async initiate(params: PaymentInitParams): Promise<PaymentInitResult> {
    console.log('[MockPayment] Initiating payment:', params);
    return {
      success: true,
      paymentUrl: `${import.meta.env.VITE_APP_URL}/mock-payment?ref=${params.orderId}`,
      transactionRef: `MOCK-${Date.now()}`,
      providerData: { mock: true },
    };
  }

  async verify(transactionRef: string): Promise<PaymentVerifyResult> {
    console.log('[MockPayment] Verifying:', transactionRef);
    return {
      success: true,
      status: 'paid',
      transactionRef,
      paidAt: new Date().toISOString(),
    };
  }
}

// ── Future Gateway Provider Placeholder ──────────────────────
// class GatewayPaymentProvider implements PaymentProvider {
//   name = 'gateway-name';
//   private apiKey: string;
//   private secret: string;
//   constructor(apiKey: string, secret: string) {
//     this.apiKey = apiKey;
//     this.secret = secret;
//   }
//   async initiate(params: PaymentInitParams): Promise<PaymentInitResult> { ... }
//   async verify(transactionRef: string): Promise<PaymentVerifyResult> { ... }
// }

// ── Payment Service Factory ───────────────────────────────────
function createPaymentProvider(): PaymentProvider {
  const provider = import.meta.env.VITE_PAYMENT_PROVIDER ?? 'mock';

  switch (provider) {
    // case 'gateway-name':
    //   return new GatewayPaymentProvider(
    //     import.meta.env.VITE_PAYMENT_PROVIDER_KEY,
    //     import.meta.env.VITE_PAYMENT_PROVIDER_SECRET,
    //   );
    default:
      return new MockPaymentProvider();
  }
}

export const paymentProvider = createPaymentProvider();
