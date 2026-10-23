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
import { useAuth } from '@/contexts/AuthContext';

// ─────────────────────────────────────────────────────────────
// Local flat types used by the admin pages
// ─────────────────────────────────────────────────────────────

export type AppOrder = {
  id: string;
  order_ref: string;
  participant: string;
  programme: string;
  quantity: number;
  total_amount: number;
  currency: string;
  status: OrderStatus;
  created_at: string;
  recipient?: string;
  notes?: string;
};

export type AppAnimal = {
  id: string;
  animal_ref: string;
  animal_type: AnimalType;
  breed: string;
  gender: string;
  status: AnimalStatus;
  current_weight_kg: number;
  min_weight_kg: number;
  location: string;
  supplier: string;
  created_at: string;
  tag_number: string;
  last_inspection?: string;
  order_ref?: string; // linked order when allocated
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
  programme_name: string;
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
};

export type AppParticipant = {
  id: string;
  participant_ref: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
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

export type NewOrderInput = {
  participant: string;
  programme: string;
  quantity: number;
  total_amount: number;
  currency?: string;
  notes?: string;
  status?: OrderStatus;
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
  participants: [], suppliers: [], programmes: [], exceptions: [], auditLogs: [],
};

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
  if (s === 'certificate_generated' || s === 'completed') return 'completed';
  if (R(s) >= R('qurban_complete')) return 'slaughtered';
  return null;
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
  const wantPay = paymentStatusFor(o.status);
  const pay = d.payments.find(p => p.order_ref === o.order_ref);
  if (pay) {
    if (wantPay && (pay.status !== wantPay || pay.amount !== o.total_amount)) {
      const submittedLike = wantPay === 'submitted' || wantPay === 'under_review' || wantPay === 'verified';
      const updated: AppPayment = {
        ...pay,
        status: wantPay,
        amount: o.total_amount,
        participant: o.participant,
        submitted_at: submittedLike ? pay.submitted_at ?? nowIso() : wantPay === 'pending' ? null : pay.submitted_at,
        verified_at: wantPay === 'verified' ? pay.verified_at ?? nowIso() : wantPay === 'refunded' ? pay.verified_at : null,
      };
      d = { ...d, payments: d.payments.map(p => p.id === pay.id ? updated : p) };
      if (pay.status !== wantPay) {
        d = withLog(d, actor, `payment.${wantPay}`, 'payment', pay.payment_ref, `Payment ${pay.payment_ref} → ${wantPay.replace(/_/g, ' ')} (order ${o.order_ref})`);
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
      method: 'bank_transfer',
      status: wantPay,
      submitted_at: submittedLike ? nowIso() : null,
      verified_at: wantPay === 'verified' ? nowIso() : null,
      bank: null,
      notes: null,
      proof_url: null,
      rejection_reason: null,
    };
    d = { ...d, payments: [newPayment, ...d.payments] };
    d = withLog(d, actor, 'payment.created', 'payment', ref, `Payment ${ref} created for order ${o.order_ref} (${wantPay.replace(/_/g, ' ')})`);
  }

  // ── Animal ───────────────────────────────────────────────
  const linked = d.animals.find(a => a.order_ref === o.order_ref);
  if (isCancelled) {
    if (linked && !['slaughtered', 'processed', 'completed'].includes(linked.status)) {
      d = { ...d, animals: d.animals.map(a => a.id === linked.id ? { ...a, status: 'available' as AnimalStatus, order_ref: undefined } : a) };
      d = withLog(d, actor, 'animal.released', 'animal', linked.animal_ref, `Animal ${linked.animal_ref} released from cancelled order ${o.order_ref}`);
    }
  } else if (r >= R('animal_allocated')) {
    const want = animalStatusFor(o.status) ?? 'allocated';
    if (!linked) {
      const type = inferAnimalType(d, o.programme);
      // Prefer allocating a real, unassigned animal of the right type
      const free = d.animals.find(a =>
        !a.order_ref && a.animal_type === type &&
        ['available', 'reserved', 'growing', 'inspection_passed', 'qurban_ready'].includes(a.status));
      if (free) {
        const status = animalRank(want) > animalRank(free.status) ? want : free.status;
        d = { ...d, animals: d.animals.map(a => a.id === free.id ? { ...a, order_ref: o.order_ref, status } : a) };
        d = withLog(d, actor, 'animal.allocated', 'animal', free.animal_ref, `Animal ${free.animal_ref} allocated to order ${o.order_ref}`);
      } else {
        const ref = nextRef('A', d.animals.map(a => a.animal_ref), 3);
        const placeholder: AppAnimal = {
          id: uid(),
          animal_ref: ref,
          animal_type: type,
          breed: 'To be assigned',
          gender: 'male',
          status: want,
          current_weight_kg: 0,
          min_weight_kg: type === 'cow' || type === 'buffalo' ? 350 : type === 'camel' ? 300 : 25,
          location: programmeCountry(d, o.programme) || 'TBD',
          supplier: 'To be assigned',
          created_at: nowIso(),
          tag_number: 'Pending',
          order_ref: o.order_ref,
        };
        d = { ...d, animals: [placeholder, ...d.animals] };
        d = withLog(d, actor, 'animal.allocated', 'animal', ref, `Animal ${ref} created and allocated to order ${o.order_ref} — please update its details`);
      }
    } else if (linked.status !== 'rejected' && animalRank(want) > animalRank(linked.status)) {
      d = { ...d, animals: d.animals.map(a => a.id === linked.id ? { ...a, status: want } : a) };
      d = withLog(d, actor, 'animal.status_changed', 'animal', linked.animal_ref, `Animal ${linked.animal_ref} → ${want.replace(/_/g, ' ')}`);
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
          contact_phone: participant?.phone ?? '',
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

  // ── Certificate ──────────────────────────────────────────
  if (!isCancelled && r >= R('qurban_complete')) {
    const cert = d.certificates.find(c => c.order_ref === o.order_ref);
    const animal = d.animals.find(a => a.order_ref === o.order_ref);
    const shouldBeGenerated = r >= R('certificate_generated');
    if (!cert) {
      const ref = nextRef('CERT', d.certificates.map(c => c.certificate_ref), 5);
      const type = animal?.animal_type ?? inferAnimalType(d, o.programme);
      const prog = d.programmes.find(p => norm(p.name) === norm(o.programme));
      const code = () => Math.random().toString(36).slice(2, 6).toUpperCase();
      const newCert: AppCertificate = {
        id: uid(),
        certificate_ref: ref,
        order_ref: o.order_ref,
        participant_name: o.participant,
        programme_name: o.programme,
        country: programmeCountry(d, o.programme),
        animal_ref: animal?.animal_ref ?? 'Pending',
        animal_type: type,
        animal_label: type.charAt(0).toUpperCase() + type.slice(1),
        qurban_date: prog?.qurban_date || today(),
        status: shouldBeGenerated ? 'generated' : 'not_generated',
        generated_at: shouldBeGenerated ? nowIso() : null,
        sent_at: null,
        verification_code: `AIGCERT-${code()}-${code()}`,
        year: String(new Date().getFullYear()),
      };
      d = { ...d, certificates: [newCert, ...d.certificates] };
      d = withLog(d, actor, 'certificate.created', 'certificate', ref, `Certificate ${ref} created for ${o.participant}`);
    } else {
      const patch: Partial<AppCertificate> = {};
      if (animal && cert.animal_ref !== animal.animal_ref) patch.animal_ref = animal.animal_ref;
      if (shouldBeGenerated && cert.status === 'not_generated') { patch.status = 'generated'; patch.generated_at = nowIso(); }
      if (Object.keys(patch).length) {
        d = { ...d, certificates: d.certificates.map(c => c.id === cert.id ? { ...c, ...patch } : c) };
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

function loadData(): AppData {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    const base: AppData = { ...EMPTY, ...parsed };
    // Repair any orders whose related records are missing (idempotent)
    return base.orders.reduce((acc, o) => syncRelated(acc, o, SYSTEM_ACTOR), base);
  } catch {
    return EMPTY;
  }
}

// ─────────────────────────────────────────────────────────────
// Context shape
// ─────────────────────────────────────────────────────────────

type AppDataContextType = AppData & {
  // Order actions
  addOrder: (o: NewOrderInput) => AppOrder;
  updateOrderStatus: (id: string, status: OrderStatus) => void;
  cancelOrder: (id: string) => void;

  // Animal actions
  addAnimal: (a: AppAnimal) => void;
  updateAnimal: (id: string, patch: Partial<AppAnimal>) => void;
  updateAnimalStatus: (id: string, status: AnimalStatus) => void;

  // Payment actions
  addPayment: (p: AppPayment) => void;
  verifyPayment: (id: string) => void;
  rejectPayment: (id: string, reason?: string) => void;

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

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [data, setData] = useState<AppData>(loadData);
  const dataRef = useRef(data);

  const actorRef = useRef<Actor>(SYSTEM_ACTOR);
  actorRef.current = {
    email: profile?.email ?? user?.email ?? 'admin',
    role: profile?.role ?? 'super_admin',
  };

  /** Apply a pure transformation to the latest state. */
  const commit = useCallback((fn: (d: AppData, actor: Actor) => AppData) => {
    const prev = dataRef.current;
    const next = fn(prev, actorRef.current);
    if (next === prev) return;
    dataRef.current = next;
    setData(next);
  }, []);

  // Persist
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* storage full / unavailable */ }
  }, [data]);

  // Keep multiple open tabs in sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const next: AppData = { ...EMPTY, ...(JSON.parse(e.newValue) as Partial<AppData>) };
        dataRef.current = next;
        setData(next);
      } catch { /* ignore malformed */ }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // ── Orders ────────────────────────────────────────────────
  const addOrder = useCallback((input: NewOrderInput): AppOrder => {
    const order: AppOrder = {
      id: uid(),
      order_ref: nextRef('AIG', dataRef.current.orders.map(o => o.order_ref), 6),
      participant: input.participant.trim(),
      programme: input.programme,
      quantity: input.quantity,
      total_amount: input.total_amount,
      currency: input.currency ?? 'SGD',
      status: 'draft',
      created_at: nowIso(),
      notes: input.notes?.trim() || undefined,
    };
    commit((d, actor) => {
      let next: AppData = { ...d, orders: [order, ...d.orders] };
      next = withLog(next, actor, 'order.created', 'order', order.order_ref, `Order ${order.order_ref} created for ${order.participant}`);
      if (input.status && input.status !== 'draft') next = applyOrderStatus(next, order.id, input.status, actor);
      return next;
    });
    return order;
  }, [commit]);

  const updateOrderStatus = useCallback((id: string, status: OrderStatus) => {
    commit((d, actor) => applyOrderStatus(d, id, status, actor));
  }, [commit]);

  const cancelOrder = useCallback((id: string) => {
    commit((d, actor) => applyOrderStatus(d, id, 'cancelled', actor));
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
    commit((d, actor) => {
      const a = d.animals.find(x => x.id === id);
      if (!a) return d;
      const updated = { ...a, ...patch };
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
        }
      }
      if (patch.current_weight_kg !== undefined && patch.current_weight_kg !== a.current_weight_kg) {
        next = withLog(next, actor, 'animal.weight_logged', 'animal', a.animal_ref, `Animal ${a.animal_ref} weight ${patch.current_weight_kg} kg`);
      }
      // Keep certificate animal info in sync when the animal is edited
      if (a.order_ref && (patch.animal_ref || patch.animal_type)) {
        next = {
          ...next,
          certificates: next.certificates.map(c => c.order_ref === a.order_ref
            ? { ...c, animal_ref: updated.animal_ref, animal_type: updated.animal_type, animal_label: updated.animal_type.charAt(0).toUpperCase() + updated.animal_type.slice(1) }
            : c),
        };
      }
      return next;
    });
  }, [commit]);

  const updateAnimalStatus = useCallback((id: string, status: AnimalStatus) => {
    updateAnimal(id, { status });
  }, [updateAnimal]);

  // ── Payments ──────────────────────────────────────────────
  const addPayment = useCallback((p: AppPayment) => {
    commit((d, actor) => withLog({ ...d, payments: [p, ...d.payments] }, actor, 'payment.created', 'payment', p.payment_ref, `Payment ${p.payment_ref} recorded`));
  }, [commit]);

  const verifyPayment = useCallback((id: string) => {
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
      return next;
    });
  }, [commit]);

  const rejectPayment = useCallback((id: string, reason?: string) => {
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
      return next;
    });
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
      return next;
    });
  }, [commit]);

  // ── Participants ──────────────────────────────────────────
  const addParticipant = useCallback((p: AppParticipant) => {
    commit((d, actor) => withLog({ ...d, participants: [p, ...d.participants] }, actor, 'participant.created', 'participant', p.participant_ref, `Participant ${fullName(p)} registered`));
  }, [commit]);

  const updateParticipant = useCallback((id: string, patch: Partial<AppParticipant>) => {
    commit((d, actor) => {
      const p = d.participants.find(x => x.id === id);
      if (!p) return d;
      const updated = { ...p, ...patch };
      let next: AppData = { ...d, participants: d.participants.map(x => x.id === id ? updated : x) };
      // Rename propagates to orders/payments/certificates so links aren't lost
      const oldName = fullName(p), newName = fullName(updated);
      if (norm(oldName) !== norm(newName)) {
        const match = (s: string) => norm(s) === norm(oldName);
        next = {
          ...next,
          orders: next.orders.map(o => match(o.participant) ? { ...o, participant: newName } : o),
          payments: next.payments.map(x => match(x.participant) ? { ...x, participant: newName } : x),
          deliveries: next.deliveries.map(x => match(x.participant) ? { ...x, participant: newName } : x),
          certificates: next.certificates.map(x => match(x.participant_name) ? { ...x, participant_name: newName } : x),
        };
      }
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
      if (old && old.name !== p.name) {
        next = {
          ...next,
          orders: next.orders.map(o => o.programme === old.name ? { ...o, programme: p.name } : o),
          certificates: next.certificates.map(c => c.programme_name === old.name ? { ...c, programme_name: p.name } : c),
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
    const mine = data.orders.filter(o => norm(o.participant) === name && o.status !== 'cancelled');
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
    addOrder, updateOrderStatus, cancelOrder,
    addAnimal, updateAnimal, updateAnimalStatus,
    addPayment, verifyPayment, rejectPayment,
    updateDeliveryStatus, updateDelivery,
    updateCertStatus,
    addParticipant, updateParticipant,
    addSupplier, updateSupplier,
    addProgramme, updateProgramme,
    resolveException, assignException,
  }), [
    data, participants, programmes, suppliers,
    addOrder, updateOrderStatus, cancelOrder,
    addAnimal, updateAnimal, updateAnimalStatus,
    addPayment, verifyPayment, rejectPayment,
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
