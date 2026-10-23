/**
 * AppDataContext — Global in-memory store for the AIG admin system.
 *
 * All pages read and write data here, so:
 *  • Data persists when navigating between pages (no more reset on unmount)
 *  • Changing an order status auto-syncs Payments / Deliveries / Certificates
 *  • Dashboard stats reflect real data from all modules
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type {
  OrderStatus, AnimalStatus, AnimalType,
  PaymentStatus, DeliveryStatus, CertificateStatus,
  ExceptionSeverity, ExceptionStatus, UserRole, DistributionMethod,
} from '@/lib/database.types';

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

// ─────────────────────────────────────────────────────────────
// Context shape
// ─────────────────────────────────────────────────────────────

type AppDataContextType = {
  // Data
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

  // Order actions
  addOrder: (o: AppOrder) => void;
  updateOrderStatus: (id: string, status: OrderStatus) => void;
  cancelOrder: (id: string) => void;

  // Animal actions
  addAnimal: (a: AppAnimal) => void;
  updateAnimalStatus: (id: string, status: AnimalStatus) => void;

  // Payment actions
  addPayment: (p: AppPayment) => void;
  verifyPayment: (id: string) => void;
  rejectPayment: (id: string) => void;

  // Delivery actions
  updateDeliveryStatus: (id: string, status: DeliveryStatus) => void;

  // Certificate actions
  updateCertStatus: (id: string, status: CertificateStatus) => void;

  // Participant actions
  addParticipant: (p: AppParticipant) => void;

  // Supplier actions
  addSupplier: (s: AppSupplier) => void;
  updateSupplier: (s: AppSupplier) => void;

  // Programme actions
  addProgramme: (p: AppProgramme) => void;
  updateProgramme: (p: AppProgramme) => void;

  // Exception actions
  resolveException: (id: string) => void;
  assignException: (id: string, person: string) => void;
};

const AppDataContext = createContext<AppDataContextType | null>(null);

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [orders,       setOrders]       = useState<AppOrder[]>([]);
  const [animals,      setAnimals]      = useState<AppAnimal[]>([]);
  const [payments,     setPayments]     = useState<AppPayment[]>([]);
  const [deliveries,   setDeliveries]   = useState<AppDelivery[]>([]);
  const [certificates, setCertificates] = useState<AppCertificate[]>([]);
  const [participants, setParticipants] = useState<AppParticipant[]>([]);
  const [suppliers,    setSuppliers]    = useState<AppSupplier[]>([]);
  const [programmes,   setProgrammes]   = useState<AppProgramme[]>([]);
  const [exceptions,   setExceptions]   = useState<AppException[]>([]);
  const [auditLogs,    setAuditLogs]    = useState<AppAuditLog[]>([]);

  // Counters for auto-numbering
  const paymentSeq  = useRef(1);
  const deliverySeq = useRef(1);
  const certSeq     = useRef(1);

  // ── Audit helper ───────────────────────────────────────────
  const log = useCallback((action: string, entity: string, entityId: string | null, desc: string) => {
    const entry: AppAuditLog = {
      id: String(Date.now()) + Math.random(),
      actor_email: 'admin@aigms.com',
      actor_role: 'super_admin',
      action, entity,
      entity_id: entityId,
      description: desc,
      created_at: new Date().toISOString(),
    };
    setAuditLogs(prev => [entry, ...prev]);
  }, []);

  // ── Orders ────────────────────────────────────────────────
  const addOrder = useCallback((o: AppOrder) => {
    setOrders(prev => [o, ...prev]);
    log('order.created', 'order', o.order_ref, `New order ${o.order_ref} created for ${o.participant}`);
  }, [log]);

  const updateOrderStatus = useCallback((id: string, status: OrderStatus) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== id) return o;
      const updated = { ...o, status };

      // ── Auto-create related records when status advances ──

      // Payment: when order is submitted, auto-create a pending payment
      if (status === 'payment_submitted') {
        const seq = String(paymentSeq.current++).padStart(6, '0');
        const ref = `PAY-${new Date().getFullYear()}-${seq}`;
        const newPayment: AppPayment = {
          id: String(Date.now()),
          payment_ref: ref,
          order_ref: o.order_ref,
          participant: o.participant,
          amount: o.total_amount,
          currency: o.currency,
          method: 'bank_transfer',
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          verified_at: null,
          bank: null,
          notes: null,
        };
        setPayments(pp => {
          // Avoid duplicates
          if (pp.some(p => p.order_ref === o.order_ref)) return pp;
          return [newPayment, ...pp];
        });
        log('payment.submitted', 'payment', ref, `Payment ${ref} submitted for order ${o.order_ref}`);
      }

      // Animal: when order is animal_allocated, auto-create an allocated animal
      if (status === 'animal_allocated') {
        setAnimals(prev => {
          if (prev.some(a => a.order_ref === o.order_ref)) return prev;
          // Infer animal type from programme name
          const prog = o.programme.toLowerCase();
          let animalType: AnimalType = 'goat';
          if (prog.includes('cow')) animalType = 'cow';
          else if (prog.includes('sheep')) animalType = 'sheep';
          else if (prog.includes('camel')) animalType = 'camel';
          else if (prog.includes('buffalo')) animalType = 'buffalo';
          else if (prog.includes('lamb')) animalType = 'lamb';

          const seq = String(prev.length + 1).padStart(3, '0');
          const ref = `A-${new Date().getFullYear()}-${seq}`;
          const newAnimal: AppAnimal = {
            id: String(Date.now()),
            animal_ref: ref,
            animal_type: animalType,
            breed: '',
            gender: 'male',
            status: 'allocated',
            current_weight_kg: 0,
            min_weight_kg: animalType === 'cow' ? 350 : animalType === 'camel' ? 300 : 25,
            location: o.programme.split('—')[1]?.trim() || 'TBD',
            supplier: 'Pending assignment',
            created_at: new Date().toISOString(),
            tag_number: `TAG-${Date.now()}`,
            order_ref: o.order_ref,
          };
          log('animal.allocated', 'animal', ref, `Animal ${ref} allocated to order ${o.order_ref}`);
          return [newAnimal, ...prev];
        });
      }

      // Delivery: when order is delivered, auto-create a delivery record
      if (status === 'delivered' || status === 'out_for_delivery' || status === 'delivery_scheduled') {
        setDeliveries(prev => {
          if (prev.some(d => d.order_ref === o.order_ref)) return prev;
          const seq = String(deliverySeq.current++).padStart(3, '0');
          const ref = `DEL-${new Date().getFullYear()}-${seq}`;
          const newDelivery: AppDelivery = {
            id: String(Date.now()),
            delivery_ref: ref,
            order_ref: o.order_ref,
            participant: o.participant,
            contact_phone: '',
            status: status === 'delivered' ? 'delivered' : status === 'out_for_delivery' ? 'out_for_delivery' : 'scheduled',
            scheduled_date: new Date().toISOString().split('T')[0],
            delivered_at: status === 'delivered' ? new Date().toISOString() : null,
            address: 'Address not provided — please update',
            driver: null,
            delivery_slot: null,
          };
          log('delivery.created', 'delivery', ref, `Delivery ${ref} created for order ${o.order_ref}`);
          return [newDelivery, ...prev];
        });
      }

      // Certificate: when order is certificate_generated or completed
      if (status === 'certificate_generated' || status === 'completed') {
        setCertificates(prev => {
          if (prev.some(c => c.order_ref === o.order_ref)) return prev;
          const seq = String(certSeq.current++).padStart(5, '0');
          const ref = `CERT-${new Date().getFullYear()}-${seq}`;
          const prog = o.programme.toLowerCase();
          let animalType: AnimalType = 'goat';
          if (prog.includes('cow')) animalType = 'cow';
          else if (prog.includes('sheep')) animalType = 'sheep';
          else if (prog.includes('camel')) animalType = 'camel';
          else if (prog.includes('buffalo')) animalType = 'buffalo';
          else if (prog.includes('lamb')) animalType = 'lamb';

          // Try to find linked animal
          const linked = animals.find(a => a.order_ref === o.order_ref);
          const newCert: AppCertificate = {
            id: String(Date.now()),
            certificate_ref: ref,
            order_ref: o.order_ref,
            participant_name: o.participant,
            programme_name: o.programme,
            country: o.programme.split('—')[1]?.trim() || '',
            animal_ref: linked?.animal_ref || 'Pending',
            animal_type: animalType,
            animal_label: animalType.charAt(0).toUpperCase() + animalType.slice(1),
            qurban_date: new Date().toISOString().split('T')[0],
            status: 'not_generated',
            generated_at: null,
            sent_at: null,
            verification_code: `AIGCERT-${Math.random().toString(36).slice(2,6).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`,
            year: `${new Date().getFullYear()}`,
          };
          log('certificate.created', 'certificate', ref, `Certificate ${ref} created for ${o.participant}`);
          return [newCert, ...prev];
        });
      }

      log('order.status_changed', 'order', o.order_ref,
        `Order ${o.order_ref} status changed from ${o.status} to ${status}`);
      return updated;
    }));
  }, [log, animals]);

  const cancelOrder = useCallback((id: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== id) return o;
      log('order.cancelled', 'order', o.order_ref, `Order ${o.order_ref} cancelled`);
      return { ...o, status: 'cancelled' as OrderStatus };
    }));
  }, [log]);

  // ── Animals ───────────────────────────────────────────────
  const addAnimal = useCallback((a: AppAnimal) => {
    setAnimals(prev => [a, ...prev]);
    log('animal.registered', 'animal', a.animal_ref, `Animal ${a.animal_ref} registered`);
  }, [log]);

  const updateAnimalStatus = useCallback((id: string, status: AnimalStatus) => {
    setAnimals(prev => prev.map(a => {
      if (a.id !== id) return a;
      log('animal.status_changed', 'animal', a.animal_ref, `Animal ${a.animal_ref} status → ${status}`);
      return { ...a, status };
    }));
  }, [log]);

  // ── Payments ──────────────────────────────────────────────
  const addPayment = useCallback((p: AppPayment) => {
    setPayments(prev => [p, ...prev]);
  }, []);

  const verifyPayment = useCallback((id: string) => {
    setPayments(prev => prev.map(p => {
      if (p.id !== id) return p;
      // Also advance order status to payment_verified
      setOrders(orders => orders.map(o =>
        o.order_ref === p.order_ref ? { ...o, status: 'payment_verified' as OrderStatus } : o
      ));
      log('payment.verified', 'payment', p.payment_ref, `Payment ${p.payment_ref} verified`);
      return { ...p, status: 'verified' as PaymentStatus, verified_at: new Date().toISOString() };
    }));
  }, [log]);

  const rejectPayment = useCallback((id: string) => {
    setPayments(prev => prev.map(p => {
      if (p.id !== id) return p;
      setOrders(orders => orders.map(o =>
        o.order_ref === p.order_ref ? { ...o, status: 'payment_rejected' as OrderStatus } : o
      ));
      log('payment.rejected', 'payment', p.payment_ref, `Payment ${p.payment_ref} rejected`);
      return { ...p, status: 'rejected' as PaymentStatus };
    }));
  }, [log]);

  // ── Deliveries ─────────────────────────────────────────────
  const updateDeliveryStatus = useCallback((id: string, status: DeliveryStatus) => {
    setDeliveries(prev => prev.map(d => {
      if (d.id !== id) return d;
      if (status === 'delivered') {
        setOrders(orders => orders.map(o =>
          o.order_ref === d.order_ref ? { ...o, status: 'delivered' as OrderStatus } : o
        ));
      }
      log('delivery.status_changed', 'delivery', d.delivery_ref, `Delivery ${d.delivery_ref} → ${status}`);
      return {
        ...d,
        status,
        delivered_at: status === 'delivered' ? new Date().toISOString() : d.delivered_at,
      };
    }));
  }, [log]);

  // ── Certificates ──────────────────────────────────────────
  const updateCertStatus = useCallback((id: string, status: CertificateStatus) => {
    setCertificates(prev => prev.map(c => {
      if (c.id !== id) return c;
      if (status === 'sent') {
        setOrders(orders => orders.map(o =>
          o.order_ref === c.order_ref ? { ...o, status: 'certificate_generated' as OrderStatus } : o
        ));
      }
      log('certificate.status_changed', 'certificate', c.certificate_ref,
        `Certificate ${c.certificate_ref} → ${status}`);
      return {
        ...c,
        status,
        generated_at: c.generated_at ?? (status !== 'not_generated' ? new Date().toISOString() : null),
        sent_at: status === 'sent' ? new Date().toISOString() : c.sent_at,
      };
    }));
  }, [log]);

  // ── Participants ──────────────────────────────────────────
  const addParticipant = useCallback((p: AppParticipant) => {
    setParticipants(prev => [p, ...prev]);
    log('participant.created', 'participant', p.participant_ref,
      `Participant ${p.first_name} ${p.last_name} registered`);
  }, [log]);

  // ── Suppliers ─────────────────────────────────────────────
  const addSupplier = useCallback((s: AppSupplier) => {
    setSuppliers(prev => [s, ...prev]);
    log('supplier.created', 'supplier', s.supplier_ref, `Supplier ${s.name} added`);
  }, [log]);

  const updateSupplier = useCallback((s: AppSupplier) => {
    setSuppliers(prev => prev.map(x => x.id === s.id ? s : x));
    log('supplier.updated', 'supplier', s.supplier_ref, `Supplier ${s.name} updated`);
  }, [log]);

  // ── Programmes ────────────────────────────────────────────
  const addProgramme = useCallback((p: AppProgramme) => {
    setProgrammes(prev => [p, ...prev]);
    log('programme.created', 'programme', p.id, `Programme "${p.name}" created`);
  }, [log]);

  const updateProgramme = useCallback((p: AppProgramme) => {
    setProgrammes(prev => prev.map(x => x.id === p.id ? p : x));
    log('programme.updated', 'programme', p.id, `Programme "${p.name}" updated`);
  }, [log]);

  // ── Exceptions ────────────────────────────────────────────
  const resolveException = useCallback((id: string) => {
    setExceptions(prev => prev.map(e => {
      if (e.id !== id) return e;
      log('exception.resolved', 'exception', e.id, `Exception "${e.title}" resolved`);
      return { ...e, status: 'resolved' as ExceptionStatus };
    }));
  }, [log]);

  const assignException = useCallback((id: string, person: string) => {
    setExceptions(prev => prev.map(e => {
      if (e.id !== id) return e;
      log('exception.assigned', 'exception', e.id, `Exception assigned to ${person}`);
      return { ...e, assigned_to: person, status: 'in_progress' as ExceptionStatus };
    }));
  }, [log]);

  return (
    <AppDataContext.Provider value={{
      orders, animals, payments, deliveries, certificates,
      participants, suppliers, programmes, exceptions, auditLogs,
      addOrder, updateOrderStatus, cancelOrder,
      addAnimal, updateAnimalStatus,
      addPayment, verifyPayment, rejectPayment,
      updateDeliveryStatus,
      updateCertStatus,
      addParticipant,
      addSupplier, updateSupplier,
      addProgramme, updateProgramme,
      resolveException, assignException,
    }}>
      {children}
    </AppDataContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider');
  return ctx;
}
