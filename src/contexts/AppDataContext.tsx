/**
 * AppDataContext — Global store for the AIG admin system.
 *
 *  • Data is persisted to localStorage, so it survives page refreshes and is
 *    kept in sync between open browser tabs.
 *  • Changing an order status (forwards, backwards or skipping steps) keeps the
 *    linked Payment / Animal / Delivery / Certificate records in sync.
 *  • Payment / Delivery / Certificate actions push the order forward as well.
 *  • Dashboard + list stats are derived from the real data of every module.
 *
 * All mutations go through `commit()`, which computes the next state from the
 * latest snapshot synchronously (no side effects inside React state updaters).
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  OrderStatus, AnimalStatus, AnimalType,
  PaymentStatus, DeliveryStatus, CertificateStatus,
  ExceptionSeverity, ExceptionStatus, UserRole, DistributionMethod,
} from '@/lib/database.types';
import { getStatusLabel } from '@/lib/statusEngine';
import {
  animalCodeForOrder,
  defaultApproxWeight,
  detectParticipantIdentityConflicts,
  formatPaymentMethod,
  formatServiceType,
  getProgrammeShareMetadata,
  isBreedingProgramme,
  nextOrderRef,
  normaliseName,
  normaliseOrderRef,
  participantFullName,
  participantsMatch,
  selectCertificateTemplate,
  splitFullName,
  validateOrderCandidate,
  type CertificateTemplateType,
} from '@/lib/orderRules';
import { useAuth } from '@/contexts/AuthContext';
import { LIVE_PROGRAMMES, LIVE_PROGRAMMES_VERSION } from '@/data/liveProgrammes';
import { notificationService } from '@/services/notificationService';
import { buildInstallmentSchedule, type InstallmentScheduleItem } from '@/services/paymentService';
import { loadFromSupabase, syncToSupabase } from '@/services/supabaseSync';

export { animalCodeForOrder, nextOrderRef };

// ─────────────────────────────────────────────────────────────
// Local flat types used by the admin pages
// ─────────────────────────────────────────────────────────────

export type AnimalWeightEntry = {
  weight_kg: number;
  recorded_at: string;
  notes?: string;
};

export type AppOrder = {
  id: string;
  order_ref: string;
  order_reference?: string;
  participant: string;
  participant_id?: string;
  contact_number?: string;
  email?: string;
  programme: string;
  programme_id?: string;
  programme_country?: string;
  service_type?: 'qurban' | 'aqiqah' | 'nazar';
  payment_method?: 'paynow' | 'cash' | 'installment' | 'bank_transfer';
  installment_count?: number;
  installments_paid?: number;
  installment_schedule?: InstallmentScheduleItem[];
  delivery_portion?: 'full' | 'one_third' | 'two_thirds' | 'nil' | null;
  quantity: number;
  number_of_qurbans?: number;
  total_amount: number;
  currency: string;
  status: OrderStatus;
  created_at: string;
  recipient?: string;
  notes?: string;
  client_request_id?: string;
  confirmation_email_sent_at?: string | null;
  confirmation_email_status?: 'not_sent' | 'queued' | 'simulated' | 'sent' | 'failed' | 'legacy_unverified_timestamp';
  confirmation_email_provider_ref?: string | null;
  confirmation_email_idempotency_key?: string | null;
};

export type AppAnimal = {
  id: string;
  animal_ref: string;
  animal_code?: string;   // e.g. ANM-10025-01
  animal_type: AnimalType;
  breed: string;
  gender: string;
  status: AnimalStatus;
  current_weight_kg: number;
  min_weight_kg: number;
  approx_weight?: string;
  weight_history?: AnimalWeightEntry[];
  location: string;
  supplier: string;
  created_at: string;
  tag_number: string;
  last_inspection?: string;
  order_id?: string;
  order_ref?: string;     // linked order ref when allocated
  qurban_name_holder?: string; // name the qurban is performed for
  programme?: string;
  programme_id?: string;
  service_type?: 'qurban' | 'aqiqah' | 'nazar';
  delivery_portion?: 'full' | 'one_third' | 'two_thirds' | 'nil' | null;
  animals_per_share?: number;
  share_ratio?: string;
};

export type AppPayment = {
  id: string;
  payment_ref: string;
  order_ref: string;
  participant: string;
  amount: number;
  currency: string;
  method: string;
  status: PaymentStatus;
  submitted_at: string | null;
  verified_at: string | null;
  bank: string | null;
  notes: string | null;
  proof_url?: string | null;
  rejection_reason?: string | null;
  installment_count?: number;
  installments_paid?: number;
  installment_schedule?: InstallmentScheduleItem[];
};

export type AppDelivery = {
  id: string;
  delivery_ref: string;
  order_ref: string;
  participant: string;
  contact_phone: string;
  status: DeliveryStatus;
  scheduled_date: string | null;
  delivered_at: string | null;
  address: string;
  driver: string | null;
  delivery_slot: string | null;
};

export type AppCertificate = {
  id: string;
  certificate_ref: string;
  order_ref: string;
  participant_name: string;
  qurban_name_holder?: string;
  programme_name: string;
  programme_id?: string;
  country: string;
  animal_ref: string;
  animal_type: AnimalType;
  animal_label: string;
  qurban_date: string;
  status: CertificateStatus;
  generated_at: string | null;
  sent_at: string | null;
  verification_code: string;
  year: string;
  template_type?: CertificateTemplateType;
  service_type?: 'qurban' | 'aqiqah' | 'nazar';
  animal_photo_url?: string | null;
};

export type AppParticipant = {
  id: string;
  participant_ref: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  email: string;
  phone: string;
  contact_number?: string;
  profile_id?: string | null;
  country: string;
  ic_number: string;
  orders_count: number;
  total_spent: number;
  is_active: boolean;
  portal_access: boolean;
  created_at: string;
};

export type AppSupplier = {
  id: string;
  supplier_ref: string;
  name: string;
  contact_name: string;
  email: string;
  phone: string;
  country: string;
  region: string | null;
  animal_types: AnimalType[];
  is_active: boolean;
  animals_count: number;
};

export type AppProgramme = {
  id: string;
  name: string;
  slug: string;
  country: string;
  animal_type: AnimalType;
  animals_per_share: number;
  price_per_share: number;
  currency: string;
  /** Total share capacity. 0 = unlimited. */
  shares_available: number;
  min_quantity: number;
  distribution_method: DistributionMethod;
  is_active: boolean;
  qurban_date: string;
  orders_count: number;
  approx_weight_label?: string;
  supports_weight_timeline?: boolean;
};

export type AppException = {
  id: string;
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  category: string;
  title: string;
  description: string;
  related_entity: string;
  related_entity_id: string;
  assigned_to: string | null;
  created_at: string;
  resolution?: string | null;
};

export type AppAuditLog = {
  id: string;
  actor_email: string;
  actor_role: UserRole;
  action: string;
  entity: string;
  entity_id: string | null;
  description: string;
  created_at: string;
};

export type QurbanEntry = {
  qurban_name_holder: string;
  delivery_portion?: 'full' | 'one_third' | 'two_thirds' | 'nil' | null;
};

export type NewOrderInput = {
  // Optional confirmable Order Reference + idempotency key
  order_ref?: string;
  client_request_id?: string;

  // Participant fields
  full_name: string;         // used for dedup + participant.first_name+last_name
  email: string;
  contact_number: string;

  // Order fields
  programme: string;
  programme_id?: string;
  programme_country?: string;
  service_type: 'qurban' | 'aqiqah' | 'nazar';
  payment_method: 'paynow' | 'cash' | 'installment' | 'bank_transfer';
  installment_count?: number;
  delivery_portion?: 'full' | 'one_third' | 'two_thirds' | 'nil' | null;
  quantity: number;           // number of qurbans
  total_amount: number;
  currency?: string;
  notes?: string;
  status?: OrderStatus;

  // Per-qurban entries
  qurban_entries: QurbanEntry[];

  // Legacy compat
  participant?: string;
};

export type UpdateOrderInput = {
  full_name?: string;
  email?: string;
  contact_number?: string;
  programme?: string;
  programme_id?: string;
  programme_country?: string;
  service_type?: 'qurban' | 'aqiqah' | 'nazar';
  payment_method?: 'paynow' | 'cash' | 'installment' | 'bank_transfer';
  installment_count?: number;
  installments_paid?: number;
  installment_schedule?: InstallmentScheduleItem[];
  delivery_portion?: 'full' | 'one_third' | 'two_thirds' | 'nil' | null;
  quantity?: number;
  total_amount?: number;
  currency?: string;
  notes?: string;
  qurban_entries?: QurbanEntry[];
};

type AppData = {
  orders: AppOrder[];
  animals: AppAnimal[];
  payments: AppPayment[];
  deliveries: AppDelivery[];
  certificates: AppCertificate[];
  participants: AppParticipant[];
  suppliers: AppSupplier[];
  programmes: AppProgramme[];
  exceptions: AppException[];
  auditLogs: AppAuditLog[];
};

type Actor = { email: string; role: UserRole };

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'aigms-data-v1';
const MAX_AUDIT_LOGS = 2000;

const EMPTY: AppData = {
  orders: [], animals: [], payments: [], deliveries: [], certificates: [],
  participants: [], suppliers: [], programmes: LIVE_PROGRAMMES, exceptions: [], auditLogs: [],
};

const PROGRAMMES_VERSION_KEY = 'aigms-programmes-version';

/** Ensure all live AIG 1447H/2026 programmes are present while preserving user edits and custom programmes. */
function ensureLiveProgrammes(d: AppData): AppData {
  const liveIds = new Set(LIVE_PROGRAMMES.map(p => p.id));
  const liveNames = new Set(LIVE_PROGRAMMES.map(p => p.name.trim().toLowerCase()));

  let versionSynced = false;
  try {
    versionSynced = typeof localStorage !== 'undefined' && localStorage.getItem(PROGRAMMES_VERSION_KEY) === LIVE_PROGRAMMES_VERSION;
  } catch { /* ignore */ }

  const existingLive = d.programmes.filter(p => liveIds.has(p.id) || liveNames.has(p.name.trim().toLowerCase()));
  const nonLive = d.programmes
    .filter(p => !liveIds.has(p.id) && !liveNames.has(p.name.trim().toLowerCase()))
    .map(p => versionSynced ? p : { ...p, is_active: false });

  const canonicalLive = LIVE_PROGRAMMES.map(lp => {
    const existing = existingLive.find(p => p.id === lp.id || p.name.trim().toLowerCase() === lp.name.trim().toLowerCase());
    if (!existing) return lp;
    return {
      ...existing,
      approx_weight_label: existing.approx_weight_label ?? lp.approx_weight_label,
      supports_weight_timeline: existing.supports_weight_timeline ?? lp.supports_weight_timeline,
    };
  });

  if (!versionSynced && nonLive.length > 0) {
    try { localStorage.setItem(PROGRAMMES_VERSION_KEY, LIVE_PROGRAMMES_VERSION); } catch { /* ignore */ }
  }

  return { ...d, programmes: [...canonicalLive, ...nonLive] };
}

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const nowIso = () => new Date().toISOString();
const today = () => nowIso().split('T')[0];

