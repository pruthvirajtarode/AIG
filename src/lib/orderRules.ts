// ============================================================
// AIGMS — Order, Participant, Animal & Programme Business Rules
// Shared across UI forms, AppDataContext data layer, and tests.
// ============================================================

export type OrderServiceType = 'qurban' | 'aqiqah' | 'nazar';
export type OrderPaymentMethod = 'paynow' | 'cash' | 'installment' | 'bank_transfer';
export type OrderDeliveryPortion = 'full' | 'one_third' | 'two_thirds' | 'nil';

export const ORDER_SERVICE_OPTIONS: ReadonlyArray<{ label: string; value: 'qurban' | 'aqiqah' }> = [
  { label: 'Qurban', value: 'qurban' },
  { label: 'Aqiqah', value: 'aqiqah' },
];

export const ORDER_PAYMENT_OPTIONS: ReadonlyArray<{
  label: string;
  value: 'paynow' | 'cash' | 'installment';
  indonesiaOnly: boolean;
}> = [
  { label: 'PayNow', value: 'paynow', indonesiaOnly: false },
  { label: 'Cash', value: 'cash', indonesiaOnly: false },
  { label: 'Installment', value: 'installment', indonesiaOnly: true },
];

export const AUSTRALIA_SINGAPORE_PORTION_OPTIONS: ReadonlyArray<{
  label: string;
  value: OrderDeliveryPortion;
}> = [
  { label: 'Full', value: 'full' },
  { label: '1/3', value: 'one_third' },
  { label: '2/3', value: 'two_thirds' },
  { label: 'NIL', value: 'nil' },
];

// ── String & Contact Normalization ────────────────────────────

/** Normalize names/text: trim, lowercase, collapse internal whitespace. */
export function normaliseName(value?: string | null): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Normalize email addresses: trim and lowercase. */
export function normaliseEmail(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * Normalize phone numbers consistently before comparison.
 * Strips spaces, dashes, parentheses, and '+'.
 * Normalizes 8-digit Singapore numbers (starting with 6, 8, or 9) to '65XXXXXXXX'
 * so '+65 9123 4567', '65-9123-4567', and '91234567' match identically.
 */
export function normalisePhone(value?: string | null): string {
  const digits = (value ?? '').replace(/\D+/g, '');
  if (digits.length === 8 && /^[689]/.test(digits)) {
    return `65${digits}`;
  }
  return digits;
}

export function splitFullName(rawFullName: string): {
  first_name: string;
  last_name: string;
  full_name: string;
} {
  const cleaned = (rawFullName ?? '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return { first_name: '', last_name: '', full_name: '' };
  const parts = cleaned.split(' ');
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: '', full_name: cleaned };
  }
  return {
    first_name: parts.slice(0, -1).join(' '),
    last_name: parts[parts.length - 1],
    full_name: cleaned,
  };
}

