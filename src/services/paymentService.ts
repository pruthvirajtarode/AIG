// ============================================================
// Payment Service — Provider Adapter Architecture
// Strictly separates:
//   1. Payment Initiation (initiate)
//   2. Manual Proof Submission (submitProof)
//   3. Staff Verification / Gateway Settlement (verify)
//   4. Partial / Installment Payment Tracking & Refunds
//
// SECURITY & HONESTY RULE:
// Never mark a payment as 'paid' or 'verified' merely because a
// development/mock provider returns a response. All payments remain
// 'pending' or 'submitted' until verified by authorized staff or a
// cryptographically signed gateway webhook.
// ============================================================

import { isIndonesiaProgramme } from '@/lib/orderRules';

export type SupportedPaymentMethod = 'paynow' | 'cash' | 'installment' | 'bank_transfer';

export interface PaymentInitParams {
  orderId: string;
  orderRef?: string;
  amount: number;
  currency: string;
  method?: SupportedPaymentMethod;
  programmeName?: string;
  programmeCountry?: string;
  participantEmail: string;
  participantName: string;
  description: string;
  redirectUrl?: string;
  webhookUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentInitResult {
  success: boolean;
  status: 'initiated_pending_proof' | 'failed';
  isSimulated: boolean;
  requiresManualVerification: boolean;
  paymentUrl?: string;
  transactionRef?: string;
  providerData?: Record<string, unknown>;
  error?: string;
}

export interface PaymentVerifyResult {
  success: boolean;
  /**
   * Honest settlement status:
   * Mock/sandbox adapters ALWAYS return 'pending' (never 'paid'!),
   * requiring explicit staff verification of uploaded proof or a signed webhook.
   */
  status: 'paid' | 'pending' | 'submitted' | 'failed' | 'refunded';
  isSimulated: boolean;
  requiresManualVerification: boolean;
  transactionRef?: string;
  paidAmount?: number;
  paidAt?: string;
  error?: string;
}

export interface InstallmentScheduleItem {
  installmentNumber: number;
  amount: number;
  currency: string;
  dueDate: string;
  status: 'pending' | 'submitted' | 'verified';
}

export interface PaymentProvider {
  name: string;
  isLiveGateway: boolean;
  initiate(params: PaymentInitParams): Promise<PaymentInitResult>;
  verify(transactionRef: string): Promise<PaymentVerifyResult>;
}

/**
 * Validate payment parameters against AIGMS business rules (SGD currency, positive total,
 * Indonesia-only installment restriction, preservation of legacy bank_transfer).
 */
export function validatePaymentRequest(params: {
  amount: number;
  currency: string;
  method: string;
  programmeName?: string;
  programmeCountry?: string;
  allowLegacyMethods?: boolean;
}): { valid: true } | { valid: false; error: string } {
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    return { valid: false, error: 'Payment amount must be greater than SGD 0.' };
  }
  const currency = (params.currency || 'SGD').trim().toUpperCase();
  if (currency !== 'SGD') {
    return { valid: false, error: `Unsupported currency "${currency}". All AIGMS transactions are settled in SGD.` };
  }
  const method = (params.method || '').trim().toLowerCase();
  const allowed = params.allowLegacyMethods
    ? ['paynow', 'cash', 'installment', 'bank_transfer']
    : ['paynow', 'cash', 'installment'];
  if (!allowed.includes(method)) {
    return { valid: false, error: `Payment method "${params.method}" is not supported.` };
  }
  if (method === 'installment' && params.programmeName) {
    if (!isIndonesiaProgramme(params.programmeName, params.programmeCountry)) {
      return { valid: false, error: 'Installment payment method is restricted to Indonesia programmes only.' };
    }
  }
  return { valid: true };
}

/**
 * Build a 3-part installment schedule for eligible Indonesia programmes (e.g. Indonesia Goat XL
 * or Indonesia Breeding Programme) while keeping total amount exact to the cent in SGD.
 */
export function buildInstallmentSchedule(
  totalAmount: number,
  installmentsCount = 3,
  startDateIso = new Date().toISOString(),
  currency = 'SGD',
): InstallmentScheduleItem[] {
  const count = Math.max(2, Math.min(6, Math.floor(installmentsCount)));
  const basePart = Math.floor((totalAmount / count) * 100) / 100;
  const remainder = Math.round((totalAmount - basePart * count) * 100) / 100;
  const baseDate = new Date(startDateIso);

  return Array.from({ length: count }, (_, idx) => {
    const due = new Date(baseDate);
    due.setMonth(due.getMonth() + idx);
    const amount = idx === count - 1 ? Math.round((basePart + remainder) * 100) / 100 : basePart;
    return {
      installmentNumber: idx + 1,
      amount,
      currency,
      dueDate: due.toISOString().slice(0, 10),
      status: 'pending',
    };
  });
}

// ── Development / Manual Proof Payment Adapter ───────────────
// Used when no live automated payment gateway is configured.
// Never auto-settles or returns 'paid' on verify()!
class ManualVerificationPaymentProvider implements PaymentProvider {
  name = 'manual-verification-sandbox';
  isLiveGateway = false;

  async initiate(params: PaymentInitParams): Promise<PaymentInitResult> {
    const check = validatePaymentRequest({
      amount: params.amount,
      currency: params.currency || 'SGD',
      method: params.method || 'paynow',
      programmeName: params.programmeName,
      programmeCountry: params.programmeCountry,
      allowLegacyMethods: true,
    });
    if (!check.valid) {
      return {
        success: false,
        status: 'failed',
        isSimulated: true,
        requiresManualVerification: true,
        error: check.error,
      };
    }

    return {
      success: true,
      status: 'initiated_pending_proof',
      isSimulated: true,
      requiresManualVerification: true,
      transactionRef: `MAN-${Date.now()}`,
      providerData: {
        mode: 'manual_proof_verification',
        method: params.method ?? 'paynow',
        note: 'No live payment gateway connected. Payment remains pending until proof is uploaded and verified by AIG staff.',
      },
    };
  }

  async verify(transactionRef: string): Promise<PaymentVerifyResult> {
    // CRITICAL RULE (Phase 2.4 & Phase 6):
    // Never mark a payment as 'paid' merely because a mock/sandbox adapter was called.
    return {
      success: true,
      status: 'pending',
      isSimulated: true,
      requiresManualVerification: true,
      transactionRef,
      error: 'Automatic gateway verification is not active in sandbox/manual mode. Staff must verify payment proof in Admin -> Payments.',
    };
  }
}

function createPaymentProvider(): PaymentProvider {
  return new ManualVerificationPaymentProvider();
}

export const paymentProvider = createPaymentProvider();
