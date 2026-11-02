import React, { useState, useCallback, useRef } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Search, Plus, X, ChevronDown, ChevronUp, CheckCircle2, XCircle, RefreshCw, Eye, Users, Package } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { OrderStatus } from '@/lib/database.types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getStatusLabel } from '@/lib/statusEngine';
import { useToast } from '@/contexts/ToastContext';
import { useAppData, orderRank, type AppOrder as Order, type NewOrderInput, type QurbanEntry } from '@/contexts/AppDataContext';


const NEXT_STATUSES: Partial<Record<OrderStatus, OrderStatus>> = {
  draft:                 'pending_payment',
  pending_payment:       'payment_submitted',
  payment_submitted:     'payment_verified',
  payment_under_review:  'payment_verified',
  payment_rejected:      'pending_payment',
  payment_verified:      'confirmed',
  confirmed:             'animal_allocated',
  animal_allocated:      'qurban_complete',
  animal_growing:        'final_inspection',
  final_inspection:      'qurban_complete',
  qurban_complete:       'delivery_scheduled',
  processing:            'shipped',
  shipped:               'arrived',
  arrived:               'delivery_scheduled',
  delivery_scheduled:    'out_for_delivery',
  out_for_delivery:      'delivered',
  delivered:             'certificate_generated',
  certificate_generated: 'completed',
};

/** Statuses offered in the "Update Status" picker, in lifecycle order. */
const PICKER_STATUSES: OrderStatus[] = [
  'draft', 'pending_payment', 'payment_submitted', 'payment_verified', 'payment_rejected',
  'confirmed', 'animal_allocated', 'animal_growing', 'final_inspection', 'qurban_complete',
  'delivery_scheduled', 'out_for_delivery', 'delivered', 'certificate_generated', 'completed', 'cancelled',
];

const STATUS_FILTERS = [
  { label: 'All',              value: '' },
  { label: 'Draft',            value: 'draft' },
  { label: 'Pending Payment',  value: 'pending_payment' },
  { label: 'Submitted',        value: 'payment_submitted' },
  { label: 'Verified',         value: 'payment_verified' },
  { label: 'Confirmed',        value: 'confirmed' },
  { label: 'Allocated',        value: 'animal_allocated' },
  { label: 'Delivered',        value: 'delivered' },
  { label: 'Completed',        value: 'completed' },
  { label: 'Cancelled',        value: 'cancelled' },
];

const label = (s: OrderStatus) => getStatusLabel(s);

/** Short human summary of which linked records a status change touches. */
function syncSummary(status: OrderStatus): string {
  if (status === 'cancelled') return 'Linked payment, animal and delivery were cancelled/released.';
  const parts: string[] = [];
  const r = orderRank(status);
  if (r >= orderRank('pending_payment')) parts.push('Payments');
  if (r >= orderRank('animal_allocated')) parts.push('Animals');
  if (r >= orderRank('delivery_scheduled')) parts.push('Deliveries');
  if (r >= orderRank('qurban_complete')) parts.push('Certificates');
  return parts.length ? `Synced to ${parts.join(', ')}.` : '';
}

const PAGE_SIZE = 10;