export function participantFullName(p: {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const explicit = p.full_name?.trim();
  if (explicit) return explicit.replace(/\s+/g, ' ');
  return `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim().replace(/\s+/g, ' ');
}

/**
 * Determine whether incoming order participant fields match an existing participant.
 * Requires ALL THREE normalized fields to match:
 *   Full Name + Email Address + Contact Number
 */
export function participantsMatch(
  incoming: { full_name: string; email: string; contact_number: string },
  existing: {
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email: string;
    phone?: string | null;
    contact_number?: string | null;
  },
): boolean {
  const inName = normaliseName(incoming.full_name);
  const inEmail = normaliseEmail(incoming.email);
  const inPhone = normalisePhone(incoming.contact_number);
  if (!inName || !inEmail || !inPhone) return false;

  const exName = normaliseName(participantFullName(existing));
  const exEmail = normaliseEmail(existing.email);
  const exPhone = normalisePhone(existing.phone || existing.contact_number || '');

  return inName === exName && inEmail === exEmail && inPhone === exPhone;
}

// ── Programme Route Helpers ───────────────────────────────────

export function isIndonesiaProgramme(programmeName: string, country?: string | null): boolean {
  const c = (country ?? '').trim().toLowerCase();
  const n = (programmeName ?? '').trim().toLowerCase();
  return c === 'indonesia' || n.includes('indonesia');
}

/**
 * True only when the selected programme/route is Australia -> Singapore.
 * Excludes Australia -> Palestine and all other destinations.
 */
export function isAustraliaToSingaporeProgramme(
  programmeName: string,
  country?: string | null,
): boolean {
  const n = (programmeName ?? '').trim();
  const lower = n.toLowerCase();
  if (/australia\s*(to|→|->|-|—)+\s*singapore/i.test(n)) {
    return true;
  }
  const c = (country ?? '').trim().toLowerCase();
  if (
    c === 'australia' &&
    !lower.includes('palestine') &&
    !lower.includes('yemen') &&
    !lower.includes('uganda') &&
    !lower.includes('indonesia')
  ) {
    return true;
  }
  return false;
}

// ── Order Reference & Animal Code Generation ──────────────────

/**
 * Generate next sequential Order Reference (e.g. ORD-10001, ORD-10025).
 */
export function nextOrderRef(existingRefs: string[]): string {
  const re = /^ORD-(\d+)$/i;
  let max = 10000;
  for (const r of existingRefs) {
    const m = re.exec((r ?? '').trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `ORD-${max + 1}`;
}

export function normaliseOrderRef(ref: string): string {
  const trimmed = (ref ?? '').trim().replace(/\s+/g, '');
  if (/^ord-\d+$/i.test(trimmed)) {
    return `ORD-${trimmed.slice(4)}`;
  }
  return trimmed;
}

/**
 * Generate a unique Animal Code tied to an Order Reference and 0-based index.
 * Example: ORD-10025 + 0 -> ANM-10025-01
 *          ORD-10025 + 1 -> ANM-10025-02
 */
export function animalCodeForOrder(orderRef: string, index: number): string {
  const base = normaliseOrderRef(orderRef).replace(/^ORD-/i, '');
  return `ANM-${base}-${String(index + 1).padStart(2, '0')}`;
}

// ── Display Formatters ────────────────────────────────────────

export function formatServiceType(serviceType?: string | null): string {
  if (!serviceType) return '—';
  switch (serviceType.toLowerCase()) {
    case 'qurban':
      return 'Qurban';
    case 'aqiqah':
      return 'Aqiqah';
    case 'nazar':
      return 'Nazar';
    default:
      return serviceType.charAt(0).toUpperCase() + serviceType.slice(1);
  }
}

export function formatPaymentMethod(method?: string | null): string {
  if (!method) return '—';
  switch (method.toLowerCase()) {
    case 'paynow':
      return 'PayNow';
    case 'cash':
      return 'Cash';
    case 'installment':
      return 'Installment';
    case 'bank_transfer':
      return 'Bank Transfer';
    default:
      return method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}

export function formatDeliveryPortion(portion?: string | null): string {
  if (!portion) return '—';
  switch (portion.toLowerCase()) {
    case 'full':
      return 'Full';
    case 'one_third':
      return '1/3';
    case 'two_thirds':
      return '2/3';
    case 'nil':
      return 'NIL';
    default:
      return portion;
  }
}

// ── Order Input Validation ────────────────────────────────────

export interface OrderValidationCandidate {
  order_ref?: string;
  full_name: string;
  email: string;
  contact_number: string;
  programme: string;
  programme_id?: string;
  programme_country?: string;
  service_type: string;
  payment_method: string;
  delivery_portion?: string | null;
  quantity: number;
  total_amount: number;
  qurban_entries: Array<{ qurban_name_holder: string }>;
}

export interface OrderValidationContext {
  existingOrderRefs?: string[];
  knownProgrammes?: Array<{ id: string; name: string; country: string }>;
  allowLegacyValues?: boolean;
}

export function validateOrderCandidate(
  input: OrderValidationCandidate,
  ctx: OrderValidationContext = {},
): { valid: true; normalizedPortion: OrderDeliveryPortion | null } | { valid: false; error: string } {
  if (!input.full_name?.trim()) {
    return { valid: false, error: 'Full Name is required.' };
  }
  const email = input.email?.trim() ?? '';
  if (!email) {
    return { valid: false, error: 'Email Address is required.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, error: 'Please enter a valid Email Address.' };
  }
  const phone = input.contact_number?.trim() ?? '';
  if (!phone) {
    return { valid: false, error: 'Contact Number is required.' };
  }
  if (normalisePhone(phone).length < 6) {
    return { valid: false, error: 'Please enter a valid Contact Number.' };
  }

  if (input.order_ref !== undefined && input.order_ref !== '') {
    const normRef = normaliseOrderRef(input.order_ref);
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{2,40}$/.test(normRef)) {
      return { valid: false, error: 'Order Reference must be 3–41 alphanumeric characters (e.g. ORD-10025).' };
    }
    if (ctx.existingOrderRefs?.some(r => normaliseOrderRef(r).toLowerCase() === normRef.toLowerCase())) {
      return { valid: false, error: `Order Reference "${normRef}" already exists.` };
    }
  }

  const progName = input.programme?.trim() ?? '';
  if (!progName) {
    return { valid: false, error: 'Programme is required.' };
  }

  let resolvedCountry = input.programme_country?.trim() ?? '';
  if (ctx.knownProgrammes && ctx.knownProgrammes.length > 0) {
    const matchedProg = ctx.knownProgrammes.find(
      p =>
        (input.programme_id && p.id === input.programme_id) ||
        normaliseName(p.name) === normaliseName(progName),
    );
    if (!matchedProg && !ctx.allowLegacyValues) {
      return { valid: false, error: `Selected programme "${progName}" is not a valid configured programme.` };
    }
    if (matchedProg && !resolvedCountry) {
      resolvedCountry = matchedProg.country;
    }
  }

  const st = (input.service_type ?? '').trim().toLowerCase();
  const allowedServices = ctx.allowLegacyValues ? ['qurban', 'aqiqah', 'nazar'] : ['qurban', 'aqiqah'];
  if (!st || !allowedServices.includes(st)) {
    return { valid: false, error: 'Type of Service is required (Qurban or Aqiqah).' };
  }

  const pm = (input.payment_method ?? '').trim().toLowerCase();
  const allowedMethods = ctx.allowLegacyValues
    ? ['paynow', 'cash', 'installment', 'bank_transfer']
    : ['paynow', 'cash', 'installment'];
  if (!pm || !allowedMethods.includes(pm)) {
    return { valid: false, error: 'Payment Method is required (PayNow, Cash, or Installment).' };
  }

  const isIndonesia = isIndonesiaProgramme(progName, resolvedCountry);
  if (pm === 'installment' && !isIndonesia) {
    return { valid: false, error: 'Installment is only available for Indonesia programmes.' };
  }

  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    return { valid: false, error: 'Number of Qurbans must be a whole number of at least 1.' };
  }

  if (!Array.isArray(input.qurban_entries) || input.qurban_entries.length !== input.quantity) {
    return {
      valid: false,
      error: `Please provide Qurban Name Holder details for all ${input.quantity} Qurban(s).`,
    };
  }

  for (let i = 0; i < input.qurban_entries.length; i++) {
    if (!input.qurban_entries[i]?.qurban_name_holder?.trim()) {
      return {
        valid: false,
        error: `Qurban Name Holder is required for Qurban ${i + 1}.`,
      };
    }
  }

  if (!Number.isFinite(input.total_amount) || input.total_amount <= 0) {
    return { valid: false, error: 'Order total amount must be greater than 0.' };
  }

  const isAuSg = isAustraliaToSingaporeProgramme(progName, resolvedCountry);
  if (isAuSg) {
    const dp = (input.delivery_portion ?? '').trim().toLowerCase();
    if (!dp || !['full', 'one_third', 'two_thirds', 'nil'].includes(dp)) {
      return {
        valid: false,
        error: 'Portion to be Delivered (Full, 1/3, 2/3, or NIL) is required for Australia → Singapore orders.',
      };
    }
    return { valid: true, normalizedPortion: dp as OrderDeliveryPortion };
  }

  return { valid: true, normalizedPortion: null };
}
