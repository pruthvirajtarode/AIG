// ============================================================
// AIGMS — Order, Participant, Animal & Programme Business Rules
// Shared across UI forms, AppDataContext data layer, and tests.
// ============================================================

export type OrderServiceType = 'qurban' | 'aqiqah' | 'nazar';
export type OrderPaymentMethod = 'paynow' | 'cash' | 'installment' | 'bank_transfer';
export type OrderDeliveryPortion = 'full' | 'one_third' | 'two_thirds' | 'nil';

/** Official Al Ihsan Group WhatsApp Business number for AIGMS notifications. */
export const OFFICIAL_WHATSAPP_NUMBER = '+6585456783';
export const OFFICIAL_WHATSAPP_DISPLAY = '+65 8545 6783';

export const ORDER_SERVICE_OPTIONS: ReadonlyArray<{ label: string; value: 'qurban' | 'aqiqah' }> = [
  { label: 'Qurban', value: 'qurban' },
  { label: 'Aqiqah', value: 'aqiqah' },
];

export type CertificateTemplateType = 'breeding_programme' | 'standard';

export interface ParticipantIdentityConflict {
  existingParticipantId: string;
  existingParticipantRef: string;
  existingFullName: string;
  existingEmail: string;
  existingPhone: string;
  matchedFields: Array<'name' | 'email' | 'phone'>;
  differingFields: Array<'name' | 'email' | 'phone'>;
  summary: string;
}

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

/**
 * Normalize and validate a recipient phone number to strict E.164 format (+<country><number>, 8–15 digits)
 * for Meta WhatsApp Cloud API delivery.
 */