/** Next reference like `PREFIX-2026-000123`, based on the highest existing ref this year. */
export function nextRef(prefix: string, existing: string[], pad: number): string {
  const y = new Date().getFullYear();
  const re = new RegExp(`^${prefix}-${y}-(\\d+)$`);
  let max = 0;
  for (const r of existing) {
    const m = re.exec(r);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${y}-${String(max + 1).padStart(pad, '0')}`;
}

/** Normalise a string for comparison: trim, lowercase, remove extra spaces. */
export function normaliseForMatch(s: string): string {
  return normaliseName(s);
}

/** Main order lifecycle, in order. Off-flow states (rejected/cancelled/refunded) are handled separately. */
const ORDER_FLOW: OrderStatus[] = [
  'draft', 'pending_payment', 'payment_submitted', 'payment_under_review', 'payment_verified',
  'confirmed', 'animal_allocated', 'animal_growing', 'final_inspection', 'qurban_complete',
  'processing', 'shipped', 'arrived', 'delivery_scheduled', 'out_for_delivery', 'delivered',
  'certificate_generated', 'completed',
];

/** Position of an order status in the lifecycle (-1 for cancelled/refunded). */
export function orderRank(s: OrderStatus): number {
  if (s === 'payment_rejected') return ORDER_FLOW.indexOf('payment_submitted');
  return ORDER_FLOW.indexOf(s);
}
const R = (s: OrderStatus) => ORDER_FLOW.indexOf(s);

const ANIMAL_FLOW: AnimalStatus[] = [
  'available', 'reserved', 'allocated', 'growing', 'inspection_pending',
  'inspection_passed', 'qurban_ready', 'slaughtered', 'processed', 'completed',
];
const animalRank = (s: AnimalStatus) => ANIMAL_FLOW.indexOf(s);

const DELIVERY_FLOW: DeliveryStatus[] = ['pending', 'scheduled', 'out_for_delivery', 'delivered'];
const deliveryRank = (s: DeliveryStatus) => Math.max(0, DELIVERY_FLOW.indexOf(s));

const fullName = (p: { first_name: string; last_name: string }) => `${p.first_name} ${p.last_name}`.trim();
const norm = (s: string) => s.trim().toLowerCase();

function paymentStatusFor(s: OrderStatus): PaymentStatus | null {
  switch (s) {
    case 'draft':                return null;
    case 'pending_payment':      return 'pending';
    case 'payment_submitted':    return 'submitted';
    case 'payment_under_review': return 'under_review';
    case 'payment_rejected':     return 'rejected';
    case 'cancelled':            return 'cancelled';
    case 'refunded':             return 'refunded';
    default:                     return R(s) >= R('payment_verified') ? 'verified' : null;
  }
}

function animalStatusFor(s: OrderStatus): AnimalStatus | null {
  if (s === 'animal_allocated') return 'allocated';
  if (s === 'animal_growing') return 'growing';
  if (s === 'final_inspection') return 'inspection_pending';
  if (s === 'delivered' || s === 'certificate_generated' || s === 'completed') return 'completed';
  if (s === 'processing' || s === 'shipped' || s === 'arrived' || s === 'delivery_scheduled' || s === 'out_for_delivery') return 'processed';
  if (R(s) >= R('qurban_complete')) return 'slaughtered';
  return null;
}

function orderStatusForAnimal(s: AnimalStatus): OrderStatus | null {
  switch (s) {
    case 'allocated':          return 'animal_allocated';
    case 'growing':            return 'animal_growing';
    case 'inspection_pending': return 'final_inspection';
    case 'inspection_passed':  return 'final_inspection';
    case 'qurban_ready':       return 'final_inspection';
    case 'slaughtered':        return 'qurban_complete';
    case 'processed':          return 'processing';
    case 'completed':          return 'completed';
    default:                   return null;
  }
}

function deliveryStatusFor(s: OrderStatus): DeliveryStatus | null {
  if (s === 'delivery_scheduled') return 'scheduled';
  if (s === 'out_for_delivery') return 'out_for_delivery';
  if (R(s) >= R('delivered')) return 'delivered';
  return null;
}

const ANIMAL_KEYWORDS: AnimalType[] = ['cow', 'sheep', 'camel', 'buffalo', 'lamb', 'goat'];

function inferAnimalType(d: AppData, programmeName: string): AnimalType {
  const prog = d.programmes.find(p => norm(p.name) === norm(programmeName));
  if (prog) return prog.animal_type;
  const lower = programmeName.toLowerCase();
  return ANIMAL_KEYWORDS.find(k => lower.includes(k)) ?? 'goat';
}

function programmeCountry(d: AppData, programmeName: string): string {
  const prog = d.programmes.find(p => norm(p.name) === norm(programmeName));
  if (prog) return prog.country;
  return programmeName.split('—')[1]?.trim() || '';
}

function makeLog(actor: Actor, action: string, entity: string, entityId: string | null, description: string): AppAuditLog {
  return {
    id: uid(), actor_email: actor.email, actor_role: actor.role,
    action, entity, entity_id: entityId, description, created_at: nowIso(),
  };
}

function withLog(d: AppData, actor: Actor, action: string, entity: string, entityId: string | null, desc: string): AppData {
  return { ...d, auditLogs: [makeLog(actor, action, entity, entityId, desc), ...d.auditLogs].slice(0, MAX_AUDIT_LOGS) };
}

function withException(
  d: AppData, actor: Actor,
  e: Pick<AppException, 'severity' | 'category' | 'title' | 'description' | 'related_entity' | 'related_entity_id'>,
): AppData {
  // Don't duplicate an open exception for the same entity + title
  if (d.exceptions.some(x => x.related_entity_id === e.related_entity_id && x.title === e.title && (x.status === 'open' || x.status === 'in_progress'))) return d;
  const ex: AppException = { ...e, id: uid(), status: 'open', assigned_to: null, created_at: nowIso(), resolution: null };
  return withLog({ ...d, exceptions: [ex, ...d.exceptions] }, actor, 'exception.created', 'exception', ex.id, `Exception raised: ${e.title}`);
}

// ─────────────────────────────────────────────────────────────
// Order → related records sync (pure)
// ─────────────────────────────────────────────────────────────

function syncRelated(input: AppData, o: AppOrder, actor: Actor): AppData {
  let d = input;
  const r = orderRank(o.status);
  const isCancelled = o.status === 'cancelled' || o.status === 'refunded';

  // ── Payment ──────────────────────────────────────────────
  const rawWantPay = paymentStatusFor(o.status);
  const hasPartialInstallment =
    o.payment_method === 'installment' &&
    (o.installments_paid ?? 0) > 0 &&
    (o.installments_paid ?? 0) < (o.installment_count ?? 2);
  const wantPay: PaymentStatus | null =
    hasPartialInstallment && rawWantPay === 'pending' ? 'submitted' : rawWantPay;
  const pay = d.payments.find(p => p.order_ref === o.order_ref);
  const desiredMethod = o.payment_method ?? pay?.method ?? 'paynow';
  if (pay) {
    const nextPayStatus = wantPay ?? pay.status;
    const installmentChanged =
      pay.installment_count !== o.installment_count ||
      pay.installments_paid !== o.installments_paid ||
      JSON.stringify(pay.installment_schedule ?? null) !== JSON.stringify(o.installment_schedule ?? null);
    if (
      pay.status !== nextPayStatus ||
      pay.amount !== o.total_amount ||
      pay.participant !== o.participant ||
      pay.method !== desiredMethod ||
      installmentChanged
    ) {
      const submittedLike = nextPayStatus === 'submitted' || nextPayStatus === 'under_review' || nextPayStatus === 'verified';
      const updated: AppPayment = {
        ...pay,
        status: nextPayStatus,
        amount: o.total_amount,
        participant: o.participant,
        method: desiredMethod,
        installment_count: o.installment_count,
        installments_paid: o.installments_paid,
        installment_schedule: o.installment_schedule,
        submitted_at: submittedLike ? pay.submitted_at ?? nowIso() : nextPayStatus === 'pending' ? null : pay.submitted_at,
        verified_at: nextPayStatus === 'verified' ? pay.verified_at ?? nowIso() : nextPayStatus === 'refunded' ? pay.verified_at : null,
      };
      d = { ...d, payments: d.payments.map(p => p.id === pay.id ? updated : p) };
      if (pay.status !== nextPayStatus) {
        d = withLog(d, actor, `payment.${nextPayStatus}`, 'payment', pay.payment_ref, `Payment ${pay.payment_ref} → ${nextPayStatus.replace(/_/g, ' ')} (order ${o.order_ref})`);
      }
    }
  } else if (wantPay && !isCancelled) {
    const ref = nextRef('PAY', d.payments.map(p => p.payment_ref), 6);
    const submittedLike = wantPay === 'submitted' || wantPay === 'under_review' || wantPay === 'verified';
    const newPayment: AppPayment = {
      id: uid(),
      payment_ref: ref,
      order_ref: o.order_ref,
      participant: o.participant,
      amount: o.total_amount,
      currency: o.currency,
      method: o.payment_method ?? 'paynow',
      status: wantPay,
      submitted_at: submittedLike ? nowIso() : null,
      verified_at: wantPay === 'verified' ? nowIso() : null,
      bank: null,
      notes: null,
      proof_url: null,
      rejection_reason: null,
      installment_count: o.installment_count,
      installments_paid: o.installments_paid,
      installment_schedule: o.installment_schedule,
    };
    d = { ...d, payments: [newPayment, ...d.payments] };
    d = withLog(d, actor, 'payment.created', 'payment', ref, `Payment ${ref} created for order ${o.order_ref} (${wantPay.replace(/_/g, ' ')})`);
  }

  // ── Animal ───────────────────────────────────────────────
  const linkedAll = d.animals.filter(a => a.order_ref === o.order_ref || (o.id && a.order_id === o.id));
  if (isCancelled) {
    for (const linked of linkedAll) {
      if (['slaughtered', 'processed', 'completed'].includes(linked.status)) continue;
      if (linked.animal_code) {
        // Order-specific animal (ANM-xxxxx-NN): retain order_ref & qurban_name_holder so no orphan/duplicate occurs
        if (linked.status !== 'reserved') {
          d = {
            ...d,
            animals: d.animals.map(a => a.id === linked.id ? { ...a, status: 'reserved' as AnimalStatus } : a),
          };
          d = withLog(d, actor, 'animal.released', 'animal', linked.animal_ref, `Animal ${linked.animal_ref} held as cancelled-order stock for ${o.order_ref}`);
        }
      } else {
        d = {
          ...d,
          animals: d.animals.map(a => a.id === linked.id
            ? { ...a, status: 'available' as AnimalStatus, order_ref: undefined, qurban_name_holder: undefined }
            : a),
        };
        d = withLog(d, actor, 'animal.released', 'animal', linked.animal_ref, `Animal ${linked.animal_ref} released from cancelled order ${o.order_ref}`);
      }
    }
  } else if (r >= R('animal_allocated')) {
    const want = animalStatusFor(o.status) ?? 'allocated';
    if (linkedAll.length === 0) {
      const type = inferAnimalType(d, o.programme);
      const prog = d.programmes.find(p => (o.programme_id && p.id === o.programme_id) || norm(p.name) === norm(o.programme));
      const shareMeta = getProgrammeShareMetadata(o.programme, prog?.animals_per_share);
      const count = Math.max(1, o.quantity || 1);
      for (let i = 0; i < count; i++) {
        const animalCode = animalCodeForOrder(o.order_ref, i);
        if (d.animals.some(a => a.animal_code === animalCode || a.animal_ref === animalCode)) continue;
        const placeholder: AppAnimal = {
          id: uid(),
          animal_ref: animalCode,
          animal_code: animalCode,
          animal_type: type,
          breed: 'To be assigned',
          gender: 'male',
          status: want,
          current_weight_kg: 0,
          min_weight_kg: type === 'cow' || type === 'buffalo' ? 350 : type === 'camel' ? 300 : 25,
          location: o.programme_country || programmeCountry(d, o.programme) || 'TBD',
          supplier: 'To be assigned',
          created_at: nowIso(),
          tag_number: 'Pending',
          order_id: o.id,
          order_ref: o.order_ref,
          qurban_name_holder: o.participant,
          programme: o.programme,
          programme_id: prog?.id ?? o.programme_id,
          service_type: o.service_type ?? 'qurban',
          delivery_portion: o.delivery_portion ?? null,
          animals_per_share: shareMeta.animals_per_share,
          share_ratio: shareMeta.share_ratio,
        };
        d = { ...d, animals: [...d.animals, placeholder] };
        d = withLog(d, actor, 'animal.allocated', 'animal', animalCode, `Animal ${animalCode} created and allocated to order ${o.order_ref}`);
      }
    } else {
      for (const linked of linkedAll) {
        if (linked.status === 'rejected' || animalRank(want) <= animalRank(linked.status)) continue;
        d = { ...d, animals: d.animals.map(a => a.id === linked.id ? { ...a, status: want } : a) };
        d = withLog(d, actor, 'animal.status_changed', 'animal', linked.animal_ref, `Animal ${linked.animal_ref} → ${want.replace(/_/g, ' ')}`);
      }
    }
  }

  // ── Delivery ─────────────────────────────────────────────
  const del = d.deliveries.find(x => x.order_ref === o.order_ref);
  if (isCancelled) {
    if (del && del.status !== 'delivered' && del.status !== 'cancelled') {
      d = { ...d, deliveries: d.deliveries.map(x => x.id === del.id ? { ...x, status: 'cancelled' as DeliveryStatus } : x) };
      d = withLog(d, actor, 'delivery.cancelled', 'delivery', del.delivery_ref, `Delivery ${del.delivery_ref} cancelled with order ${o.order_ref}`);
    }
  } else {
    const want = deliveryStatusFor(o.status);
    if (want) {
      if (!del) {
        const ref = nextRef('DEL', d.deliveries.map(x => x.delivery_ref), 3);
        const participant = d.participants.find(p => norm(fullName(p)) === norm(o.participant));
        const newDelivery: AppDelivery = {
          id: uid(),
          delivery_ref: ref,
          order_ref: o.order_ref,
          participant: o.recipient || o.participant,
          contact_phone: o.contact_number || participant?.phone || '',
          status: want,
          scheduled_date: today(),
          delivered_at: want === 'delivered' ? nowIso() : null,
          address: 'Address not provided — please update',
          driver: null,
          delivery_slot: null,
        };
        d = { ...d, deliveries: [newDelivery, ...d.deliveries] };
        d = withLog(d, actor, 'delivery.created', 'delivery', ref, `Delivery ${ref} created for order ${o.order_ref}`);
      } else if (deliveryRank(want) > deliveryRank(del.status) || ['failed', 'returned', 'cancelled'].includes(del.status)) {
        d = {
          ...d,
          deliveries: d.deliveries.map(x => x.id === del.id
            ? { ...x, status: want, delivered_at: want === 'delivered' ? x.delivered_at ?? nowIso() : x.delivered_at }
            : x),
        };
        d = withLog(d, actor, 'delivery.status_changed', 'delivery', del.delivery_ref, `Delivery ${del.delivery_ref} → ${want.replace(/_/g, ' ')}`);
      }
    }
  }

  // ── Certificate (1 per Qurban animal/holder under the Order Reference) ──
  if (!isCancelled && r >= R('qurban_complete')) {
    const orderAnimals = d.animals
      .filter(a => a.order_ref === o.order_ref)
      .sort((a, b) => (a.animal_code ?? a.animal_ref).localeCompare(b.animal_code ?? b.animal_ref));
    const shouldBeGenerated = r >= R('certificate_generated');
    const prog = d.programmes.find(p => (o.programme_id && p.id === o.programme_id) || norm(p.name) === norm(o.programme));
    const templateType = selectCertificateTemplate(o.programme, o.programme_id ?? prog?.id, prog?.supports_weight_timeline);
    const serviceType = o.service_type ?? 'qurban';
    const countryName = o.programme_country || programmeCountry(d, o.programme);
    const code = () => Math.random().toString(36).slice(2, 6).toUpperCase();

    if (orderAnimals.length > 0) {
      for (let i = 0; i < orderAnimals.length; i++) {
        const animal = orderAnimals[i];
        const holder = (animal.qurban_name_holder || o.participant).trim();
        const existingCert =
          d.certificates.find(c => c.order_ref === o.order_ref && c.animal_ref === animal.animal_ref) ??
          (i === 0
            ? d.certificates.find(c => c.order_ref === o.order_ref && (c.animal_ref === 'Pending' || !orderAnimals.some(a => a.animal_ref === c.animal_ref)))
            : undefined);

        if (!existingCert) {
          const ref = nextRef('CERT', d.certificates.map(c => c.certificate_ref), 5);
          const type = animal.animal_type ?? inferAnimalType(d, o.programme);
          const newCert: AppCertificate = {
            id: uid(),
            certificate_ref: ref,
            order_ref: o.order_ref,
            participant_name: o.participant,
            qurban_name_holder: holder,
            programme_name: o.programme,
            programme_id: o.programme_id ?? prog?.id,
            country: countryName,
            animal_ref: animal.animal_ref,
            animal_type: type,
            animal_label: type.charAt(0).toUpperCase() + type.slice(1),
            qurban_date: prog?.qurban_date || today(),
            status: shouldBeGenerated ? 'generated' : 'not_generated',
            generated_at: shouldBeGenerated ? nowIso() : null,
            sent_at: null,
            verification_code: `AIGCERT-${code()}-${code()}`,
            year: String(new Date().getFullYear()),
            template_type: templateType,
            service_type: serviceType,
          };
          d = { ...d, certificates: [newCert, ...d.certificates] };
          d = withLog(d, actor, 'certificate.created', 'certificate', ref, `Certificate ${ref} created for ${holder} (${animal.animal_ref})`);
        } else {
          const patch: Partial<AppCertificate> = {};
          if (existingCert.animal_ref !== animal.animal_ref) patch.animal_ref = animal.animal_ref;
          if (existingCert.qurban_name_holder !== holder) patch.qurban_name_holder = holder;
          if (existingCert.template_type !== templateType) patch.template_type = templateType;
          if (existingCert.service_type !== serviceType) patch.service_type = serviceType;
          if (shouldBeGenerated && existingCert.status === 'not_generated') {
            patch.status = 'generated';
            patch.generated_at = nowIso();
          }
          if (Object.keys(patch).length) {
            d = { ...d, certificates: d.certificates.map(c => c.id === existingCert.id ? { ...c, ...patch } : c) };
          }
        }
      }
    } else {
      const cert = d.certificates.find(c => c.order_ref === o.order_ref);
      if (!cert) {
        const ref = nextRef('CERT', d.certificates.map(c => c.certificate_ref), 5);
        const type = inferAnimalType(d, o.programme);
        const newCert: AppCertificate = {
          id: uid(),
          certificate_ref: ref,
          order_ref: o.order_ref,
          participant_name: o.participant,
          qurban_name_holder: o.participant,
          programme_name: o.programme,
          programme_id: o.programme_id ?? prog?.id,
          country: countryName,
          animal_ref: 'Pending',
          animal_type: type,
          animal_label: type.charAt(0).toUpperCase() + type.slice(1),
          qurban_date: prog?.qurban_date || today(),
          status: shouldBeGenerated ? 'generated' : 'not_generated',
          generated_at: shouldBeGenerated ? nowIso() : null,
          sent_at: null,
          verification_code: `AIGCERT-${code()}-${code()}`,
          year: String(new Date().getFullYear()),
          template_type: templateType,
          service_type: serviceType,
        };
        d = { ...d, certificates: [newCert, ...d.certificates] };
        d = withLog(d, actor, 'certificate.created', 'certificate', ref, `Certificate ${ref} created for ${o.participant}`);
      } else {
        const patch: Partial<AppCertificate> = {};
        if (cert.template_type !== templateType) patch.template_type = templateType;
        if (cert.service_type !== serviceType) patch.service_type = serviceType;
        if (shouldBeGenerated && cert.status === 'not_generated') { patch.status = 'generated'; patch.generated_at = nowIso(); }
        if (Object.keys(patch).length) {
          d = { ...d, certificates: d.certificates.map(c => c.id === cert.id ? { ...c, ...patch } : c) };
        }
      }
    }
  }

  return d;
}

/** Change an order's status and sync all related records (pure). */
function applyOrderStatus(d: AppData, id: string, status: OrderStatus, actor: Actor): AppData {
  const o = d.orders.find(x => x.id === id);
  if (!o || o.status === status) return d;
  const updated = { ...o, status };
  let next: AppData = { ...d, orders: d.orders.map(x => x.id === id ? updated : x) };
  next = withLog(next, actor, 'order.status_changed', 'order', o.order_ref,
    `Order ${o.order_ref}: ${getStatusLabel(o.status)} → ${getStatusLabel(status)}`);
  return syncRelated(next, updated, actor);
}

const SYSTEM_ACTOR: Actor = { email: 'system', role: 'super_admin' };

const STAFF_SYNC_ROLES: UserRole[] = [
  'super_admin',
  'operations_admin',
  'supplier_manager',
  'field_team',
  'driver',
  'd3_technical_admin',
];

function loadData(): AppData {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return ensureLiveProgrammes(EMPTY);
    const parsed = JSON.parse(raw) as Partial<AppData>;
    const base: AppData = ensureLiveProgrammes({ ...EMPTY, ...parsed });
    // Repair any orders whose related records are missing (idempotent)
    return base.orders.reduce((acc, o) => syncRelated(acc, o, SYSTEM_ACTOR), base);
  } catch {
    return ensureLiveProgrammes(EMPTY);
  }
}

// ─────────────────────────────────────────────────────────────
// Context shape
// ─────────────────────────────────────────────────────────────

type AppDataContextType = AppData & {
  // Order actions
  addOrder: (o: NewOrderInput) => AppOrder;
  updateOrder: (id: string, patch: UpdateOrderInput) => AppOrder;
  updateOrderStatus: (id: string, status: OrderStatus) => void;
  cancelOrder: (id: string) => void;
  deleteOrder: (id: string) => void;
  markOrderInvoiceSent: (orderId: string, providerRef?: string) => void;

  // Animal actions
  addAnimal: (a: AppAnimal) => void;
  updateAnimal: (id: string, patch: Partial<AppAnimal>) => void;
  updateAnimalStatus: (id: string, status: AnimalStatus) => void;

  // Payment actions
  addPayment: (p: AppPayment) => void;
  verifyPayment: (id: string) => void;
  rejectPayment: (id: string, reason?: string) => void;
  recordInstallmentPayment: (orderId: string, paidDateIso?: string) => void;
  sendInstallmentReminder: (orderId: string) => Promise<void>;

  // Delivery actions
  updateDeliveryStatus: (id: string, status: DeliveryStatus) => void;
  updateDelivery: (id: string, patch: Partial<AppDelivery>) => void;

  // Certificate actions
  updateCertStatus: (id: string, status: CertificateStatus) => void;

  // Participant actions
  addParticipant: (p: AppParticipant) => void;
  updateParticipant: (id: string, patch: Partial<AppParticipant>) => void;

  // Supplier actions
  addSupplier: (s: AppSupplier) => void;
  updateSupplier: (s: AppSupplier) => void;

  // Programme actions
  addProgramme: (p: AppProgramme) => void;
  updateProgramme: (p: AppProgramme) => void;

  // Exception actions
  resolveException: (id: string, resolution?: string) => void;
  assignException: (id: string, person: string) => void;
};

const AppDataContext = createContext<AppDataContextType | null>(null);
let latestProviderSeq = 0;

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, isAuthenticated } = useAuth();
  const instanceSeqRef = useRef<number>(0);
  if (instanceSeqRef.current === 0) {
    latestProviderSeq += 1;
    instanceSeqRef.current = latestProviderSeq;
  }
  const [data, setData] = useState<AppData>(loadData);
  const dataRef = useRef(data);
  // Keep a snapshot of what is persisted to Supabase so we only sync diffs
  const supabaseSnapshotRef = useRef<AppData | null>(null);
  const supabaseSyncing = useRef(false);
  const supabaseSyncPending = useRef(false);

  const actorRef = useRef<Actor>(SYSTEM_ACTOR);
  actorRef.current = {
    email: profile?.email ?? user?.email ?? 'admin',
    role: profile?.role ?? 'super_admin',
  };
  const isStaffActor = Boolean(user && (!profile || STAFF_SYNC_ROLES.includes(profile.role)));

  // ── On authenticated mount/sign-in: load from Supabase (never query anon tables on /login or /verify) ──
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      supabaseSnapshotRef.current = null;
      return;
    }
    let cancelled = false;
    loadFromSupabase().then(remote => {
      if (cancelled || !remote) return;
      // Merge: remote takes priority if it has any rows, else keep local
      const hasRemoteData = Object.values(remote).some((arr) => (arr as unknown[]).length > 0);
      if (!hasRemoteData) {
        if (!isStaffActor) return;
        // No remote data yet — push local data up to Supabase (staff only)
        const local = dataRef.current;
        supabaseSnapshotRef.current = local;
        syncToSupabase(
          { orders: [], animals: [], payments: [], deliveries: [], certificates: [], participants: [], suppliers: [], programmes: [], exceptions: [], auditLogs: [] },
          local,
        ).catch(console.error);
        return;
      }
      const merged: AppData = ensureLiveProgrammes({
        ...EMPTY,
        ...remote,
        programmes: remote.programmes.length > 0 ? remote.programmes : EMPTY.programmes,
      });
      supabaseSnapshotRef.current = merged;
      dataRef.current = merged;
      setData(merged);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch { /* noop */ }
    }).catch(console.error);
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  /** Apply a pure transformation to the latest state. */
  const commit = useCallback((fn: (d: AppData, actor: Actor) => AppData) => {
    const prev = dataRef.current;
    const next = fn(prev, actorRef.current);
    if (next === prev) return;
    dataRef.current = next;
    setData(next);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
    } catch { /* storage full / unavailable */ }
  }, []);

  // Persist to localStorage
  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch { /* storage full / unavailable */ }
  }, [data]);

  // Sync to Supabase on every data change without dropping concurrent mutations (staff only)
  const flushSupabaseSync = useCallback(() => {
    if (!isStaffActor) return;
    if (supabaseSyncing.current) {
      supabaseSyncPending.current = true;
      return;
    }
    const prev = supabaseSnapshotRef.current;
    if (!prev) return; // Not yet initialised from Supabase
    const next = dataRef.current;
    if (prev === next) return;
    supabaseSyncing.current = true;
    supabaseSnapshotRef.current = next;
    syncToSupabase(prev, next)
      .catch(console.error)
      .finally(() => {
        supabaseSyncing.current = false;
        if (supabaseSyncPending.current) {
          supabaseSyncPending.current = false;
          flushSupabaseSync();
        }
      });
  }, [isStaffActor]);

  useEffect(() => {
    flushSupabaseSync();
  }, [data, flushSupabaseSync]);

  // Keep multiple open tabs in sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const next: AppData = ensureLiveProgrammes({ ...EMPTY, ...(JSON.parse(e.newValue) as Partial<AppData>) });
        dataRef.current = next;
        setData(next);
      } catch { /* ignore malformed */ }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // ── Orders ────────────────────────────────────────────────
  const addOrder = useCallback((input: NewOrderInput): AppOrder => {
    const d0 = dataRef.current;

    // ── Idempotency guard (prevents duplicate orders/participants/animals on double submit) ──
    const reqId = input.client_request_id?.trim();
    if (reqId) {
      const existingByReq = d0.orders.find(o => o.client_request_id === reqId);
      if (existingByReq) return existingByReq;
    }

    // Resolve canonical programme from configured list
    const matchedProg = d0.programmes.find(
      p =>
        (input.programme_id && p.id === input.programme_id) ||
        normaliseName(p.name) === normaliseName(input.programme ?? ''),
    );
    const canonicalProgramme = matchedProg?.name ?? (input.programme ?? '').trim();
    const canonicalProgId = matchedProg?.id ?? input.programme_id;
    const canonicalCountry = matchedProg?.country || input.programme_country || programmeCountry(d0, canonicalProgramme);

    // ── Data-layer validation (mirrors UI + DB triggers; never trust form alone) ──
    const validation = validateOrderCandidate(
      {
        order_ref: input.order_ref,
        full_name: input.full_name,
        email: input.email,
        contact_number: input.contact_number,
        programme: canonicalProgramme,
        programme_id: canonicalProgId,
        programme_country: canonicalCountry,
        service_type: input.service_type,
        payment_method: input.payment_method,
        delivery_portion: input.delivery_portion ?? null,
        quantity: input.quantity,
        total_amount: input.total_amount,
        qurban_entries: input.qurban_entries,
      },
      {
        existingOrderRefs: d0.orders.map(o => o.order_ref),
        knownProgrammes: d0.programmes,
      },
    );
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // ── Participant matching: Full Name + Email Address + Contact Number ──
    let matchedParticipant = d0.participants.find(p =>
      participantsMatch(
        {
          full_name: input.full_name,
          email: input.email,
          contact_number: input.contact_number,
        },
        p,
      ),
    );

    let participantId: string;
    let participantName: string;
    let createdNewParticipant = false;

    if (matchedParticipant) {
      participantId = matchedParticipant.id;
      participantName = participantFullName(matchedParticipant);
    } else {
      const split = splitFullName(input.full_name);
      const trimmedEmail = input.email.trim();
      const trimmedPhone = input.contact_number.trim();
      matchedParticipant = {
        id: uid(),
        participant_ref: nextRef('PRT', d0.participants.map(p => p.participant_ref), 3),
        first_name: split.first_name,
        last_name: split.last_name,
        full_name: split.full_name,
        email: trimmedEmail,
        phone: trimmedPhone,
        contact_number: trimmedPhone,
        ic_number: '',
        country: 'Singapore',
        orders_count: 0,
        total_spent: 0,
        is_active: true,
        portal_access: true, // Provision participant portal access per existing auth architecture
        created_at: nowIso(),
      };
      participantId = matchedParticipant.id;
      participantName = split.full_name;
      createdNewParticipant = true;
    }
    const participantRecord = matchedParticipant;

    // ── Unique Order Reference (confirmed custom ref or next sequential ORD-NNNNN) ──
    const orderRef = input.order_ref?.trim()
      ? normaliseOrderRef(input.order_ref)
      : nextOrderRef(d0.orders.map(o => o.order_ref));
    const targetStatus: OrderStatus = input.status ?? 'pending_payment';

    const orderCurrency = input.currency ?? matchedProg?.currency ?? 'SGD';
    const shouldSendConfirmationOnce = targetStatus !== 'draft';
    const isInstallment = input.payment_method === 'installment';
    const installmentCount = isInstallment
      ? Math.max(2, Math.min(6, Math.round(input.installment_count ?? 2)))
      : undefined;
    const installmentSchedule = isInstallment && installmentCount
      ? buildInstallmentSchedule(input.total_amount, installmentCount, nowIso(), orderCurrency)
      : undefined;
    const order: AppOrder = {
      id: uid(),
      order_ref: orderRef,
      order_reference: orderRef,
      participant: participantName,
      participant_id: participantId,
      contact_number: input.contact_number.trim(),
      email: input.email.trim(),
      programme: canonicalProgramme,
      programme_id: canonicalProgId,
      programme_country: canonicalCountry,
      service_type: input.service_type,
      payment_method: input.payment_method,
      ...(isInstallment
        ? {
            installment_count: installmentCount,
            installments_paid: 0,
            installment_schedule: installmentSchedule,
          }
        : {}),
      delivery_portion: validation.normalizedPortion,
      quantity: input.quantity,
      number_of_qurbans: input.quantity,
      total_amount: input.total_amount,
      currency: orderCurrency,
      status: targetStatus,
      created_at: nowIso(),
      notes: input.notes?.trim() || undefined,
      client_request_id: reqId || undefined,
      // Phase 4.8: Do NOT initialize confirmation_email_sent_at until real email provider accepts submission
      confirmation_email_sent_at: null,
      confirmation_email_status: shouldSendConfirmationOnce ? 'queued' : 'not_sent',
      confirmation_email_provider_ref: null,
      confirmation_email_idempotency_key: `invoice:${orderRef}`,
    };

    // ── Create 1..N animals linked to the SAME Order Reference ──
    const animalType = matchedProg?.animal_type ?? inferAnimalType(d0, canonicalProgramme);
    const initialAnimalStatus: AnimalStatus = animalStatusFor(targetStatus) ?? 'reserved';
    const minWeight = animalType === 'cow' || animalType === 'buffalo' ? 350 : animalType === 'camel' ? 300 : 25;
    const approxWeightLabel =
      matchedProg?.approx_weight_label || defaultApproxWeight(canonicalProgramme, animalType);
    const shareMeta = getProgrammeShareMetadata(canonicalProgramme, matchedProg?.animals_per_share);

    const newAnimals: AppAnimal[] = input.qurban_entries.map((entry, i) => {
      const animalCode = animalCodeForOrder(orderRef, i);
      return {
        id: uid(),
        animal_ref: animalCode,
        animal_code: animalCode,
        animal_type: animalType,
        breed: 'To be assigned',
        gender: 'male',
        status: initialAnimalStatus,
        current_weight_kg: 0,
        min_weight_kg: minWeight,
        approx_weight: approxWeightLabel,
        weight_history: [],
        location: canonicalCountry || 'TBD',
        supplier: 'To be assigned',
        created_at: nowIso(),
        tag_number: 'Pending',
        order_id: order.id,
        order_ref: orderRef,
        qurban_name_holder: entry.qurban_name_holder.trim(),
        programme: canonicalProgramme,
        programme_id: canonicalProgId,
        service_type: input.service_type,
        delivery_portion: validation.normalizedPortions[i] ?? validation.normalizedPortion,
        animals_per_share: shareMeta.animals_per_share,
        share_ratio: shareMeta.share_ratio,
      };
    });

    commit((d, actor) => {
      // Secondary atomic idempotency check inside commit
      if (reqId && d.orders.some(o => o.client_request_id === reqId)) return d;
      if (d.orders.some(o => normaliseOrderRef(o.order_ref).toLowerCase() === orderRef.toLowerCase())) return d;

      let next: AppData = { ...d };

      // Add participant only if not already present (3-field normalized check)
      const dupParticipant = next.participants.find(
        p =>
          p.id === participantId ||
          participantsMatch(
            {
              full_name: input.full_name,
              email: input.email,
              contact_number: input.contact_number,
            },
            p,
          ),
      );

      let finalOrder = order;
      if (!dupParticipant) {
        // Phase 2.2: Detect ambiguous identity conflicts (email or phone matches existing differently named participant)
        const identityConflicts = detectParticipantIdentityConflicts(
          {
            full_name: input.full_name,
            email: input.email,
            contact_number: input.contact_number,
          },
          next.participants,
        );

        next = { ...next, participants: [participantRecord, ...next.participants] };
        next = withLog(
          next,
          actor,
          'participant.created',
          'participant',
          participantRecord.participant_ref,
          `Participant ${participantName} created with portal access enabled during order ${orderRef}`,
        );

        if (identityConflicts.length > 0) {
          next = withException(next, actor, {
            severity: 'medium',
            category: 'Participant',
            title: `Participant identity conflict for review (${orderRef})`,
            description: identityConflicts.map(c => c.summary).join(' '),
            related_entity: 'participant',
            related_entity_id: participantRecord.participant_ref,
          });
        }
      } else if (dupParticipant.id !== participantId) {
        finalOrder = {
          ...order,
          participant_id: dupParticipant.id,
          participant: participantFullName(dupParticipant),
        };
      }

      // Add order
      next = { ...next, orders: [finalOrder, ...next.orders] };
      next = withLog(
        next,
        actor,
        'order.created',
        'order',
        finalOrder.order_ref,
        `Order ${finalOrder.order_ref} created for ${finalOrder.participant} (${input.quantity} ${input.service_type}, ${canonicalProgramme})`,
      );

      // Add animals in 01..NN order (idempotent: skip if animal_code already exists)
      const animalsToInsert = newAnimals.filter(
        animal => !next.animals.some(a => a.animal_code === animal.animal_code || a.animal_ref === animal.animal_ref),
      );
      if (animalsToInsert.length > 0) {
        next = { ...next, animals: [...animalsToInsert, ...next.animals] };
        for (const animal of animalsToInsert) {
          next = withLog(
            next,
            actor,
            'animal.registered',
            'animal',
            animal.animal_ref,
            `Animal ${animal.animal_ref} created for order ${orderRef} — Qurban Name Holder: ${animal.qurban_name_holder}`,
          );
        }
      }

      // Sync linked Payment / Delivery / Certificate for targetStatus
      next = syncRelated(next, finalOrder, actor);
      return next;
    });

    if (shouldSendConfirmationOnce) {
      // Confirmed Communication Rule:
      // 1. Order Confirmation & Invoice sent ONCE to Email (never re-sent on edit/refresh)
      // 2. Order & Payment confirmation also sent via WhatsApp (+6585456783)
      // 3. Phase 4.8: Stamp confirmation_email_sent_at ONLY when real live email provider accepts submission
      void notificationService
        .notifyOrderCreatedAndInvoice({
          recipient: {
            name: participantName,
            email: input.email.trim(),
            phone: input.contact_number.trim(),
          },
          orderRef,
          programme: canonicalProgramme,
          serviceTypeLabel: formatServiceType(input.service_type),
          quantity: input.quantity,
          totalFormatted: `${orderCurrency} ${input.total_amount.toLocaleString()}`,
          paymentMethodLabel: formatPaymentMethod(input.payment_method),
          alreadySentEmail: false,
        })
        .then(res => {
          if (instanceSeqRef.current !== latestProviderSeq) return;
          commit(d => ({
            ...d,
            orders: d.orders.map(o => {
              if (o.order_ref !== orderRef) return o;
              if (res.emailTrulySubmitted) {
                return {
                  ...o,
                  confirmation_email_sent_at: o.confirmation_email_sent_at ?? nowIso(),
                  confirmation_email_status: 'sent',
                  confirmation_email_provider_ref: res.emailProviderRef ?? o.confirmation_email_provider_ref ?? null,
                };
              }
              if (res.emailDeliveryState === 'simulated') {
                return {
                  ...o,
                  confirmation_email_status: 'simulated',
                  confirmation_email_provider_ref: res.emailProviderRef ?? o.confirmation_email_provider_ref ?? null,
                };
              }
              if (res.emailDeliveryState === 'failed') {
                return {
                  ...o,
                  confirmation_email_status: 'failed',
                };
              }
              return o;
            }),
          }));
        })
        .catch(() => {});
    } else if (createdNewParticipant) {
      void notificationService
        .sendWhatsAppWithEmailFallback({
          recipient: {
            name: participantName,
            email: input.email.trim(),
            phone: input.contact_number.trim(),
          },
          subject: `Al Ihsan Group — Portal Access Ready (${orderRef})`,
          body: `Assalamu Alaikum ${participantName}, your Participant Portal access is ready for draft order ${orderRef}.`,
        })
        .catch(() => {});
    }

    return dataRef.current.orders.find(o => o.id === order.id || (reqId && o.client_request_id === reqId)) ?? order;
  }, [commit]);

  const updateOrder = useCallback((id: string, patch: UpdateOrderInput): AppOrder => {
    const d0 = dataRef.current;
    const existing = d0.orders.find(o => o.id === id);
    if (!existing) throw new Error('Order not found.');

    const existingAnimals = d0.animals
      .filter(a => a.order_ref === existing.order_ref)
      .sort((a, b) => (a.animal_code ?? a.animal_ref).localeCompare(b.animal_code ?? b.animal_ref));

    const nextFullName = (patch.full_name ?? existing.participant).trim();
    const nextEmail = (patch.email ?? existing.email ?? '').trim();
    const nextPhone = (patch.contact_number ?? existing.contact_number ?? '').trim();

    const matchedProg = d0.programmes.find(
      p =>
        (patch.programme_id && p.id === patch.programme_id) ||
        (patch.programme && normaliseName(p.name) === normaliseName(patch.programme)) ||
        (!patch.programme_id && !patch.programme && existing.programme_id && p.id === existing.programme_id) ||
        (!patch.programme_id && !patch.programme && normaliseName(p.name) === normaliseName(existing.programme)),
    );
    const nextProgramme = matchedProg?.name ?? (patch.programme ?? existing.programme).trim();
    const nextProgId = matchedProg?.id ?? patch.programme_id ?? existing.programme_id;
    const nextCountry =
      matchedProg?.country ||
      patch.programme_country ||
      existing.programme_country ||
      programmeCountry(d0, nextProgramme);

    const nextServiceType = patch.service_type ?? existing.service_type ?? 'qurban';
    const nextPaymentMethod = patch.payment_method ?? existing.payment_method ?? 'paynow';
    const nextQuantity = patch.quantity ?? existing.quantity;
    const nextEntries: QurbanEntry[] =
      patch.qurban_entries ??
      Array.from({ length: nextQuantity }, (_, i) => ({
        qurban_name_holder: existingAnimals[i]?.qurban_name_holder ?? existing.participant,
        delivery_portion: existingAnimals[i]?.delivery_portion ?? existing.delivery_portion ?? null,
      }));
    const nextTotal = patch.total_amount ?? existing.total_amount;
    const candidatePortion =
      patch.delivery_portion !== undefined ? patch.delivery_portion : existing.delivery_portion ?? null;

    const validation = validateOrderCandidate(
      {
        full_name: nextFullName,
        email: nextEmail,
        contact_number: nextPhone,
        programme: nextProgramme,
        programme_id: nextProgId,
        programme_country: nextCountry,
        service_type: nextServiceType,
        payment_method: nextPaymentMethod,
        delivery_portion: candidatePortion,
        quantity: nextQuantity,
        total_amount: nextTotal,
        qurban_entries: nextEntries,
      },
      {
        existingOrderRefs: d0.orders.filter(o => o.id !== id).map(o => o.order_ref),
        knownProgrammes: d0.programmes,
        allowLegacyValues: true,
      },
    );
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Prevent shrinking quantity if excess tail animals were already slaughtered/completed
    if (nextQuantity < existingAnimals.length) {
      const excess = existingAnimals.slice(nextQuantity);
      if (excess.some(a => ['slaughtered', 'processed', 'completed'].includes(a.status))) {
        throw new Error('Cannot reduce Number of Qurbans below animals that have already been processed.');
      }
    }

    commit((d, actor) => {
      const cur = d.orders.find(o => o.id === id);
      if (!cur) return d;

      let next: AppData = { ...d };

      // Resolve participant link without creating duplicates
      let participantId = cur.participant_id;
      let participantName = nextFullName;
      const matchedP = next.participants.find(p =>
        participantsMatch({ full_name: nextFullName, email: nextEmail, contact_number: nextPhone }, p),
      );
      if (matchedP) {
        participantId = matchedP.id;
        participantName = participantFullName(matchedP);
      } else if (cur.participant_id) {
        const sharedWithOtherOrders = next.orders.some(o => o.id !== id && o.participant_id === cur.participant_id);
        if (!sharedWithOtherOrders) {
          const split = splitFullName(nextFullName);
          next = {
            ...next,
            participants: next.participants.map(p =>
              p.id === cur.participant_id
                ? {
                    ...p,
                    first_name: split.first_name,
                    last_name: split.last_name,
                    full_name: split.full_name,
                    email: nextEmail,
                    phone: nextPhone,
                    contact_number: nextPhone,
                  }
                : p,
            ),
          };
          participantName = split.full_name;
        } else {
          const split = splitFullName(nextFullName);
          const createdP: AppParticipant = {
            id: uid(),
            participant_ref: nextRef('PRT', next.participants.map(p => p.participant_ref), 3),
            first_name: split.first_name,
            last_name: split.last_name,
            full_name: split.full_name,
            email: nextEmail,
            phone: nextPhone,
            contact_number: nextPhone,
            ic_number: '',
            country: 'Singapore',
            orders_count: 0,
            total_spent: 0,
            is_active: true,
            portal_access: true,
            created_at: nowIso(),
          };
          participantId = createdP.id;
          participantName = split.full_name;
          next = { ...next, participants: [createdP, ...next.participants] };
        }

        const editConflicts = detectParticipantIdentityConflicts(
          { full_name: nextFullName, email: nextEmail, contact_number: nextPhone },
          next.participants,
          participantId,
        );
        if (editConflicts.length > 0) {
          next = withException(next, actor, {
            severity: 'medium',
            category: 'Participant',
            title: `Participant identity conflict for review (${cur.order_ref})`,
            description: editConflicts.map(c => c.summary).join(' '),
            related_entity: 'order',
            related_entity_id: cur.order_ref,
          });
        }
      }

      const nextIsInstallment = nextPaymentMethod === 'installment';
      const nextCurrency = patch.currency ?? matchedProg?.currency ?? cur.currency;
      const nextInstallmentCount = nextIsInstallment
        ? Math.max(2, Math.min(6, Math.round(patch.installment_count ?? cur.installment_count ?? 2)))
        : undefined;
      const prevPaid = Math.min(cur.installments_paid ?? 0, nextInstallmentCount ?? 0);
      const needsScheduleRebuild =
        nextIsInstallment &&
        (!cur.installment_schedule ||
          cur.installment_count !== nextInstallmentCount ||
          cur.total_amount !== nextTotal ||
          cur.payment_method !== 'installment');
      const nextInstallmentSchedule = nextIsInstallment
        ? needsScheduleRebuild && nextInstallmentCount
          ? buildInstallmentSchedule(nextTotal, nextInstallmentCount, cur.created_at, nextCurrency).map((item, idx) =>
              idx < prevPaid ? { ...item, status: 'verified' as const } : item,
            )
          : cur.installment_schedule
        : undefined;

      const updatedOrder: AppOrder = {
        ...cur,
        participant: participantName,
        participant_id: participantId,
        email: nextEmail,
        contact_number: nextPhone,
        programme: nextProgramme,
        programme_id: nextProgId,
        programme_country: nextCountry,
        service_type: nextServiceType,
        payment_method: nextPaymentMethod,
        installment_count: nextInstallmentCount,
        installments_paid: nextIsInstallment ? prevPaid : undefined,
        installment_schedule: nextInstallmentSchedule,
        delivery_portion: validation.normalizedPortion,
        quantity: nextQuantity,
        number_of_qurbans: nextQuantity,
        total_amount: nextTotal,
        currency: nextCurrency,
        notes: patch.notes !== undefined ? patch.notes.trim() || undefined : cur.notes,
      };

      next = { ...next, orders: next.orders.map(o => (o.id === id ? updatedOrder : o)) };

      // Update animals IN-PLACE (zero duplicate stock entries on edit!)
      const orderAnimals = next.animals
        .filter(a => a.order_ref === cur.order_ref)
        .sort((a, b) => (a.animal_code ?? a.animal_ref).localeCompare(b.animal_code ?? b.animal_ref));

      const programmeChanged = normaliseName(cur.programme) !== normaliseName(nextProgramme);
      const targetAnimalType = matchedProg?.animal_type ?? inferAnimalType(next, nextProgramme);
      const minWeight = targetAnimalType === 'cow' || targetAnimalType === 'buffalo' ? 350 : targetAnimalType === 'camel' ? 300 : 25;
      const nextApproxWeight =
        matchedProg?.approx_weight_label || defaultApproxWeight(nextProgramme, targetAnimalType);
      const nextShareMeta = getProgrammeShareMetadata(nextProgramme, matchedProg?.animals_per_share);

      const removeIds = new Set(orderAnimals.slice(nextQuantity).map(a => a.id));
      const updatedById = new Map<string, AppAnimal>();

      for (let i = 0; i < Math.min(nextQuantity, orderAnimals.length); i++) {
        const existingAnimal = orderAnimals[i];
        const expectedCode = existingAnimal.animal_code || animalCodeForOrder(cur.order_ref, i);
        const unassignedBreed = existingAnimal.breed === 'To be assigned';
        updatedById.set(existingAnimal.id, {
          ...existingAnimal,
          animal_code: expectedCode,
          order_id: cur.id,
          order_ref: cur.order_ref,
          qurban_name_holder: nextEntries[i].qurban_name_holder.trim(),
          programme: nextProgramme,
          programme_id: nextProgId,
          service_type: nextServiceType,
          delivery_portion: validation.normalizedPortions[i] ?? validation.normalizedPortion,
          animals_per_share: nextShareMeta.animals_per_share,
          share_ratio: nextShareMeta.share_ratio,
          approx_weight: programmeChanged ? nextApproxWeight : existingAnimal.approx_weight ?? nextApproxWeight,
          ...(programmeChanged && !isBreedingProgramme(nextProgramme, matchedProg?.supports_weight_timeline)
            ? { weight_history: [] }
            : {}),
          ...(programmeChanged && unassignedBreed
            ? {
                animal_type: targetAnimalType,
                min_weight_kg: minWeight,
                location: nextCountry || existingAnimal.location,
              }
            : {}),
        });
      }

      let syncedAnimals = next.animals
        .filter(a => !removeIds.has(a.id))
        .map(a => updatedById.get(a.id) ?? a);

      // Add additional animals only if Number of Qurbans increased
      if (nextQuantity > orderAnimals.length) {
        const defaultStatus: AnimalStatus = animalStatusFor(updatedOrder.status) ?? 'reserved';
        const added: AppAnimal[] = [];
        for (let i = orderAnimals.length; i < nextQuantity; i++) {
          const code = animalCodeForOrder(cur.order_ref, i);
          if (syncedAnimals.some(a => a.animal_code === code || a.animal_ref === code)) continue;
          added.push({
            id: uid(),
            animal_ref: code,
            animal_code: code,
            animal_type: targetAnimalType,
            breed: 'To be assigned',
            gender: 'male',
            status: defaultStatus,
            current_weight_kg: 0,
            min_weight_kg: minWeight,
            approx_weight: nextApproxWeight,
            weight_history: [],
            location: nextCountry || 'TBD',
            supplier: 'To be assigned',
            created_at: nowIso(),
            tag_number: 'Pending',
            order_id: cur.id,
            order_ref: cur.order_ref,
            qurban_name_holder: nextEntries[i].qurban_name_holder.trim(),
            programme: nextProgramme,
            programme_id: nextProgId,
            service_type: nextServiceType,
            delivery_portion: validation.normalizedPortions[i] ?? validation.normalizedPortion,
            animals_per_share: nextShareMeta.animals_per_share,
            share_ratio: nextShareMeta.share_ratio,
          });
        }
        syncedAnimals = [...added, ...syncedAnimals];
      }

      next = { ...next, animals: syncedAnimals };

      // Keep certificate programme/participant/template aligned if certificates exist
      const nextTemplateType = selectCertificateTemplate(nextProgramme, nextProgId, matchedProg?.supports_weight_timeline);
      next = {
        ...next,
        certificates: next.certificates.map(c =>
          c.order_ref === cur.order_ref
            ? {
                ...c,
                participant_name: updatedOrder.participant,
                programme_name: updatedOrder.programme,
                programme_id: nextProgId,
                country: nextCountry,
                template_type: nextTemplateType,
                service_type: nextServiceType,
              }
            : c,
        ),
      };

      next = withLog(
        next,
        actor,
        'order.updated',
        'order',
        cur.order_ref,
        `Order ${cur.order_ref} updated (${nextQuantity} ${nextServiceType}, ${nextProgramme})`,
      );
      next = syncRelated(next, updatedOrder, actor);
      return next;
    });

    return dataRef.current.orders.find(o => o.id === id)!;
  }, [commit]);

  const markOrderInvoiceSent = useCallback((orderId: string, providerRef?: string) => {
    commit((d, actor) => {
      const target = d.orders.find(o => o.id === orderId || o.order_ref === orderId);
      if (!target) return d;
      if (target.confirmation_email_sent_at && target.confirmation_email_status === 'sent') return d;
      const stamped: AppOrder = {
        ...target,
        confirmation_email_sent_at: target.confirmation_email_sent_at ?? nowIso(),
        confirmation_email_status: 'sent',
        confirmation_email_provider_ref: providerRef ?? target.confirmation_email_provider_ref ?? null,
      };
      return withLog(
        { ...d, orders: d.orders.map(o => (o.id === target.id ? stamped : o)) },
        actor,
        'order.invoice_sent',
        'order',
        target.order_ref,
        `Order confirmation & invoice email verified sent for ${target.order_ref}`,
      );
    });
  }, [commit]);

  const updateOrderStatus = useCallback((id: string, status: OrderStatus) => {
    const prevOrder = dataRef.current.orders.find(o => o.id === id);
    commit((d, actor) => applyOrderStatus(d, id, status, actor));

    const updatedOrder = dataRef.current.orders.find(o => o.id === id);
    if (updatedOrder && prevOrder && prevOrder.status !== status) {
      const recipient = {
        name: updatedOrder.participant,
        email: updatedOrder.email,
        phone: updatedOrder.contact_number,
      };
      // If draft order moves to pending_payment for the first time, send one-time email invoice + WA
      const alreadySentOrQueued =
        Boolean(updatedOrder.confirmation_email_sent_at) ||
        updatedOrder.confirmation_email_status === 'sent' ||
        updatedOrder.confirmation_email_status === 'simulated';
      if (prevOrder.status === 'draft' && !alreadySentOrQueued && status !== 'cancelled') {
        commit(d => ({
          ...d,
          orders: d.orders.map(o => (o.id === id ? { ...o, confirmation_email_status: 'queued' } : o)),
        }));
        void notificationService
          .notifyOrderCreatedAndInvoice({
            recipient,
            orderRef: updatedOrder.order_ref,
            programme: updatedOrder.programme,
            serviceTypeLabel: formatServiceType(updatedOrder.service_type ?? 'qurban'),
            quantity: updatedOrder.quantity,
            totalFormatted: `${updatedOrder.currency} ${updatedOrder.total_amount.toLocaleString()}`,
            paymentMethodLabel: formatPaymentMethod(updatedOrder.payment_method ?? 'paynow'),
            alreadySentEmail: false,
          })
          .then(res => {
            if (instanceSeqRef.current !== latestProviderSeq) return;
            commit(d => ({
              ...d,
              orders: d.orders.map(o => {
                if (o.id !== id) return o;
                if (res.emailTrulySubmitted) {
                  return {
                    ...o,
                    confirmation_email_sent_at: o.confirmation_email_sent_at ?? nowIso(),
                    confirmation_email_status: 'sent',
                    confirmation_email_provider_ref: res.emailProviderRef ?? null,
                  };
                }
                if (res.emailDeliveryState === 'simulated') {
                  return {
                    ...o,
                    confirmation_email_status: 'simulated',
                    confirmation_email_provider_ref: res.emailProviderRef ?? null,
                  };
                }
                return o;
              }),
            }));
          })
          .catch(() => {});
      } else if (status === 'certificate_generated') {
        const cert = dataRef.current.certificates.find(c => c.order_ref === updatedOrder.order_ref);
        void notificationService
          .notifyCertificateReady({
            recipient,
            orderRef: updatedOrder.order_ref,
            certificateRef: cert?.certificate_ref ?? updatedOrder.order_ref,
            programme: updatedOrder.programme,
          })
          .catch(() => {});
      } else if (
        [
          'confirmed',
          'animal_allocated',
          'animal_growing',
          'qurban_complete',
          'shipped',
          'arrived',
          'delivery_scheduled',
          'out_for_delivery',
          'delivered',
          'completed',
        ].includes(status)
      ) {
        void notificationService
          .notifyQurbanStatusUpdate({
            recipient,
            orderRef: updatedOrder.order_ref,
            programme: updatedOrder.programme,
            statusLabel: getStatusLabel(status),
          })
          .catch(() => {});
      }
    }
  }, [commit]);

  const cancelOrder = useCallback((id: string) => {
    commit((d, actor) => applyOrderStatus(d, id, 'cancelled', actor));
  }, [commit]);

  const deleteOrder = useCallback((id: string) => {
    const target = dataRef.current.orders.find(o => o.id === id);
    if (!target) throw new Error('Order not found.');
    const deletableStatuses: OrderStatus[] = ['cancelled', 'draft', 'pending_payment', 'payment_rejected'];
    if (!deletableStatuses.includes(target.status)) {
      throw new Error('Cancel this order first before permanently deleting it.');
    }

    commit((d, actor) => {
      const o = d.orders.find(x => x.id === id);
      if (!o) return d;

      const removedPayCount = d.payments.filter(p => p.order_ref === o.order_ref).length;
      const removedDelCount = d.deliveries.filter(x => x.order_ref === o.order_ref).length;
      const removedCertCount = d.certificates.filter(c => c.order_ref === o.order_ref).length;
      const orderSpecificAnimalCount = d.animals.filter(a => a.order_ref === o.order_ref && Boolean(a.animal_code)).length;

      let next: AppData = {
        ...d,
        orders: d.orders.filter(x => x.id !== id),
        payments: d.payments.filter(p => p.order_ref !== o.order_ref),
        deliveries: d.deliveries.filter(x => x.order_ref !== o.order_ref),
        certificates: d.certificates.filter(c => c.order_ref !== o.order_ref),
        animals: d.animals
          .filter(a => !(a.order_ref === o.order_ref && Boolean(a.animal_code)))
          .map(a =>
            a.order_ref === o.order_ref
              ? { ...a, status: 'available' as AnimalStatus, order_id: undefined, order_ref: undefined, qurban_name_holder: undefined }
              : a,
          ),
      };

      next = withLog(
        next,
        actor,
        'order.deleted',
        'order',
        o.order_ref,
        `Order ${o.order_ref} permanently deleted (${o.participant}, ${o.programme}) — removed ${orderSpecificAnimalCount} animal(s), ${removedPayCount} payment(s), ${removedDelCount} delivery(s), ${removedCertCount} certificate(s)`,
      );
      return next;
    });
  }, [commit]);

  // ── Animals ───────────────────────────────────────────────
  const addAnimal = useCallback((a: AppAnimal) => {
    commit((d, actor) => {
      // Guarantee a unique ref even if the page computed a stale one
      const refTaken = d.animals.some(x => x.animal_ref === a.animal_ref);
      const animal = refTaken ? { ...a, animal_ref: nextRef('A', d.animals.map(x => x.animal_ref), 3) } : a;
      return withLog({ ...d, animals: [animal, ...d.animals] }, actor, 'animal.registered', 'animal', animal.animal_ref, `Animal ${animal.animal_ref} registered`);
    });
  }, [commit]);

  const updateAnimal = useCallback((id: string, patch: Partial<AppAnimal>) => {
    let loggedBreedingWeight: { animal: AppAnimal; order?: AppOrder } | null = null;
    commit((d, actor) => {
      const a = d.animals.find(x => x.id === id);
      if (!a) return d;
      const targetProgName = patch.programme ?? a.programme ?? '';
      const targetProgId = patch.programme_id ?? a.programme_id;
      const prog = d.programmes.find(
        p => (targetProgId && p.id === targetProgId) || (targetProgName && normaliseName(p.name) === normaliseName(targetProgName)),
      );
      const isProgrammeLinked = Boolean(targetProgName || targetProgId || patch.order_ref || a.order_ref);
      const allowsTimeline = !isProgrammeLinked || isBreedingProgramme(targetProgName, prog?.supports_weight_timeline);

      const weightChanged =
        patch.current_weight_kg !== undefined &&
        patch.current_weight_kg > 0 &&
        patch.current_weight_kg !== a.current_weight_kg;
      const nextWeightHistory = !allowsTimeline
        ? []
        : patch.weight_history ??
          (weightChanged
            ? [
                ...(a.weight_history ?? []),
                { weight_kg: patch.current_weight_kg!, recorded_at: nowIso() },
              ]
            : a.weight_history);

      const updated: AppAnimal = {
        ...a,
        ...patch,
        ...(nextWeightHistory !== undefined ? { weight_history: nextWeightHistory } : {}),
      };
      let next: AppData = { ...d, animals: d.animals.map(x => x.id === id ? updated : x) };
      if (patch.status && patch.status !== a.status) {
        next = withLog(next, actor, 'animal.status_changed', 'animal', a.animal_ref, `Animal ${a.animal_ref} → ${patch.status.replace(/_/g, ' ')}`);
        if (patch.status === 'rejected') {
          next = withException(next, actor, {
            severity: 'high', category: 'Animal',
            title: `Animal ${a.animal_ref} rejected`,
            description: `Animal ${a.animal_ref} (${a.animal_type}${a.order_ref ? `, order ${a.order_ref}` : ''}) failed inspection / was rejected. ${a.order_ref ? 'A replacement animal must be allocated.' : ''}`.trim(),
            related_entity: 'animal', related_entity_id: a.animal_ref,
          });
        } else {
          // Order-as-single-source-of-truth: advance linked Order (which syncs Deliveries + Certificates)
          const linkedOrder = next.orders.find(
            o => o.order_ref === updated.order_ref || (updated.order_id && o.id === updated.order_id),
          );
          const targetOrderStatus = orderStatusForAnimal(patch.status);
          if (
            linkedOrder &&
            targetOrderStatus &&
            linkedOrder.status !== 'cancelled' &&
            linkedOrder.status !== 'refunded' &&
            orderRank(linkedOrder.status) >= 0 &&
            orderRank(linkedOrder.status) < R(targetOrderStatus)
          ) {
            const orderAnimals = next.animals.filter(
              x => (x.order_ref === linkedOrder.order_ref || x.order_id === linkedOrder.id) && x.status !== 'rejected',
            );
            const minAnimalRank = orderAnimals.length > 0
              ? Math.min(...orderAnimals.map(x => animalRank(x.status)))
              : animalRank(patch.status);
            if (minAnimalRank >= animalRank(patch.status)) {
              next = applyOrderStatus(next, linkedOrder.id, targetOrderStatus, actor);
            }
          }
        }
      }
      if (weightChanged && allowsTimeline) {
        next = withLog(next, actor, 'animal.weight_logged', 'animal', a.animal_ref, `Animal ${a.animal_ref} weight ${patch.current_weight_kg} kg`);
        if (isBreedingProgramme(updated.programme, prog?.supports_weight_timeline) && updated.order_ref) {
          loggedBreedingWeight = {
            animal: updated,
            order: next.orders.find(o => o.order_ref === updated.order_ref),
          };
        }
      }
      // Keep certificate animal info in sync when the animal is edited
      if (a.order_ref && (patch.animal_ref || patch.animal_type)) {
        next = {
          ...next,
          certificates: next.certificates.map(c => c.order_ref === a.order_ref && c.animal_ref === a.animal_ref
            ? { ...c, animal_ref: updated.animal_ref, animal_type: updated.animal_type, animal_label: updated.animal_type.charAt(0).toUpperCase() + updated.animal_type.slice(1) }
            : c),
        };
      }
      return next;
    });

    if (loggedBreedingWeight) {
      const { animal: bAnimal, order: bOrder } = loggedBreedingWeight as { animal: AppAnimal; order?: AppOrder };
      if (bOrder) {
        void notificationService
          .notifyBreedingWeightUpdate({
            recipient: {
              name: bOrder.participant,
              email: bOrder.email,
              phone: bOrder.contact_number,
            },
            orderRef: bOrder.order_ref,
            animalCode: bAnimal.animal_code || bAnimal.animal_ref,
            qurbanHolder: bAnimal.qurban_name_holder || bOrder.participant,
            weightKg: bAnimal.current_weight_kg,
          })
          .catch(() => {});
      }
    }
  }, [commit]);

  const updateAnimalStatus = useCallback((id: string, status: AnimalStatus) => {
    updateAnimal(id, { status });
  }, [updateAnimal]);

  // ── Payments ──────────────────────────────────────────────
  const addPayment = useCallback((p: AppPayment) => {
    commit((d, actor) => withLog({ ...d, payments: [p, ...d.payments] }, actor, 'payment.created', 'payment', p.payment_ref, `Payment ${p.payment_ref} recorded`));
  }, [commit]);

  const verifyPayment = useCallback((id: string) => {
    let verifiedInfo: { payment: AppPayment; order?: AppOrder } | null = null;
    commit((d, actor) => {
      const p = d.payments.find(x => x.id === id);
      if (!p) return d;
      let next: AppData = {
        ...d,
        payments: d.payments.map(x => x.id === id
          ? { ...x, status: 'verified' as PaymentStatus, verified_at: nowIso(), submitted_at: x.submitted_at ?? nowIso(), rejection_reason: null }
          : x),
      };
      next = withLog(next, actor, 'payment.verified', 'payment', p.payment_ref, `Payment ${p.payment_ref} verified`);
      const o = next.orders.find(x => x.order_ref === p.order_ref);
      if (o && orderRank(o.status) >= 0 && orderRank(o.status) < R('payment_verified')) {
        next = applyOrderStatus(next, o.id, 'payment_verified', actor);
      } else if (o && o.status === 'payment_rejected') {
        next = applyOrderStatus(next, o.id, 'payment_verified', actor);
      }
      verifiedInfo = { payment: p, order: next.orders.find(x => x.order_ref === p.order_ref) };
      return next;
    });
    if (verifiedInfo) {
      const { payment: vp, order: vo } = verifiedInfo as { payment: AppPayment; order?: AppOrder };
      if (vo) {
        void notificationService
          .notifyPaymentUpdate({
            recipient: { name: vo.participant, email: vo.email, phone: vo.contact_number },
            orderRef: vo.order_ref,
            paymentRef: vp.payment_ref,
            status: 'verified',
            amountFormatted: `${vp.currency} ${vp.amount.toLocaleString()}`,
          })
          .catch(() => {});
      }
    }
  }, [commit]);

  const rejectPayment = useCallback((id: string, reason?: string) => {
    let rejectedInfo: { payment: AppPayment; order?: AppOrder } | null = null;
    commit((d, actor) => {
      const p = d.payments.find(x => x.id === id);
      if (!p) return d;
      let next: AppData = {
        ...d,
        payments: d.payments.map(x => x.id === id
          ? { ...x, status: 'rejected' as PaymentStatus, verified_at: null, rejection_reason: reason?.trim() || null }
          : x),
      };
      next = withLog(next, actor, 'payment.rejected', 'payment', p.payment_ref, `Payment ${p.payment_ref} rejected${reason ? `: ${reason}` : ''}`);
      const o = next.orders.find(x => x.order_ref === p.order_ref);
      if (o && o.status !== 'cancelled' && o.status !== 'refunded') {
        next = applyOrderStatus(next, o.id, 'payment_rejected', actor);
      }
      next = withException(next, actor, {
        severity: 'medium', category: 'Payment',
        title: `Payment ${p.payment_ref} rejected`,
        description: `Payment of ${p.currency} ${p.amount} from ${p.participant} for order ${p.order_ref} was rejected.${reason ? ` Reason: ${reason}.` : ''} Follow up with the participant to resubmit.`,
        related_entity: 'payment', related_entity_id: p.payment_ref,
      });
      rejectedInfo = { payment: p, order: next.orders.find(x => x.order_ref === p.order_ref) };
      return next;
    });
    if (rejectedInfo) {
      const { payment: rp, order: ro } = rejectedInfo as { payment: AppPayment; order?: AppOrder };
      if (ro) {
        void notificationService
          .notifyPaymentUpdate({
            recipient: { name: ro.participant, email: ro.email, phone: ro.contact_number },
            orderRef: ro.order_ref,
            paymentRef: rp.payment_ref,
            status: 'rejected',
            amountFormatted: `${rp.currency} ${rp.amount.toLocaleString()}`,
            reason: reason?.trim(),
          })
          .catch(() => {});
      }
    }
  }, [commit]);

  const recordInstallmentPayment = useCallback((orderId: string, paidDateIso?: string) => {
    let reminderInfo: {
      order: AppOrder;
      paidCount: number;
      totalCount: number;
      nextInstallment: InstallmentScheduleItem;
    } | null = null;

    commit((d, actor) => {
      const o = d.orders.find(x => x.id === orderId || x.order_ref === orderId);
      if (!o || o.payment_method !== 'installment') return d;

      const count = Math.max(2, Math.min(6, Math.round(o.installment_count ?? o.installment_schedule?.length ?? 2)));
      const schedule = (
        o.installment_schedule && o.installment_schedule.length === count
          ? o.installment_schedule
          : buildInstallmentSchedule(o.total_amount, count, o.created_at, o.currency)
      ).map(item => ({ ...item }));

      const nextIdx = schedule.findIndex(item => item.status !== 'verified');
      if (nextIdx < 0) return d;

      schedule[nextIdx] = {
        ...schedule[nextIdx],
        status: 'verified',
        ...(paidDateIso ? { dueDate: paidDateIso } : {}),
      };
      const paidCount = schedule.filter(item => item.status === 'verified').length;
      const updatedOrder: AppOrder = {
        ...o,
        installment_count: count,
        installments_paid: paidCount,
        installment_schedule: schedule,
      };

      let next: AppData = {
        ...d,
        orders: d.orders.map(x => (x.id === o.id ? updatedOrder : x)),
      };
      next = syncRelated(next, updatedOrder, actor);
      next = withLog(
        next,
        actor,
        'payment.installment_recorded',
        'order',
        o.order_ref,
        `Installment ${paidCount}/${count} recorded for order ${o.order_ref}${paidCount < count ? ` (${count - paidCount} remaining)` : ' — fully paid'}`,
      );

      if (paidCount >= count) {
        if (orderRank(updatedOrder.status) < R('payment_verified') || updatedOrder.status === 'payment_rejected') {
          next = applyOrderStatus(next, o.id, 'payment_verified', actor);
        }
      } else {
        const pay = next.payments.find(p => p.order_ref === o.order_ref);
        if (pay && pay.status === 'pending') {
          next = {
            ...next,
            payments: next.payments.map(p =>
              p.id === pay.id ? { ...p, status: 'submitted' as PaymentStatus, submitted_at: p.submitted_at ?? nowIso() } : p,
            ),
          };
        }
        const nextItem = schedule.find(item => item.status !== 'verified');
        if (nextItem) {
          reminderInfo = {
            order: updatedOrder,
            paidCount,
            totalCount: count,
            nextInstallment: nextItem,
          };
        }
      }

      return next;
    });

    if (reminderInfo) {
      const info = reminderInfo as {
        order: AppOrder;
        paidCount: number;
        totalCount: number;
        nextInstallment: InstallmentScheduleItem;
      };
      void notificationService
        .notifyInstallmentReminder({
          recipient: {
            name: info.order.participant,
            email: info.order.email,
            phone: info.order.contact_number,
          },
          orderRef: info.order.order_ref,
          programme: info.order.programme,
          paidCount: info.paidCount,
          totalCount: info.totalCount,
          nextInstallmentNumber: info.nextInstallment.installmentNumber,
          nextAmountFormatted: `${info.nextInstallment.currency} ${info.nextInstallment.amount.toLocaleString()}`,
          dueDate: info.nextInstallment.dueDate,
        })
        .catch(() => {});
    }
  }, [commit]);

  const sendInstallmentReminder = useCallback(async (orderId: string) => {
    const d0 = dataRef.current;
    const o = d0.orders.find(x => x.id === orderId || x.order_ref === orderId);
    if (!o || o.payment_method !== 'installment') return;

    const count = Math.max(2, Math.min(6, Math.round(o.installment_count ?? o.installment_schedule?.length ?? 2)));
    const schedule =
      o.installment_schedule && o.installment_schedule.length === count
        ? o.installment_schedule
        : buildInstallmentSchedule(o.total_amount, count, o.created_at, o.currency);
    const paidCount = schedule.filter(item => item.status === 'verified').length;
    const nextItem = schedule.find(item => item.status !== 'verified');
    if (!nextItem) return;

    await notificationService.notifyInstallmentReminder({
      recipient: {
        name: o.participant,
        email: o.email,
        phone: o.contact_number,
      },
      orderRef: o.order_ref,
      programme: o.programme,
      paidCount,
      totalCount: count,
      nextInstallmentNumber: nextItem.installmentNumber,
      nextAmountFormatted: `${nextItem.currency} ${nextItem.amount.toLocaleString()}`,
      dueDate: nextItem.dueDate,
    });

    commit((d, actor) =>
      withLog(
        d,
        actor,
        'payment.installment_reminded',
        'order',
        o.order_ref,
        `Installment ${nextItem.installmentNumber}/${count} reminder sent to ${o.participant} (${count - paidCount} remaining)`,
      ),
    );
  }, [commit]);

  // ── Deliveries ─────────────────────────────────────────────
  const updateDelivery = useCallback((id: string, patch: Partial<AppDelivery>) => {
    commit((d, actor) => {
      const del = d.deliveries.find(x => x.id === id);
      if (!del) return d;
      return withLog(
        { ...d, deliveries: d.deliveries.map(x => x.id === id ? { ...x, ...patch } : x) },
        actor, 'delivery.updated', 'delivery', del.delivery_ref, `Delivery ${del.delivery_ref} details updated`,
      );
    });
  }, [commit]);

  const updateDeliveryStatus = useCallback((id: string, status: DeliveryStatus) => {
    commit((d, actor) => {
      const del = d.deliveries.find(x => x.id === id);
      if (!del || del.status === status) return d;
      let next: AppData = {
        ...d,
        deliveries: d.deliveries.map(x => x.id === id
          ? { ...x, status, delivered_at: status === 'delivered' ? nowIso() : x.delivered_at, scheduled_date: x.scheduled_date ?? (status === 'scheduled' ? today() : null) }
          : x),
      };
      next = withLog(next, actor, 'delivery.status_changed', 'delivery', del.delivery_ref, `Delivery ${del.delivery_ref} → ${status.replace(/_/g, ' ')}`);

      const o = next.orders.find(x => x.order_ref === del.order_ref);
      const orderTarget: Partial<Record<DeliveryStatus, OrderStatus>> = {
        scheduled: 'delivery_scheduled', out_for_delivery: 'out_for_delivery', delivered: 'delivered',
      };
      const target = orderTarget[status];
      if (o && target && orderRank(o.status) >= 0 && orderRank(o.status) < R(target)) {
        next = applyOrderStatus(next, o.id, target, actor);
      }
      if (status === 'failed' || status === 'returned') {
        next = withException(next, actor, {
          severity: 'high', category: 'Delivery',
          title: `Delivery ${del.delivery_ref} ${status}`,
          description: `Delivery ${del.delivery_ref} for ${del.participant} (order ${del.order_ref}) was marked ${status}. Contact the recipient and reschedule.`,
          related_entity: 'delivery', related_entity_id: del.delivery_ref,
        });
      }
      return next;
    });
  }, [commit]);

  // ── Certificates ──────────────────────────────────────────
  const updateCertStatus = useCallback((id: string, status: CertificateStatus) => {
    let notifyCert: { cert: AppCertificate; order?: AppOrder } | null = null;
    commit((d, actor) => {
      const c = d.certificates.find(x => x.id === id);
      if (!c || c.status === status) return d;
      let next: AppData = {
        ...d,
        certificates: d.certificates.map(x => x.id === id
          ? {
              ...x, status,
              generated_at: x.generated_at ?? (status !== 'not_generated' ? nowIso() : null),
              sent_at: status === 'sent' ? nowIso() : x.sent_at,
            }
          : x),
      };
      next = withLog(next, actor, 'certificate.status_changed', 'certificate', c.certificate_ref, `Certificate ${c.certificate_ref} → ${status.replace(/_/g, ' ')}`);
      const o = next.orders.find(x => x.order_ref === c.order_ref);
      if (o && (status === 'generated' || status === 'sent') && orderRank(o.status) >= 0 && orderRank(o.status) < R('certificate_generated')) {
        next = applyOrderStatus(next, o.id, 'certificate_generated', actor);
      }
      if (status === 'sent' || status === 'generated') {
        notifyCert = { cert: c, order: o };
      }
      return next;
    });
    if (notifyCert) {
      const { cert: nc, order: no } = notifyCert as { cert: AppCertificate; order?: AppOrder };
      if (no) {
        void notificationService
          .notifyCertificateReady({
            recipient: { name: no.participant, email: no.email, phone: no.contact_number },
            orderRef: no.order_ref,
            certificateRef: nc.certificate_ref,
            programme: no.programme,
          })
          .catch(() => {});
      }
    }
  }, [commit]);

  // ── Participants ──────────────────────────────────────────
  const addParticipant = useCallback((p: AppParticipant) => {
    commit((d, actor) => {
      const normalized: AppParticipant = {
        ...p,
        full_name: p.full_name?.trim() || fullName(p),
        contact_number: p.contact_number?.trim() || p.phone,
      };
      return withLog(
        { ...d, participants: [normalized, ...d.participants] },
        actor,
        'participant.created',
        'participant',
        normalized.participant_ref,
        `Participant ${participantFullName(normalized)} registered`,
      );
    });
  }, [commit]);

  const updateParticipant = useCallback((id: string, patch: Partial<AppParticipant>) => {
    commit((d, actor) => {
      const p = d.participants.find(x => x.id === id);
      if (!p) return d;
      const mergedFirst = patch.first_name ?? p.first_name;
      const mergedLast = patch.last_name ?? p.last_name;
      const updated: AppParticipant = {
        ...p,
        ...patch,
        full_name: patch.full_name?.trim() || `${mergedFirst} ${mergedLast}`.trim(),
        contact_number: patch.contact_number?.trim() ?? patch.phone ?? p.phone,
      };
      let next: AppData = { ...d, participants: d.participants.map(x => x.id === id ? updated : x) };
      // Propagate participant name / email / phone updates to linked orders, payments, deliveries & certificates
      const oldName = participantFullName(p), newName = participantFullName(updated);
      const matchName = (s: string) => norm(s) === norm(oldName);
      const linkedOrderRefs = new Set(
        next.orders
          .filter(o => (o.participant_id ? o.participant_id === id : matchName(o.participant)))
          .map(o => o.order_ref),
      );
      next = {
        ...next,
        orders: next.orders.map(o =>
          (o.participant_id ? o.participant_id === id : matchName(o.participant))
            ? {
                ...o,
                participant: newName,
                email: updated.email || o.email,
                contact_number: updated.phone || o.contact_number,
              }
            : o,
        ),
        payments: next.payments.map(x =>
          linkedOrderRefs.has(x.order_ref) || matchName(x.participant) ? { ...x, participant: newName } : x,
        ),
        deliveries: next.deliveries.map(x =>
          linkedOrderRefs.has(x.order_ref) || matchName(x.participant)
            ? { ...x, participant: newName, contact_phone: updated.phone || x.contact_phone }
            : x,
        ),
        certificates: next.certificates.map(x =>
          linkedOrderRefs.has(x.order_ref) || matchName(x.participant_name) ? { ...x, participant_name: newName } : x,
        ),
      };
      const what = patch.portal_access && !p.portal_access ? 'portal access granted' : 'profile updated';
      return withLog(next, actor, 'participant.updated', 'participant', p.participant_ref, `Participant ${newName}: ${what}`);
    });
  }, [commit]);

  // ── Suppliers ─────────────────────────────────────────────
  const addSupplier = useCallback((s: AppSupplier) => {
    commit((d, actor) => withLog({ ...d, suppliers: [s, ...d.suppliers] }, actor, 'supplier.created', 'supplier', s.supplier_ref, `Supplier ${s.name} added`));
  }, [commit]);

  const updateSupplier = useCallback((s: AppSupplier) => {
    commit((d, actor) => {
      const old = d.suppliers.find(x => x.id === s.id);
      let next: AppData = { ...d, suppliers: d.suppliers.map(x => x.id === s.id ? s : x) };
      if (old && norm(old.name) !== norm(s.name)) {
        next = { ...next, animals: next.animals.map(a => norm(a.supplier) === norm(old.name) ? { ...a, supplier: s.name } : a) };
      }
      return withLog(next, actor, 'supplier.updated', 'supplier', s.supplier_ref, `Supplier ${s.name} updated`);
    });
  }, [commit]);

  // ── Programmes ────────────────────────────────────────────
  const addProgramme = useCallback((p: AppProgramme) => {
    commit((d, actor) => withLog({ ...d, programmes: [p, ...d.programmes] }, actor, 'programme.created', 'programme', p.id, `Programme "${p.name}" created`));
  }, [commit]);

  const updateProgramme = useCallback((p: AppProgramme) => {
    commit((d, actor) => {
      const old = d.programmes.find(x => x.id === p.id);
      let next: AppData = { ...d, programmes: d.programmes.map(x => x.id === p.id ? p : x) };
      if (old && (old.name !== p.name || old.country !== p.country)) {
        next = {
          ...next,
          orders: next.orders.map(o =>
            o.programme_id === p.id || o.programme === old.name
              ? { ...o, programme: p.name, programme_country: p.country }
              : o,
          ),
          animals: next.animals.map(a =>
            a.programme_id === p.id || a.programme === old.name
              ? { ...a, programme: p.name }
              : a,
          ),
          certificates: next.certificates.map(c =>
            c.programme_name === old.name ? { ...c, programme_name: p.name, country: p.country } : c,
          ),
        };
      }
      return withLog(next, actor, 'programme.updated', 'programme', p.id, `Programme "${p.name}" updated`);
    });
  }, [commit]);

  // ── Exceptions ────────────────────────────────────────────
  const resolveException = useCallback((id: string, resolution?: string) => {
    commit((d, actor) => {
      const e = d.exceptions.find(x => x.id === id);
      if (!e) return d;
      return withLog(
        { ...d, exceptions: d.exceptions.map(x => x.id === id ? { ...x, status: 'resolved' as ExceptionStatus, resolution: resolution?.trim() || x.resolution || null } : x) },
        actor, 'exception.resolved', 'exception', e.id, `Exception "${e.title}" resolved${resolution ? `: ${resolution}` : ''}`,
      );
    });
  }, [commit]);

  const assignException = useCallback((id: string, person: string) => {
    commit((d, actor) => {
      const e = d.exceptions.find(x => x.id === id);
      if (!e) return d;
      return withLog(
        { ...d, exceptions: d.exceptions.map(x => x.id === id ? { ...x, assigned_to: person, status: 'in_progress' as ExceptionStatus } : x) },
        actor, 'exception.assigned', 'exception', e.id, `Exception "${e.title}" assigned to ${person}`,
      );
    });
  }, [commit]);

  // ── Derived values (counts always reflect real data) ──────
  const participants = useMemo(() => data.participants.map(p => {
    const name = norm(fullName(p));
    const mine = data.orders.filter(o =>
      (o.participant_id ? o.participant_id === p.id : norm(o.participant) === name) && o.status !== 'cancelled');
    const paidRefs = new Set(data.payments.filter(x => x.status === 'verified').map(x => x.order_ref));
    return {
      ...p,
      orders_count: mine.length,
      total_spent: mine.filter(o => paidRefs.has(o.order_ref)).reduce((s, o) => s + o.total_amount, 0),
    };
  }), [data.participants, data.orders, data.payments]);

  const programmes = useMemo(() => data.programmes.map(p => ({
    ...p,
    orders_count: data.orders
      .filter(o => o.programme === p.name && o.status !== 'cancelled' && o.status !== 'refunded')
      .reduce((s, o) => s + o.quantity, 0),
  })), [data.programmes, data.orders]);

  const suppliers = useMemo(() => data.suppliers.map(s => ({
    ...s,
    animals_count: data.animals.filter(a => norm(a.supplier) === norm(s.name)).length,
  })), [data.suppliers, data.animals]);

  const value = useMemo<AppDataContextType>(() => ({
    ...data,
    participants, programmes, suppliers,
    addOrder, updateOrder, updateOrderStatus, cancelOrder, deleteOrder, markOrderInvoiceSent,
    addAnimal, updateAnimal, updateAnimalStatus,
    addPayment, verifyPayment, rejectPayment, recordInstallmentPayment, sendInstallmentReminder,
    updateDeliveryStatus, updateDelivery,
    updateCertStatus,
    addParticipant, updateParticipant,
    addSupplier, updateSupplier,
    addProgramme, updateProgramme,
    resolveException, assignException,
  }), [
    data, participants, programmes, suppliers,
    addOrder, updateOrder, updateOrderStatus, cancelOrder, deleteOrder, markOrderInvoiceSent,
    addAnimal, updateAnimal, updateAnimalStatus,
    addPayment, verifyPayment, rejectPayment, recordInstallmentPayment, sendInstallmentReminder,
    updateDeliveryStatus, updateDelivery,
    updateCertStatus,
    addParticipant, updateParticipant,
    addSupplier, updateSupplier,
    addProgramme, updateProgramme,
    resolveException, assignException,
  ]);

  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider');
  return ctx;
}