// ── View Full Details Modal ────────────────────────────────────
function OrderDetailModal({ order, onClose, onStatusChange, onCancel }: {
  order: Order;
  onClose: () => void;
  onStatusChange: (id: string, next: OrderStatus) => void;
  onCancel: (id: string) => void;
}) {
  const { animals } = useAppData();
  const nextStatus = NEXT_STATUSES[order.status];
  const isCancellable = !['completed', 'cancelled', 'certificate_generated', 'delivered'].includes(order.status);
  const orderAnimals = animals.filter(a => a.order_ref === order.order_ref);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="heading-md">{order.order_ref}</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {order.participant}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {/* ORDER INFORMATION */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--aig-green-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.625rem' }}>Order Information</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }} className="settings-grid-2">
              {[
                ['Order Reference', order.order_ref],
                ['Participant',     order.participant],
                ['Contact Number',  order.contact_number || '—'],
                ['Email',          order.email || '—'],
                ['Programme',      order.programme],
                ['Service Type',   order.service_type ? order.service_type.charAt(0).toUpperCase() + order.service_type.slice(1) : '—'],
                ['No. of Qurbans', String(order.quantity)],
                ['Payment Method', order.payment_method ? order.payment_method.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—'],
                ['Total Amount',   formatCurrency(order.total_amount, order.currency)],
                ['Date Placed',    formatDate(order.created_at)],
                ['Status',         label(order.status)],
                ...(order.delivery_portion ? [['Delivery Portion', order.delivery_portion.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())]] : []),
                ...(order.notes ? [['Notes', order.notes]] : []),
              ].map(([k, v]) => (
                <div key={k} className="detail-row">
                  <div className="detail-key">{k}</div>
                  <div className="detail-val">{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* QURBAN / ANIMAL INFORMATION */}
          {orderAnimals.length > 0 && (
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--aig-green-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.625rem' }}>
                Qurban / Animal Records — {orderAnimals.length} animal(s)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {orderAnimals.map((a, i) => (
                  <div key={a.id} style={{ padding: '0.75rem 1rem', background: 'var(--surface-900)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                      <span style={{ fontFamily: 'monospace', color: 'var(--aig-green-300)', fontWeight: 700, fontSize: '0.875rem' }}>{a.animal_ref}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Qurban {i + 1}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem', fontSize: '0.8125rem' }}>
                      <div><span style={{ color: 'var(--text-muted)' }}>Qurban Name Holder: </span><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{a.qurban_name_holder || '—'}</span></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Animal Type: </span><span style={{ color: 'var(--text-secondary)' }}>{a.animal_type}</span></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Status: </span><span style={{ color: 'var(--text-secondary)' }}>{a.status.replace(/_/g, ' ')}</span></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Location: </span><span style={{ color: 'var(--text-secondary)' }}>{a.location}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {nextStatus && (
            <div style={{
              marginTop: '1.25rem',
              padding: '0.875rem 1rem',
              background: 'rgba(47,168,118,0.07)',
              border: '1px solid rgba(47,168,118,0.15)',
              borderRadius: 10,
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
            }}>
              <strong style={{ color: 'var(--aig-green-300)' }}>Next step:</strong>{' '}
              Advance to <strong>{label(nextStatus)}</strong>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          {nextStatus && (
            <button
              className="btn btn-outline-green"
              onClick={() => { onStatusChange(order.id, nextStatus); onClose(); }}
              style={{ gap: '0.5rem' }}
            >
              <RefreshCw size={14} />
              Advance to {label(nextStatus)}
            </button>
          )}
          {isCancellable && (
            <button
              className="btn"
              onClick={() => { onCancel(order.id); onClose(); }}
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', gap: '0.5rem' }}
            >
              <XCircle size={14} />
              Cancel Order
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Create Order Modal ────────────────────────────────────────
const SERVICE_TYPES = [
  { label: 'Qurban',  value: 'qurban'  },
  { label: 'Aqiqah', value: 'aqiqah'  },
  { label: 'Nazar',  value: 'nazar'   },
] as const;

const PAYMENT_METHODS = [
  { label: 'PayNow',      value: 'paynow',       indonesiaOnly: false },
  { label: 'Cash',        value: 'cash',         indonesiaOnly: false },
  { label: 'Installment', value: 'installment',  indonesiaOnly: true  },
  { label: 'Bank Transfer', value: 'bank_transfer', indonesiaOnly: false },
] as const;

const DELIVERY_PORTIONS = [
  { label: 'Full',  value: 'full'       },
  { label: '1/3',   value: 'one_third'  },
  { label: '2/3',   value: 'two_thirds' },
  { label: 'NIL',   value: 'nil'        },
] as const;

function CreateOrderModal({ onClose, onCreate }: { onClose: () => void; onCreate: (o: NewOrderInput) => Order }) {
  const { programmes } = useAppData();
  const { toast } = useToast();

  const activeProgrammes = programmes.filter(p => p.is_active);

  // ── Participant fields ────────────────────────────────────
  const [fullName,       setFullName]       = useState('');
  const [email,          setEmail]          = useState('');
  const [contactNumber,  setContactNumber]  = useState('');

  // ── Order fields ─────────────────────────────────────────
  const [programmeId,    setProgrammeId]    = useState('');
  const [serviceType,    setServiceType]    = useState<'qurban' | 'aqiqah' | 'nazar'>('qurban');
  const [paymentMethod,  setPaymentMethod]  = useState<'paynow' | 'cash' | 'installment' | 'bank_transfer'>('paynow');
  const [numQurbans,     setNumQurbans]     = useState(1);
  const [price,          setPrice]          = useState('');
  const [notes,          setNotes]          = useState('');
  const [deliveryPortion, setDeliveryPortion] = useState<string>('');
  const [initialStatus,  setInitialStatus]  = useState<OrderStatus>('pending_payment');

  // ── Dynamic qurban entries ───────────────────────────────
  const [qurbanEntries, setQurbanEntries] = useState<QurbanEntry[]>([{ qurban_name_holder: '' }]);
  const submittingRef = useRef(false);

  const selectedProg = activeProgrammes.find(p => p.id === programmeId);
  const isIndonesia  = selectedProg?.country?.toLowerCase() === 'indonesia' || selectedProg?.name?.toLowerCase().includes('indonesia');
  const isAustralia  = selectedProg?.country?.toLowerCase() === 'australia' || selectedProg?.name?.toLowerCase().includes('australia');
  const supportsPortions = isAustralia;

  // Keep qurban entries in sync with numQurbans
  const handleNumQurbans = (n: number) => {
    const count = Math.min(20, Math.max(1, Math.floor(n)));
    setNumQurbans(count);
    setQurbanEntries(prev => {
      if (count > prev.length) {
        return [...prev, ...Array(count - prev.length).fill({ qurban_name_holder: '' })];
      }
      return prev.slice(0, count);
    });
  };

  const updateQurbanEntry = (idx: number, name: string) => {
    setQurbanEntries(prev => prev.map((e, i) => i === idx ? { qurban_name_holder: name } : e));
  };

  const handleProgrammeChange = (id: string) => {
    setProgrammeId(id);
    const prog = activeProgrammes.find(p => p.id === id);
    if (prog) {
      setPrice(String(prog.price_per_share));
    }
    // Reset installment if switching to non-Indonesia
    const newIsIndonesia = prog?.country?.toLowerCase() === 'indonesia' || prog?.name?.toLowerCase().includes('indonesia');
    if (!newIsIndonesia && paymentMethod === 'installment') {
      setPaymentMethod('paynow');
    }
    // Portion only applies to Australia → Singapore; clear it on any programme change
    setDeliveryPortion('');
  };

  const availablePaymentMethods = PAYMENT_METHODS.filter(m => !m.indonesiaOnly || isIndonesia);

  const handleSubmit = () => {
    if (submittingRef.current) return; // prevent double-click duplicates
    // Validation
    if (!fullName.trim())        { toast('error', 'Validation', 'Full Name is required');           return; }
    if (!email.trim())           { toast('error', 'Validation', 'Email Address is required');        return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { toast('error', 'Validation', 'Please enter a valid email address'); return; }
    if (!contactNumber.trim())   { toast('error', 'Validation', 'Contact Number is required');      return; }
    if (!programmeId)            { toast('error', 'Validation', 'Programme is required');            return; }
    if (!serviceType)            { toast('error', 'Validation', 'Type of Service is required');     return; }
    if (!paymentMethod)          { toast('error', 'Validation', 'Payment Method is required');      return; }
    if (!(Number(price) > 0))    { toast('error', 'Validation', 'Unit Price must be greater than 0'); return; }
    if (paymentMethod === 'installment' && !isIndonesia) {
      toast('error', 'Validation', 'Installment is only available for Indonesia programmes');
      return;
    }
    if (supportsPortions && !deliveryPortion) {
      toast('error', 'Validation', 'Delivery Portion is required for Australia programmes');
      return;
    }
    // Validate all qurban entries
    for (let i = 0; i < qurbanEntries.length; i++) {
      if (!qurbanEntries[i].qurban_name_holder.trim()) {
        toast('error', 'Validation', `Qurban Name Holder is required for Qurban ${i + 1}`);
        return;
      }
    }

    const prog = activeProgrammes.find(p => p.id === programmeId);
    submittingRef.current = true;
    try {
      const created = onCreate({
        full_name: fullName.trim(),
        email: email.trim(),
        contact_number: contactNumber.trim(),
        programme: prog?.name ?? '',
        programme_id: programmeId,
        programme_country: prog?.country ?? '',
        service_type: serviceType,
        payment_method: paymentMethod,
        delivery_portion: supportsPortions ? (deliveryPortion as 'full' | 'one_third' | 'two_thirds' | 'nil') : null,
        quantity: numQurbans,
        total_amount: Number(price) * numQurbans,
        currency: prog?.currency ?? 'SGD',
        notes,
        status: initialStatus,
        qurban_entries: qurbanEntries.map(q => ({ qurban_name_holder: q.qurban_name_holder.trim() })),
      });
      toast('success', 'Order created!', `${created.order_ref} — ${numQurbans} Qurban(s) for ${fullName.trim()}. ${syncSummary(initialStatus)}`);
      onClose();
    } catch (err) {
      submittingRef.current = false;
      toast('error', 'Could not create order', err instanceof Error ? err.message : 'Unexpected error');
    }
  };

  const total = Number(price) * numQurbans;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <div>
            <div className="heading-md">New Order</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Fill in all required fields to create the order and animal records</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* ── Participant Section ── */}
            <div style={{ padding: '1rem', background: 'rgba(47,168,118,0.05)', border: '1px solid rgba(47,168,118,0.15)', borderRadius: 10 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--aig-green-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Users size={12} /> Participant / Customer
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }} className="settings-grid-2">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label" htmlFor="order-full-name">Full Name *</label>
                  <input id="order-full-name" className="form-input" placeholder="e.g. Ahmad bin Abdullah" value={fullName} onChange={e => setFullName(e.target.value)} autoFocus />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="order-email">Email Address *</label>
                  <input id="order-email" className="form-input" type="email" placeholder="email@example.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="order-contact">Contact Number *</label>
                  <input id="order-contact" className="form-input" placeholder="e.g. +65 9123 4567" value={contactNumber} onChange={e => setContactNumber(e.target.value)} />
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                ⚙ If this participant (same name + email + phone) already exists, their existing record will be reused — no duplicate will be created.
              </div>
            </div>

            {/* ── Order Details Section ── */}
            <div style={{ padding: '1rem', background: 'var(--surface-800)', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--aig-green-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Package size={12} /> Order Details
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }} className="settings-grid-2">

                {/* Programme */}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label" htmlFor="order-programme">Programme *</label>
                  <select id="order-programme" className="form-input form-select" value={programmeId} onChange={e => handleProgrammeChange(e.target.value)}>
                    <option value="">Select programme...</option>
                    {activeProgrammes.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {activeProgrammes.length === 0 && (
                    <div style={{ fontSize: '0.75rem', color: '#fbbf24', marginTop: '0.375rem' }}>
                      No active programmes found. Create or activate one on the Programmes page first.
                    </div>
                  )}
                  {selectedProg && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
                      {selectedProg.country} · {selectedProg.currency} {selectedProg.price_per_share} per share · {selectedProg.animal_type}
                    </div>
                  )}
                </div>

                {/* Type of Service */}
                <div className="form-group">
                  <label className="form-label">Type of Service *</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {SERVICE_TYPES.map(s => (
                      <button key={s.value} type="button"
                        onClick={() => setServiceType(s.value)}
                        style={{
                          flex: 1, padding: '0.5rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.8125rem',
                          border: serviceType === s.value ? '1px solid var(--aig-green-400)' : '1px solid var(--border-subtle)',
                          background: serviceType === s.value ? 'rgba(47,168,118,0.15)' : 'var(--surface-900)',
                          color: serviceType === s.value ? 'var(--aig-green-200)' : 'var(--text-muted)',
                          fontWeight: serviceType === s.value ? 600 : 400,
                        }}
                      >{s.label}</button>
                    ))}
                  </div>
                </div>

                {/* Payment Method */}
                <div className="form-group">
                  <label className="form-label" htmlFor="order-payment-method">Payment Method *</label>
                  <select id="order-payment-method" className="form-input form-select" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as typeof paymentMethod)}>
                    {availablePaymentMethods.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  {!isIndonesia && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Installment only available for Indonesia programmes</div>
                  )}
                </div>

                {/* Number of Qurbans */}
                <div className="form-group">
                  <label className="form-label" htmlFor="order-num-qurbans">Number of Qurbans *</label>
                  <input id="order-num-qurbans" className="form-input" type="number" min="1" max="20"
                    value={numQurbans}
                    onChange={e => handleNumQurbans(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>

                {/* Unit Price */}
                <div className="form-group">
                  <label className="form-label" htmlFor="order-price">Unit Price ({selectedProg?.currency ?? 'SGD'}) *</label>
                  <input id="order-price" className="form-input" type="number" min="0" step="0.01" placeholder="0.00"
                    value={price} onChange={e => setPrice(e.target.value)} />
                </div>

                {/* Australia Portion */}
                {supportsPortions && (
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Portion to be Delivered * <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Australia → Singapore)</span></label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {DELIVERY_PORTIONS.map(dp => (
                        <button key={dp.value} type="button"
                          onClick={() => setDeliveryPortion(dp.value)}
                          style={{
                            flex: 1, padding: '0.5rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.8125rem',
                            border: deliveryPortion === dp.value ? '1px solid var(--aig-green-400)' : '1px solid var(--border-subtle)',
                            background: deliveryPortion === dp.value ? 'rgba(47,168,118,0.15)' : 'var(--surface-900)',
                            color: deliveryPortion === dp.value ? 'var(--aig-green-200)' : 'var(--text-muted)',
                            fontWeight: deliveryPortion === dp.value ? 600 : 400,
                          }}
                        >{dp.label}</button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Initial Status */}
                <div className="form-group">
                  <label className="form-label" htmlFor="order-initial-status">Initial Status</label>
                  <select id="order-initial-status" className="form-input form-select" value={initialStatus} onChange={e => setInitialStatus(e.target.value as OrderStatus)}>
                    <option value="draft">Draft</option>
                    <option value="pending_payment">Pending Payment</option>
                    <option value="payment_submitted">Payment Submitted</option>
                    <option value="payment_verified">Payment Verified</option>
                  </select>
                </div>

                {/* Notes */}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label" htmlFor="order-notes">Special Requests / Notes</label>
                  <textarea id="order-notes" className="form-input" rows={2} style={{ resize: 'vertical' }}
                    placeholder="Any special instructions..."
                    value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              </div>
            </div>

            {/* ── Dynamic Qurban Entries ── */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--aig-green-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                Qurban Details — {numQurbans} Qurban(s)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {qurbanEntries.map((entry, i) => (
                  <div key={i} style={{ padding: '0.875rem', background: 'var(--surface-800)', border: '1px solid var(--border-subtle)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--aig-green-300)', minWidth: 70, fontFamily: 'monospace' }}>
                      Qurban {i + 1}
                    </div>
                    <div className="form-group" style={{ flex: 1, margin: 0 }}>
                      <input
                        className="form-input"
                        placeholder={`Qurban Name Holder ${i + 1} *`}
                        value={entry.qurban_name_holder}
                        onChange={e => updateQurbanEntry(i, e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            {price && numQurbans > 0 && (
              <div style={{ textAlign: 'right', fontSize: '0.875rem', color: 'var(--text-secondary)', paddingRight: '0.25rem' }}>
                Total: <strong style={{ color: 'var(--aig-green-300)', fontSize: '1rem' }}>
                  {selectedProg?.currency ?? 'SGD'} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </strong>
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button id="order-create-submit" className="btn btn-primary" onClick={handleSubmit}>Create Order</button>
        </div>
      </div>
    </div>
  );
}

// ── Update Status Modal ────────────────────────────────────────
function UpdateStatusModal({ order, onClose, onUpdate }: {
  order: Order;
  onClose: () => void;
  onUpdate: (id: string, status: OrderStatus) => void;
}) {
  const [selected, setSelected] = useState<OrderStatus>(order.status);
  const { toast } = useToast();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <div className="heading-md">Update Order Status</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          <div style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Order: <strong style={{ color: 'var(--text-primary)' }}>{order.order_ref}</strong>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {PICKER_STATUSES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setSelected(s)}
                style={{
                  padding: '0.575rem 0.75rem',
                  borderRadius: 8,
                  border: selected === s ? '1px solid var(--aig-green-400)' : '1px solid var(--border-subtle)',
                  background: selected === s ? 'rgba(47,168,118,0.12)' : 'var(--surface-800)',
                  color: selected === s ? 'var(--aig-green-200)' : s === 'cancelled' ? '#f87171' : 'var(--text-secondary)',
                  cursor: 'pointer', textAlign: 'left', fontSize: '0.8125rem',
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                }}
              >
                {selected === s && <CheckCircle2 size={13} />}
                {label(s)}
              </button>
            ))}
          </div>
          {selected !== order.status && syncSummary(selected) && (
            <div style={{ marginTop: '0.875rem', fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '0.625rem 0.75rem', background: 'var(--surface-900)', borderRadius: 8 }}>
              {syncSummary(selected)}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={selected === order.status} onClick={() => {
            onUpdate(order.id, selected);
            toast('success', 'Status updated!', `${order.order_ref} → ${label(selected)}. ${syncSummary(selected)}`);
            onClose();
          }}>
            Apply Status
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export function OrdersPage() {
  usePageTitle('Orders');
  const { toast } = useToast();
  const { orders, animals, addOrder, updateOrderStatus, cancelOrder: ctxCancelOrder } = useAppData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [updateStatusOrder, setUpdateStatusOrder] = useState<Order | null>(null);

  const updateStatus = useCallback((id: string, status: OrderStatus) => {
    updateOrderStatus(id, status);
    // keep detail modal in sync
    setDetailOrder(prev => prev?.id === id ? { ...prev, status } : prev);
  }, [updateOrderStatus]);

  const cancelOrder = useCallback((id: string) => {
    ctxCancelOrder(id);
    toast('info', 'Order cancelled');
  }, [ctxCancelOrder, toast]);

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const holders = animals.filter(a => a.order_ref === o.order_ref).map(a => a.qurban_name_holder ?? '').join(' ').toLowerCase();
    const matchSearch = o.order_ref.toLowerCase().includes(q) || o.participant.toLowerCase().includes(q) || o.programme.toLowerCase().includes(q)
      || (o.email ?? '').toLowerCase().includes(q) || (o.contact_number ?? '').toLowerCase().includes(q) || holders.includes(q);
    const matchStatus = !statusFilter || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="page-content animate-fadeInUp">
      {showCreate && <CreateOrderModal onClose={() => setShowCreate(false)} onCreate={addOrder} />}
      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
          onStatusChange={updateStatus}
          onCancel={cancelOrder}
        />
      )}
      {updateStatusOrder && (
        <UpdateStatusModal
          order={updateStatusOrder}
          onClose={() => setUpdateStatusOrder(null)}
          onUpdate={updateStatus}
        />
      )}

      {/* Header */}
      <div className="page-header page-header-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">Manage all Qurban orders across programmes</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Order
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        {[
          { label: 'Total Orders',    value: String(orders.length),                                         color: 'var(--aig-green-400)' },
          { label: 'Pending Payment', value: String(orders.filter(o => ['pending_payment', 'payment_submitted', 'payment_under_review', 'payment_rejected'].includes(o.status)).length), color: 'var(--warning)' },
          { label: 'In Progress',     value: String(orders.filter(o => orderRank(o.status) >= orderRank('payment_verified') && orderRank(o.status) < orderRank('completed')).length), color: 'var(--info)' },
          { label: 'Completed',       value: String(orders.filter(o => o.status === 'completed').length),       color: 'var(--success)' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ padding: '1rem' }}>
            <div className="stat-value" style={{ fontSize: '1.5rem', color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="filter-bar">
        <div className="search-bar">
          <Search className="search-icon" size={15} />
          <input
            id="orders-search" type="search" className="form-input"
            placeholder="Search by order ref, participant, or programme..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ height: 38 }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map(f => (
            <button key={f.value}
              className={`btn btn-sm ${statusFilter === f.value ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
            >{f.label}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Order Ref</th>
                <th>Participant</th>
                <th>Programme</th>
                <th>Service</th>
                <th>Payment</th>
                <th>Qurbans</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={10}>
                  <div className="empty-state" style={{ padding: '3rem 2rem' }}>
                    <div className="empty-icon"><Search size={24} color="var(--text-muted)" /></div>
                    <h3>No orders found</h3>
                    <p>Try adjusting your search or filter criteria</p>
                  </div>
                </td></tr>
              ) : paginated.map(o => (
                <React.Fragment key={o.id}>
                  <tr style={{ opacity: o.status === 'cancelled' ? 0.5 : 1 }}>
                    <td><span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--aig-green-300)' }}>{o.order_ref}</span></td>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{o.participant}</div>
                      {o.contact_number && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{o.contact_number}</div>}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{o.programme}</td>
                    <td><span className="badge badge-teal" style={{ fontSize: '0.65rem' }}>{o.service_type ?? 'qurban'}</span></td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{o.payment_method ? o.payment_method.replace('_', ' ') : '—'}</td>
                    <td style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>{o.quantity}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(o.total_amount, o.currency)}</td>
                    <td><StatusBadge status={o.status} size="sm" /></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{formatDate(o.created_at)}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setExpandedId(expandedId === o.id ? null : o.id)}
                        title="Expand row"
                      >
                        {expandedId === o.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </td>
                  </tr>

                  {/* ── Expanded inline row ── */}
                  {expandedId === o.id && (
                    <tr>
                      <td colSpan={10} style={{ background: 'var(--surface-900)', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', marginBottom: '1rem' }}>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Programme</div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{o.programme}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Service Type</div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{o.service_type ?? 'qurban'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Payment</div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{o.payment_method ? o.payment_method.replace(/_/g, ' ') : '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Current Status</div>
                            <StatusBadge status={o.status} size="sm" />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
                          {/* View Full Details — opens modal */}
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ gap: '0.375rem' }}
                            onClick={() => setDetailOrder(o)}
                          >
                            <Eye size={13} /> View Full Details
                          </button>

                          {/* Update Status — opens status picker modal */}
                          {o.status !== 'cancelled' && (
                            <button
                              className="btn btn-sm"
                              style={{ gap: '0.375rem', background: 'rgba(47,168,118,0.1)', border: '1px solid rgba(47,168,118,0.2)', color: 'var(--aig-green-300)' }}
                              onClick={() => setUpdateStatusOrder(o)}
                            >
                              <RefreshCw size={13} /> Update Status
                            </button>
                          )}

                          {/* Cancel Order */}
                          {!['completed','cancelled','certificate_generated','delivered'].includes(o.status) && (
                            <button
                              className="btn btn-sm"
                              style={{ gap: '0.375rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
                              onClick={() => {
                                cancelOrder(o.id);
                                setExpandedId(null);
                              }}
                            >
                              <XCircle size={13} /> Cancel Order
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.875rem 1.25rem',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.8125rem', color: 'var(--text-muted)',
        }}>
          <span>Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} orders</span>
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >← Prev</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                className={`btn btn-sm ${page === p ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPage(p)}
              >{p}</button>
            ))}
            <button
              className="btn btn-secondary btn-sm"
              disabled={page === totalPages || totalPages === 0}
              onClick={() => setPage(p => p + 1)}
            >Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