export function normaliseWhatsAppPhoneE164(
  value?: string | null,
): { valid: true; e164: string; digits: string } | { valid: false; error: string } {
  const raw = (value ?? '').trim();
  if (!raw) {
    return { valid: false, error: 'Recipient phone number is empty.' };
  }
  if (/[a-zA-Z]/.test(raw)) {
    return { valid: false, error: `Invalid characters in phone number "${raw}".` };
  }
  const digits = normalisePhone(raw);
  if (!/^[1-9]\d{7,14}$/.test(digits)) {
    return {
      valid: false,
      error: `Phone number "${raw}" is not a valid international E.164 number (8–15 digits required).`,
    };
  }
  return {
    valid: true,
    e164: `+${digits}`,
    digits,
  };
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

/**
 * Detect ambiguous participant identity conflicts when the 3-field combination
 * (Full Name + Email Address + Contact Number) does NOT match an existing participant,
 * but the incoming Email Address or Contact Number belongs to an existing participant
 * with a different name/contact (or same name with 1 matching + 1 differing contact field).
 *
 * Used to flag an operational Exception for staff review without silently merging or overwriting.
 */
export function detectParticipantIdentityConflicts(
  incoming: { full_name: string; email: string; contact_number: string },
  existingParticipants: ReadonlyArray<{
    id: string;
    participant_ref?: string | null;
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email: string;
    phone?: string | null;
    contact_number?: string | null;
  }>,
  excludeParticipantId?: string,
): ParticipantIdentityConflict[] {
  const inName = normaliseName(incoming.full_name);
  const inEmail = normaliseEmail(incoming.email);
  const inPhone = normalisePhone(incoming.contact_number);
  if (!inName && !inEmail && !inPhone) return [];

  const conflicts: ParticipantIdentityConflict[] = [];
  for (const p of existingParticipants) {
    if (excludeParticipantId && p.id === excludeParticipantId) continue;
    if (participantsMatch(incoming, p)) continue;

    const exFullName = participantFullName(p);
    const exName = normaliseName(exFullName);
    const exEmail = normaliseEmail(p.email);
    const exPhone = normalisePhone(p.phone || p.contact_number || '');

    const sameName = Boolean(inName && exName && inName === exName);
    const sameEmail = Boolean(inEmail && exEmail && inEmail === exEmail);
    const samePhone = Boolean(inPhone && exPhone && inPhone === exPhone);

    // Flag conflict if email or phone matches a differently named/contacted participant
    if (!sameEmail && !samePhone) continue;

    const matchedFields: Array<'name' | 'email' | 'phone'> = [];
    const differingFields: Array<'name' | 'email' | 'phone'> = [];
    if (sameName) matchedFields.push('name');
    else differingFields.push('name');
    if (sameEmail) matchedFields.push('email');
    else differingFields.push('email');
    if (samePhone) matchedFields.push('phone');
    else differingFields.push('phone');

    const ref = p.participant_ref || p.id;
    const summary = `Incoming (${incoming.full_name.trim()} / ${incoming.email.trim()} / ${incoming.contact_number.trim()}) shares ${matchedFields.join(' & ')} with existing participant ${ref} (${exFullName} / ${p.email} / ${p.phone || p.contact_number || '—'}) but differs on ${differingFields.join(' & ')}.`;

    conflicts.push({
      existingParticipantId: p.id,
      existingParticipantRef: ref,
      existingFullName: exFullName,
      existingEmail: p.email,
      existingPhone: p.phone || p.contact_number || '',
      matchedFields,
      differingFields,
      summary,
    });
  }
  return conflicts;
}

// ── Programme Route & Share Helpers ───────────────────────────

/**
 * Select the certificate template according to confirmed client rules:
 * - 'breeding_programme': ONLY for the Indonesia Breeding Programme (prog-id-breeding / supports_weight_timeline).
 * - 'standard': for ALL other programmes, including Indonesia - Goat (XL).
 * Never select the template solely based on country === 'Indonesia'.
 */
export function selectCertificateTemplate(
  programmeName?: string | null,
  programmeId?: string | null,
  supportsWeightTimeline?: boolean | null,
): CertificateTemplateType {
  if (programmeId === 'prog-id-breeding') return 'breeding_programme';
  if (isBreedingProgramme(programmeName, supportsWeightTimeline)) return 'breeding_programme';
  return 'standard';
}

/**
 * Distinguish whole-animal allocations (1/1) from fractional cattle shares (1/7).
 * Do not assume every purchased cattle share requires a separate physical cow.
 */
export function getProgrammeShareMetadata(
  programmeName?: string | null,
  animalsPerShare?: number | null,
): {
  animals_per_share: number;
  share_ratio: '1/1' | '1/7' | string;
  is_fractional_share: boolean;
  label: string;
} {
  const n = (programmeName ?? '').toLowerCase();
  const resolved =
    typeof animalsPerShare === 'number' && animalsPerShare > 1
      ? animalsPerShare
      : n.includes('1/7') || n.includes('cattle (1/7)') || n.includes('cow share')
        ? 7
        : 1;
  if (resolved > 1) {
    return {
      animals_per_share: resolved,
      share_ratio: `1/${resolved}`,
      is_fractional_share: true,
      label: `1/${resolved} Cattle Share`,
    };
  }
  return {
    animals_per_share: 1,
    share_ratio: '1/1',
    is_fractional_share: false,
    label: 'Whole Animal (1/1)',
  };
}

/**
 * Compute how many physical animals are required for a given number of allocated shares.
 * For example, 7 purchased shares in a 1/7 cattle programme = 1 physical cow;
 * 8 purchased shares = 2 physical cows.
 */
export function calculatePhysicalAnimalsNeeded(
  allocatedSharesCount: number,
  animalsPerShare = 1,
): number {
  if (allocatedSharesCount <= 0) return 0;
  const divisor = Math.max(1, Math.floor(animalsPerShare || 1));
  return Math.ceil(allocatedSharesCount / divisor);
}

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

/**
 * True ONLY for breeding programmes (e.g. Indonesia - Breeding Programme) where
 * ongoing weight updates / weight timeline are tracked and shown to the participant.
 * All standard Qurban programmes display approximate weight only (no weight timeline).
 */
export function isBreedingProgramme(
  programmeName?: string | null,
  supportsWeightTimeline?: boolean | null,
): boolean {
  if (typeof supportsWeightTimeline === 'boolean') return supportsWeightTimeline;
  return /\bbreeding\b/i.test(programmeName ?? '');
}

/**
 * Default approximate weight label for standard Qurban programmes/animals.
 */
export function defaultApproxWeight(
  programmeName?: string | null,
  animalType?: string | null,
): string {
  const n = (programmeName ?? '').toLowerCase();
  const t = (animalType ?? '').toLowerCase();
  if (n.includes('breeding')) return 'Approx. 25–35 kg (monthly weight updates)';
  if (n.includes('goat (xl)')) return 'Approx. 35–40 kg';
  if (n.includes('goat (l)')) return 'Approx. 25–30 kg';
  if (n.includes('goat (m)')) return 'Approx. 20–25 kg';
  if (n.includes('cattle') || t === 'cow' || t === 'buffalo') return 'Approx. 300–350 kg (whole)';
  if (n.includes('lamb') || t === 'lamb') return 'Approx. 18–22 kg';
  if (n.includes('sheep') || t === 'sheep') return 'Approx. 25–30 kg';
  if (t === 'camel') return 'Approx. 300–400 kg';
  return 'Approx. 22–28 kg';
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

/**
 * Summarize per-Qurban delivery portions across an order's animals.
 * If all animals share the same portion (or there is 1 Qurban), returns e.g. '2/3'.
 * If multiple Qurbans have distinct portions, returns e.g. 'Qurban 1: 2/3 · Qurban 2: Full'.
 */
export function summarizeOrderPortions(
  portions: Array<string | null | undefined>,
  fallbackPortion?: string | null,
): string {
  const valid = portions.filter((p): p is string => Boolean(p && p.trim()));
  if (valid.length === 0) {
    return formatDeliveryPortion(fallbackPortion);
  }
  const formatted = valid.map(p => formatDeliveryPortion(p));
  const unique = Array.from(new Set(formatted));
  if (unique.length === 1) {
    return unique[0];
  }
  return formatted.map((label, idx) => `Qurban ${idx + 1}: ${label}`).join(' · ');
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
  qurban_entries: Array<{
    qurban_name_holder: string;
    delivery_portion?: string | null;
  }>;
}

export interface OrderValidationContext {
  existingOrderRefs?: string[];
  knownProgrammes?: Array<{ id: string; name: string; country: string }>;
  allowLegacyValues?: boolean;
}

export function validateOrderCandidate(
  input: OrderValidationCandidate,
  ctx: OrderValidationContext = {},
):
  | {
      valid: true;
      normalizedPortion: OrderDeliveryPortion | null;
      normalizedPortions: Array<OrderDeliveryPortion | null>;
    }
  | { valid: false; error: string } {
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
    const normalizedPortions: OrderDeliveryPortion[] = [];
    for (let i = 0; i < input.qurban_entries.length; i++) {
      const rawPortion = input.qurban_entries[i]?.delivery_portion ?? input.delivery_portion ?? '';
      const dp = rawPortion.trim().toLowerCase();
      if (!dp || !['full', 'one_third', 'two_thirds', 'nil'].includes(dp)) {
        return {
          valid: false,
          error:
            input.quantity > 1
              ? `Portion to be Delivered (Full, 1/3, 2/3, or NIL) is required for Qurban ${i + 1} (Australia → Singapore).`
              : 'Portion to be Delivered (Full, 1/3, 2/3, or NIL) is required for Australia → Singapore orders.',
        };
      }
      normalizedPortions.push(dp as OrderDeliveryPortion);
    }
    return {
      valid: true,
      normalizedPortion: normalizedPortions[0] ?? null,
      normalizedPortions,
    };
  }

  return {
    valid: true,
    normalizedPortion: null,
    normalizedPortions: Array.from({ length: input.qurban_entries.length }, () => null),
  };
}
