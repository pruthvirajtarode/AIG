import React, { useState, useCallback, useRef, useMemo } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  Search, Plus, X, ChevronDown, ChevronUp, CheckCircle2,
  XCircle, RefreshCw, Eye, Users, Package, Edit3, AlertCircle, Trash2,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { OrderStatus, PaymentStatus } from '@/lib/database.types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getStatusLabel } from '@/lib/statusEngine';
import {
  AUSTRALIA_SINGAPORE_PORTION_OPTIONS,
  ORDER_PAYMENT_OPTIONS,
  ORDER_SERVICE_OPTIONS,
  animalCodeForOrder,
  defaultApproxWeight,
  formatDeliveryPortion,
  formatPaymentMethod,
  formatServiceType,
  isAustraliaToSingaporeProgramme,
  isBreedingProgramme,
  isIndonesiaProgramme,
  nextOrderRef,
  normaliseOrderRef,
  participantsMatch,
  summarizeOrderPortions,
  validateOrderCandidate,
  type OrderDeliveryPortion,
} from '@/lib/orderRules';
import { useToast } from '@/contexts/ToastContext';
import {
  useAppData,
  orderRank,
  uid,
  type AppOrder as Order,
  type AppPayment,
  type NewOrderInput,
  type UpdateOrderInput,
  type QurbanEntry,
} from '@/contexts/AppDataContext';

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

const PAYMENT_STATUS_BADGE: Record<PaymentStatus, string> = {
  pending:      'badge-yellow',
  submitted:    'badge-orange',
  under_review: 'badge-orange',
  verified:     'badge-green',
  rejected:     'badge-red',
  refunded:     'badge-gray',
  cancelled:    'badge-gray',
};

const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending:      'Pending',
  submitted:    'Submitted',
  under_review: 'Under Review',
  verified:     'Verified',
  rejected:     'Rejected',
  refunded:     'Refunded',
  cancelled:    'Cancelled',
};

const label = (s: OrderStatus) => getStatusLabel(s);

function derivePaymentStatus(order: Order, payment?: AppPayment): { text: string; badgeClass: string } {
  if (payment) {
    return {
      text: PAYMENT_STATUS_LABEL[payment.status],
      badgeClass: PAYMENT_STATUS_BADGE[payment.status],
    };
  }
  if (order.status === 'draft') return { text: 'Not Created (Draft)', badgeClass: 'badge-gray' };
  if (order.status === 'cancelled') return { text: 'Cancelled', badgeClass: 'badge-gray' };
  return { text: 'Pending', badgeClass: 'badge-yellow' };
}

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
function OrderDetailModal({ order, onClose, onEdit, onStatusChange, onCancel, onRequestDelete }: {
  order: Order;
  onClose: () => void;
  onEdit: (order: Order) => void;
  onStatusChange: (id: string, next: OrderStatus) => void;
  onCancel: (id: string) => void;
  onRequestDelete: (order: Order) => void;
}) {
  const { animals, payments, programmes, recordInstallmentPayment, sendInstallmentReminder } = useAppData();
  const { toast } = useToast();
  const [reminding, setReminding] = useState(false);
  const nextStatus = NEXT_STATUSES[order.status];
  const isCancellable = order.status !== 'cancelled';
  const isDeletable = ['cancelled', 'draft', 'pending_payment', 'payment_rejected'].includes(order.status);
  const orderAnimals = useMemo(
    () =>
      animals
        .filter(a => a.order_ref === order.order_ref)
        .sort((a, b) => (a.animal_code ?? a.animal_ref).localeCompare(b.animal_code ?? b.animal_ref)),
    [animals, order.order_ref],
  );
  const linkedPayment = payments.find(p => p.order_ref === order.order_ref);
  const payStatus = derivePaymentStatus(order, linkedPayment);
  const isAuSg = isAustraliaToSingaporeProgramme(order.programme, order.programme_country);
  const matchedProg = programmes.find(p => (order.programme_id && p.id === order.programme_id) || p.name === order.programme);
  const isBreeding = isBreedingProgramme(order.programme, matchedProg?.supports_weight_timeline);
  const portionSummary = summarizeOrderPortions(orderAnimals.map(a => a.delivery_portion), order.delivery_portion);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 740 }}>
        <div className="modal-header">
          <div>
            <div className="heading-md" style={{ fontFamily: 'monospace', color: 'var(--aig-green-300)' }}>
              {order.order_ref}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {order.participant} · Created {formatDate(order.created_at)}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          {/* ORDER INFORMATION */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--aig-green-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.625rem' }}>
              Order Information
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }} className="settings-grid-2">
              <div className="detail-row">
                <div className="detail-key">Order Reference</div>
                <div className="detail-val" style={{ fontFamily: 'monospace', color: 'var(--aig-green-300)', fontWeight: 700 }}>{order.order_ref}</div>
              </div>
              <div className="detail-row">
                <div className="detail-key">Participant</div>
                <div className="detail-val">{order.participant}</div>
              </div>
              <div className="detail-row">
                <div className="detail-key">Contact</div>
                <div className="detail-val">{order.contact_number || '—'}</div>
              </div>
              <div className="detail-row">
                <div className="detail-key">Email</div>
                <div className="detail-val">{order.email || '—'}</div>
              </div>
              <div className="detail-row" style={{ gridColumn: '1 / -1' }}>
                <div className="detail-key">Programme</div>
                <div className="detail-val">{order.programme}</div>
              </div>
              <div className="detail-row">
                <div className="detail-key">Service Type</div>
                <div className="detail-val">{formatServiceType(order.service_type)}</div>
              </div>
              <div className="detail-row">
                <div className="detail-key">Number of Qurbans</div>
                <div className="detail-val">{order.quantity} ({orderAnimals.length} animal{orderAnimals.length === 1 ? '' : 's'})</div>
              </div>
              <div className="detail-row">
                <div className="detail-key">Payment Method</div>
                <div className="detail-val">{formatPaymentMethod(order.payment_method)}</div>
              </div>
              <div className="detail-row">
                <div className="detail-key">Payment Status</div>
                <div className="detail-val">
                  <span className={`badge ${payStatus.badgeClass}`} style={{ fontSize: '0.7rem' }}>
                    {payStatus.text}
                  </span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-key">Order Status</div>
                <div className="detail-val"><StatusBadge status={order.status} size="sm" /></div>
              </div>
              <div className="detail-row">
                <div className="detail-key">Total Amount</div>
                <div className="detail-val" style={{ fontWeight: 700 }}>{formatCurrency(order.total_amount, order.currency)}</div>
              </div>
              {(isAuSg || portionSummary !== '—') && (
                <div className="detail-row" style={{ gridColumn: '1 / -1' }}>
                  <div className="detail-key">Portion to be Delivered (Australia → Singapore)</div>
                  <div className="detail-val" style={{ fontWeight: 600, color: 'var(--aig-green-300)' }}>
                    {portionSummary}
                  </div>
                </div>
              )}
              {order.notes && (
                <div className="detail-row" style={{ gridColumn: '1 / -1' }}>
                  <div className="detail-key">Notes</div>
                  <div className="detail-val">{order.notes}</div>
                </div>
              )}
            </div>
          </div>

          {order.payment_method === 'installment' && (() => {
            const totalCount = order.installment_count ?? order.installment_schedule?.length ?? 2;
            const schedule = order.installment_schedule ?? Array.from({ length: totalCount }, (_, i) => ({
              installmentNumber: i + 1,
              amount: Number((order.total_amount / totalCount).toFixed(2)),
              currency: order.currency,
              dueDate: order.created_at,
              status: (i < (order.installments_paid ?? 0) ? 'verified' : 'pending') as 'verified' | 'pending',
            }));
            const paidCount = schedule.filter(s => s.status === 'verified').length;
            const remaining = Math.max(0, totalCount - paidCount);
            return (
              <div style={{ padding: '0.875rem', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--surface-900)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.625rem' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--aig-green-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Installment Schedule — {paidCount} of {totalCount} Paid
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                      {remaining > 0 ? `${remaining} installment${remaining === 1 ? '' : 's'} remaining` : 'All installments verified'}
                    </div>
                  </div>
                  {remaining > 0 && order.status !== 'cancelled' && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          recordInstallmentPayment(order.id);
                          toast('success', 'Installment recorded', `Installment ${paidCount + 1}/${totalCount} recorded for ${order.order_ref}.${remaining - 1 > 0 ? ' Reminder sent for remaining balance.' : ' Payment fully verified!'}`);
                        }}
                      >
                        Record Installment {paidCount + 1}/{totalCount}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={reminding}
                        onClick={async () => {
                          setReminding(true);
                          try {
                            await sendInstallmentReminder(order.id);
                            toast('success', 'Reminder sent', `Installment reminder sent to ${order.participant}.`);
                          } finally {
                            setReminding(false);
                          }
                        }}
                      >
                        {reminding ? 'Sending…' : 'Send Nudge Reminder'}
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem' }}>
                  {schedule.map(item => (
                    <div
                      key={item.installmentNumber}
                      style={{
                        padding: '0.5rem 0.625rem',
                        borderRadius: 8,
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--surface-800)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.375rem',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>#{item.installmentNumber} · {formatCurrency(item.amount, item.currency)}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Due {formatDate(item.dueDate)}</div>
                      </div>
                      <span className={`badge ${item.status === 'verified' ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize: '0.65rem' }}>
                        {item.status === 'verified' ? 'Paid' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* QURBAN / ANIMAL INFORMATION */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.625rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--aig-green-400)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Qurban / Animal Information — {orderAnimals.length} Animal{orderAnimals.length === 1 ? '' : 's'}
              </div>
              {orderAnimals.length > 1 && (
                <span className="badge badge-teal" style={{ fontSize: '0.68rem' }}>
                  Shared Order Reference: {order.order_ref}
                </span>
              )}
            </div>

            {orderAnimals.length > 1 && (
              <div style={{
                marginBottom: '0.625rem',
                padding: '0.5rem 0.75rem',
                borderRadius: 8,
                background: 'rgba(47,168,118,0.06)',
                border: '1px solid rgba(47,168,118,0.18)',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
              }}>
                All <strong>{orderAnimals.length}</strong> Qurban entries below belong to Order Reference{' '}
                <strong style={{ fontFamily: 'monospace', color: 'var(--aig-green-300)' }}>{order.order_ref}</strong>, each with its own unique Animal Code.
              </div>
            )}

            {orderAnimals.length === 0 ? (
              <div style={{ padding: '1rem', background: 'var(--surface-900)', borderRadius: 8, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                No animal records linked to this order yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {orderAnimals.map((a, i) => {
                  const code = a.animal_code || a.animal_ref;
                  const portion = a.delivery_portion ?? order.delivery_portion;
                  const approxLabel = a.approx_weight || matchedProg?.approx_weight_label || defaultApproxWeight(a.programme || order.programme, a.animal_type);
                  return (
                    <div
                      key={a.id}
                      style={{
                        padding: '0.875rem 1rem',
                        background: 'var(--surface-900)',
                        borderRadius: 8,
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gold-400, #d4a832)' }}>
                            Qurban {i + 1}
                          </span>
                          <span style={{ fontFamily: 'monospace', color: 'var(--aig-green-300)', fontWeight: 700, fontSize: '0.875rem' }}>
                            {code}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                          Order Ref: {a.order_ref || order.order_ref}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 1rem', fontSize: '0.8125rem' }} className="settings-grid-2">
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Qurban Name Holder: </span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{a.qurban_name_holder || '—'}</span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Animal Code: </span>
                          <span style={{ fontFamily: 'monospace', color: 'var(--aig-green-300)' }}>{code}</span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Programme: </span>
                          <span style={{ color: 'var(--text-secondary)' }}>{a.programme || order.programme}</span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Animal Status: </span>
                          <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{a.status.replace(/_/g, ' ')}</span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Service Type: </span>
                          <span style={{ color: 'var(--text-secondary)' }}>{formatServiceType(a.service_type || order.service_type)}</span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Animal / Location: </span>
                          <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{a.animal_type} · {a.location}</span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>{isBreeding ? 'Weight Updates: ' : 'Approx. Weight: '}</span>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {isBreeding
                              ? (a.current_weight_kg > 0
                                  ? `${a.current_weight_kg} kg${a.weight_history?.length ? ` (${a.weight_history.length} update${a.weight_history.length === 1 ? '' : 's'})` : ''}`
                                  : approxLabel)
                              : approxLabel}
                          </span>
                        </div>
                        {(isAuSg || portion) && (
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Portion to be Delivered: </span>
                            <span style={{ color: 'var(--aig-green-300)', fontWeight: 600 }}>{formatDeliveryPortion(portion)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

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
        <div className="modal-footer" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          {order.status !== 'cancelled' && (
            <button
              className="btn btn-secondary"
              onClick={() => { onClose(); onEdit(order); }}
              style={{ gap: '0.5rem' }}
            >
              <Edit3 size={14} /> Edit Order
            </button>
          )}
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
          {isDeletable && (
            <button
              className="btn"
              onClick={() => { onClose(); onRequestDelete(order); }}
              style={{ background: 'rgba(220,38,38,0.18)', border: '1px solid rgba(220,38,38,0.4)', color: '#fca5a5', gap: '0.5rem' }}
              data-testid="detail-delete-order-btn"
            >
              <Trash2 size={14} />
              Delete Permanently
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Permanent Delete Order Confirmation Modal ──────────────────
function DeleteOrderModal({
  order,
  linkedCounts,
  onClose,
  onConfirmDelete,
}: {
  order: Order;
  linkedCounts: { animals: number; payments: number; deliveries: number; certificates: number };
  onClose: () => void;
  onConfirmDelete: (id: string) => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }} data-testid="delete-order-modal">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Trash2 size={18} color="#f87171" />
            <div className="heading-md">Permanently Delete Order</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            Are you sure you want to permanently delete{' '}
            <strong style={{ fontFamily: 'monospace', color: 'var(--aig-green-300)' }}>{order.order_ref}</strong>{' '}
            for <strong>{order.participant}</strong> ({order.programme})?
          </div>
          <div style={{
            padding: '0.75rem 0.875rem',
            borderRadius: 8,
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            fontSize: '0.8rem',
            color: '#fca5a5',
            lineHeight: 1.55,
          }}>
            <strong>Recommended for real orders:</strong> Keep orders as <em>Cancelled</em> for financial audit records. Only permanently delete test orders, duplicate entries, or mistaken drafts.
            <div style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
              This will permanently remove: <strong>{linkedCounts.animals}</strong> animal allocation(s),{' '}
              <strong>{linkedCounts.payments}</strong> payment(s), <strong>{linkedCounts.deliveries}</strong> delivery record(s), and{' '}
              <strong>{linkedCounts.certificates}</strong> certificate(s). An <code>order.deleted</code> audit log entry will be kept.
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Keep Order</button>
          <button
            className="btn"
            style={{ background: '#dc2626', border: '1px solid #ef4444', color: '#fff', gap: '0.45rem' }}
            onClick={() => { onConfirmDelete(order.id); onClose(); }}
            data-testid="confirm-delete-order-btn"
          >
            <Trash2 size={14} /> Delete Order Permanently
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create Order Modal ────────────────────────────────────────
function CreateOrderModal({ onClose, onCreate }: { onClose: () => void; onCreate: (o: NewOrderInput) => Order }) {
  const { programmes, orders, participants } = useAppData();
  const { toast } = useToast();

  const activeProgrammes = useMemo(() => programmes.filter(p => p.is_active), [programmes]);
  const suggestedOrderRef = useMemo(() => nextOrderRef(orders.map(o => o.order_ref)), [orders]);
  const clientRequestIdRef = useRef<string>(uid());

  // ── Order Reference (confirmable) ─────────────────────────
  const [orderRef, setOrderRef] = useState(suggestedOrderRef);

  // ── Participant fields ────────────────────────────────────
  const [fullName,      setFullName]      = useState('');
  const [email,         setEmail]         = useState('');
  const [contactNumber, setContactNumber] = useState('');

  // ── Order fields ─────────────────────────────────────────
  const [programmeId,     setProgrammeId]     = useState('');
  const [serviceType,     setServiceType]     = useState<'qurban' | 'aqiqah'>('qurban');
  const [paymentMethod,   setPaymentMethod]   = useState<'paynow' | 'cash' | 'installment'>('paynow');
  const [installmentCount, setInstallmentCount] = useState<number>(2);
  const [numQurbans,      setNumQurbans]      = useState(1);
  const [numQurbansInput, setNumQurbansInput] = useState('1');
  const [price,           setPrice]           = useState('');
  const [notes,           setNotes]           = useState('');
  const [initialStatus,   setInitialStatus]   = useState<OrderStatus>('pending_payment');
  const [formError,       setFormError]       = useState<string | null>(null);

  // ── Dynamic qurban entries (each carries its own Qurban Name Holder + optional Portion) ──
  const [qurbanEntries, setQurbanEntries] = useState<QurbanEntry[]>([{ qurban_name_holder: '', delivery_portion: null }]);
  const submittingRef = useRef(false);

  const selectedProg = activeProgrammes.find(p => p.id === programmeId);
  const isIndonesia = selectedProg ? isIndonesiaProgramme(selectedProg.name, selectedProg.country) : false;
  const supportsPortions = selectedProg
    ? isAustraliaToSingaporeProgramme(selectedProg.name, selectedProg.country)
    : false;

  // Live participant match preview (Full Name + Email + Contact Number)
  const matchedParticipant = useMemo(() => {
    if (!fullName.trim() || !email.trim() || !contactNumber.trim()) return undefined;
    return participants.find(p =>
      participantsMatch(
        { full_name: fullName, email, contact_number: contactNumber },
        p,
      ),
    );
  }, [participants, fullName, email, contactNumber]);

  const syncQurbanCount = (n: number) => {
    const count = Math.min(50, Math.max(1, Math.floor(n)));
    setNumQurbans(count);
    setNumQurbansInput(String(count));
    setQurbanEntries(prev => {
      if (count > prev.length) {
        return [
          ...prev,
          ...Array.from({ length: count - prev.length }, () => ({ qurban_name_holder: '', delivery_portion: null })),
        ];
      }
      return prev.slice(0, count);
    });
  };

  const handleNumInputChange = (raw: string) => {
    setNumQurbansInput(raw);
    const parsed = parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 1) {
      const clamped = Math.min(50, parsed);
      setNumQurbans(clamped);
      setQurbanEntries(prev => {
        if (clamped > prev.length) {
          return [
            ...prev,
            ...Array.from({ length: clamped - prev.length }, () => ({ qurban_name_holder: '', delivery_portion: null })),
          ];
        }
        return prev.slice(0, clamped);
      });
    }
  };

  const handleNumInputBlur = () => {
    const parsed = parseInt(numQurbansInput, 10);
    syncQurbanCount(Number.isFinite(parsed) && parsed >= 1 ? parsed : 1);
  };

  const updateQurbanEntry = (idx: number, name: string) => {
    setQurbanEntries(prev => prev.map((e, i) => (i === idx ? { ...e, qurban_name_holder: name } : e)));
  };

  const updateQurbanPortion = (idx: number, portion: OrderDeliveryPortion) => {
    setQurbanEntries(prev => prev.map((e, i) => (i === idx ? { ...e, delivery_portion: portion } : e)));
  };

  const handleProgrammeChange = (id: string) => {
    setProgrammeId(id);
    setFormError(null);
    const prog = activeProgrammes.find(p => p.id === id);
    if (prog) {
      setPrice(String(prog.price_per_share));
    }
    const nextIsIndonesia = prog ? isIndonesiaProgramme(prog.name, prog.country) : false;
    if (!nextIsIndonesia && paymentMethod === 'installment') {
      setPaymentMethod('paynow');
    }
    const nextSupportsPortions = prog ? isAustraliaToSingaporeProgramme(prog.name, prog.country) : false;
    if (!nextSupportsPortions) {
      setQurbanEntries(prev => prev.map(e => ({ ...e, delivery_portion: null })));
    }
  };

  const availablePaymentMethods = ORDER_PAYMENT_OPTIONS.filter(m => !m.indonesiaOnly || isIndonesia);

  const effectiveOrderRef = normaliseOrderRef(orderRef) || suggestedOrderRef;

  const handleSubmit = () => {
    if (submittingRef.current) return;
    setFormError(null);

    const parsedQty = parseInt(numQurbansInput, 10);
    if (!Number.isFinite(parsedQty) || parsedQty < 1) {
      const msg = 'Number of Qurbans is required and must be at least 1.';
      setFormError(msg);
      toast('error', 'Validation', msg);
      return;
    }
    if (!orderRef.trim()) {
      const msg = 'Order Reference is required.';
      setFormError(msg);
      toast('error', 'Validation', msg);
      return;
    }

    const prog = activeProgrammes.find(p => p.id === programmeId);
    const unitPrice = Number(price);
    if (!prog) {
      const msg = 'Programme is required.';
      setFormError(msg);
      toast('error', 'Validation', msg);
      return;
    }
    if (!(unitPrice > 0)) {
      const msg = 'Unit Price must be greater than 0.';
      setFormError(msg);
      toast('error', 'Validation', msg);
      return;
    }

    const preparedEntries: QurbanEntry[] = qurbanEntries.map(q => ({
      qurban_name_holder: q.qurban_name_holder.trim(),
      delivery_portion: supportsPortions ? (q.delivery_portion ?? null) : null,
    }));

    const validation = validateOrderCandidate(
      {
        order_ref: effectiveOrderRef,
        full_name: fullName,
        email,
        contact_number: contactNumber,
        programme: prog.name,
        programme_id: prog.id,
        programme_country: prog.country,
        service_type: serviceType,
        payment_method: paymentMethod,
        delivery_portion: supportsPortions ? (preparedEntries[0]?.delivery_portion ?? null) : null,
        quantity: parsedQty,
        total_amount: unitPrice * parsedQty,
        qurban_entries: preparedEntries,
      },
      {
        existingOrderRefs: orders.map(o => o.order_ref),
        knownProgrammes: programmes,
      },
    );

    if (!validation.valid) {
      setFormError(validation.error);
      toast('error', 'Validation', validation.error);
      return;
    }

    submittingRef.current = true;
    try {
      const created = onCreate({
        order_ref: effectiveOrderRef,
        client_request_id: clientRequestIdRef.current,
        full_name: fullName.trim(),
        email: email.trim(),
        contact_number: contactNumber.trim(),
        programme: prog.name,
        programme_id: prog.id,
        programme_country: prog.country,
        service_type: serviceType,
        payment_method: paymentMethod,
        installment_count: paymentMethod === 'installment' ? installmentCount : undefined,
        delivery_portion: validation.normalizedPortion,
        quantity: parsedQty,
        total_amount: unitPrice * parsedQty,
        currency: prog.currency ?? 'SGD',
        notes,
        status: initialStatus,
        qurban_entries: preparedEntries,
      });
      toast(
        'success',
        'Order created!',
        `${created.order_ref} — ${parsedQty} ${formatServiceType(serviceType)} entry/entries for ${fullName.trim()}. ${syncSummary(initialStatus)}`,
      );
      onClose();
    } catch (err) {
      submittingRef.current = false;
      const msg = err instanceof Error ? err.message : 'Unexpected error';
      setFormError(msg);
      toast('error', 'Could not create order', msg);
    }
  };

  const total = (Number(price) || 0) * numQurbans;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <div>
            <div className="heading-md">New Order</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Confirm Order Reference, participant details, programme, and Qurban entries
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {formError && (
              <div style={{
                padding: '0.75rem 0.875rem',
                borderRadius: 8,
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#fca5a5',
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{formError}</span>
              </div>
            )}

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
              <div style={{ fontSize: '0.75rem', color: matchedParticipant ? 'var(--success)' : 'var(--text-muted)', marginTop: '0.5rem' }}>
                {matchedParticipant
                  ? `✓ Existing participant matched (${matchedParticipant.participant_ref}) — order will be linked without creating a duplicate.`
                  : fullName.trim() && email.trim() && contactNumber.trim()
                    ? 'New participant profile & portal access will be created and linked to this order.'
                    : '⚙ Matching Full Name + Email + Contact Number reuses an existing participant; otherwise a new participant & portal access are created.'}
              </div>
            </div>

            {/* ── Order Details Section ── */}
            <div style={{ padding: '1rem', background: 'var(--surface-800)', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--aig-green-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Package size={12} /> Order Details
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }} className="settings-grid-2">

                {/* Order Reference (confirmable) */}
                <div className="form-group">
                  <label className="form-label" htmlFor="order-reference">Order Reference *</label>
                  <input
                    id="order-reference"
                    className="form-input"
                    style={{ fontFamily: 'monospace', color: 'var(--aig-green-300)', fontWeight: 600 }}
                    placeholder="e.g. ORD-10025"
                    value={orderRef}
                    onChange={e => setOrderRef(e.target.value)}
                  />
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Unique grouping reference shared by all animals in this order
                  </div>
                </div>

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
                      {' · '}
                      {selectedProg.approx_weight_label || defaultApproxWeight(selectedProg.name, selectedProg.animal_type)}
                    </div>
                  )}
                </div>

                {/* Type of Service */}
                <div className="form-group">
                  <label className="form-label">Type of Service *</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {ORDER_SERVICE_OPTIONS.map(s => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setServiceType(s.value)}
                        style={{
                          flex: 1, padding: '0.5rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.8125rem',
                          border: serviceType === s.value ? '1px solid var(--aig-green-400)' : '1px solid var(--border-subtle)',
                          background: serviceType === s.value ? 'rgba(47,168,118,0.15)' : 'var(--surface-900)',
                          color: serviceType === s.value ? 'var(--aig-green-200)' : 'var(--text-muted)',
                          fontWeight: serviceType === s.value ? 600 : 400,
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment Method */}
                <div className="form-group">
                  <label className="form-label" htmlFor="order-payment-method">Payment Method *</label>
                  <select
                    id="order-payment-method"
                    className="form-input form-select"
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value as typeof paymentMethod)}
                  >
                    {availablePaymentMethods.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  {!isIndonesia && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Installment is only available for Indonesia programmes
                    </div>
                  )}
                </div>

                {/* Number of Installments (only when Payment Method = Installment) */}
                {paymentMethod === 'installment' && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="order-installment-count">Number of Installments *</label>
                    <select
                      id="order-installment-count"
                      className="form-input form-select"
                      value={installmentCount}
                      onChange={e => setInstallmentCount(Number(e.target.value))}
                    >
                      {[2, 3, 4, 6].map(n => (
                        <option key={n} value={n}>
                          {n} Installments ({formatCurrency(((parseFloat(price) || 0) * numQurbans) / n, selectedProg?.currency ?? 'SGD')} each)
                        </option>
                      ))}
                    </select>
                    <div style={{ fontSize: '0.7rem', color: 'var(--aig-green-300)', marginTop: '0.25rem' }}>
                      {installmentCount} × {formatCurrency(((parseFloat(price) || 0) * numQurbans) / installmentCount, selectedProg?.currency ?? 'SGD')} · Registered as Pending Payment with automated installment nudges
                    </div>
                  </div>
                )}

                {/* Number of Qurbans */}
                <div className="form-group">
                  <label className="form-label" htmlFor="order-num-qurbans">Number of Qurbans *</label>
                  <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => syncQurbanCount(numQurbans - 1)}
                      disabled={numQurbans <= 1}
                      aria-label="Decrease Number of Qurbans"
                      style={{ height: 38, padding: '0 0.75rem' }}
                    >
                      −
                    </button>
                    <input
                      id="order-num-qurbans"
                      className="form-input"
                      type="number"
                      min="1"
                      max="50"
                      value={numQurbansInput}
                      onChange={e => handleNumInputChange(e.target.value)}
                      onBlur={handleNumInputBlur}
                      style={{ textAlign: 'center' }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => syncQurbanCount(numQurbans + 1)}
                      aria-label="Increase Number of Qurbans"
                      style={{ height: 38, padding: '0 0.75rem' }}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Unit Price */}
                <div className="form-group">
                  <label className="form-label" htmlFor="order-price">Unit Price ({selectedProg?.currency ?? 'SGD'}) *</label>
                  <input
                    id="order-price"
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                  />
                </div>

                {/* Notes */}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label" htmlFor="order-notes">Special Requests / Notes</label>
                  <textarea
                    id="order-notes"
                    className="form-input"
                    rows={2}
                    style={{ resize: 'vertical' }}
                    placeholder="Any special instructions..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* ── Dynamic Qurban Details Cards ── */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--aig-green-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Qurban Details — {numQurbans} {numQurbans === 1 ? 'Qurban' : 'Qurbans'}
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  Order Ref: {effectiveOrderRef}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {qurbanEntries.map((entry, i) => {
                  const previewAnimalCode = animalCodeForOrder(effectiveOrderRef, i);
                  return (
                    <div
                      key={i}
                      style={{
                        padding: '0.875rem 1rem',
                        background: 'var(--surface-800)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 10,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--aig-green-300)' }}>
                          Qurban {i + 1}
                        </span>
                        <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                          Animal Code: <strong style={{ color: 'var(--aig-green-300)' }}>{previewAnimalCode}</strong>
                        </span>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" htmlFor={`qurban-holder-${i}`} style={{ fontSize: '0.75rem' }}>
                          Qurban Name Holder *
                        </label>
                        <input
                          id={`qurban-holder-${i}`}
                          className="form-input"
                          placeholder={`Enter Qurban Name Holder for Qurban ${i + 1}`}
                          value={entry.qurban_name_holder}
                          onChange={e => updateQurbanEntry(i, e.target.value)}
                        />
                      </div>
                      {supportsPortions && (
                        <div className="form-group" style={{ margin: '0.625rem 0 0' }}>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>
                            Portion to be Delivered * <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Australia → Singapore)</span>
                          </label>
                          <div className="portion-btn-group">
                            {AUSTRALIA_SINGAPORE_PORTION_OPTIONS.map(dp => {
                              const active = entry.delivery_portion === dp.value;
                              return (
                                <button
                                  key={dp.value}
                                  type="button"
                                  onClick={() => updateQurbanPortion(i, dp.value)}
                                  style={{
                                    flex: 1,
                                    padding: '0.45rem 0.5rem',
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    fontSize: '0.8125rem',
                                    border: active ? '1px solid var(--aig-green-400)' : '1px solid var(--border-subtle)',
                                    background: active ? 'rgba(47,168,118,0.15)' : 'var(--surface-900)',
                                    color: active ? 'var(--aig-green-200)' : 'var(--text-muted)',
                                    fontWeight: active ? 600 : 400,
                                  }}
                                >
                                  {dp.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Total */}
            {price && numQurbans > 0 && (
              <div style={{ textAlign: 'right', fontSize: '0.875rem', color: 'var(--text-secondary)', paddingRight: '0.25rem' }}>
                Total:{' '}
                <strong style={{ color: 'var(--aig-green-300)', fontSize: '1rem' }}>
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

// ── Edit Order Modal (idempotent animal sync, zero duplicates) ─
function EditOrderModal({ order, onClose, onSave }: {
  order: Order;
  onClose: () => void;
  onSave: (id: string, patch: UpdateOrderInput) => Order;
}) {
  const { programmes, animals } = useAppData();
  const { toast } = useToast();

  const existingAnimals = useMemo(
    () =>
      animals
        .filter(a => a.order_ref === order.order_ref)
        .sort((a, b) => (a.animal_code ?? a.animal_ref).localeCompare(b.animal_code ?? b.animal_ref)),
    [animals, order.order_ref],
  );

  const selectableProgrammes = useMemo(
    () => programmes.filter(p => p.is_active || p.id === order.programme_id || p.name === order.programme),
    [programmes, order.programme_id, order.programme],
  );

  const initialProg = selectableProgrammes.find(
    p => (order.programme_id && p.id === order.programme_id) || p.name === order.programme,
  );

  const [fullName, setFullName] = useState(order.participant);
  const [email, setEmail] = useState(order.email ?? '');
  const [contactNumber, setContactNumber] = useState(order.contact_number ?? '');
  const [programmeId, setProgrammeId] = useState(initialProg?.id ?? '');
  const [serviceType, setServiceType] = useState<'qurban' | 'aqiqah' | 'nazar'>(order.service_type ?? 'qurban');
  const [paymentMethod, setPaymentMethod] = useState<'paynow' | 'cash' | 'installment' | 'bank_transfer'>(order.payment_method ?? 'paynow');
  const [installmentCount, setInstallmentCount] = useState<number>(order.installment_count ?? 2);
  const [numQurbans, setNumQurbans] = useState(order.quantity);
  const [numQurbansInput, setNumQurbansInput] = useState(String(order.quantity));
  const [unitPrice, setUnitPrice] = useState(
    String(order.quantity > 0 ? Number((order.total_amount / order.quantity).toFixed(2)) : initialProg?.price_per_share ?? 0),
  );
  const [notes, setNotes] = useState(order.notes ?? '');
  const [qurbanEntries, setQurbanEntries] = useState<QurbanEntry[]>(() =>
    Array.from({ length: order.quantity }, (_, i) => ({
      qurban_name_holder: existingAnimals[i]?.qurban_name_holder ?? order.participant,
      delivery_portion: existingAnimals[i]?.delivery_portion ?? order.delivery_portion ?? null,
    })),
  );
  const [formError, setFormError] = useState<string | null>(null);

  const selectedProg = selectableProgrammes.find(p => p.id === programmeId);
  const progName = selectedProg?.name ?? order.programme;
  const progCountry = selectedProg?.country ?? order.programme_country ?? '';
  const isIndonesia = isIndonesiaProgramme(progName, progCountry);
  const supportsPortions = isAustraliaToSingaporeProgramme(progName, progCountry);

  const syncCount = (n: number) => {
    const count = Math.min(50, Math.max(1, Math.floor(n)));
    setNumQurbans(count);
    setNumQurbansInput(String(count));
    setQurbanEntries(prev => {
      if (count > prev.length) {
        return [
          ...prev,
          ...Array.from({ length: count - prev.length }, () => ({ qurban_name_holder: '', delivery_portion: null })),
        ];
      }
      return prev.slice(0, count);
    });
  };

  const handleProgrammeChange = (id: string) => {
    setProgrammeId(id);
    const prog = selectableProgrammes.find(p => p.id === id);
    if (prog) {
      setUnitPrice(String(prog.price_per_share));
      if (!isIndonesiaProgramme(prog.name, prog.country) && paymentMethod === 'installment') {
        setPaymentMethod('paynow');
      }
      if (!isAustraliaToSingaporeProgramme(prog.name, prog.country)) {
        setQurbanEntries(prev => prev.map(e => ({ ...e, delivery_portion: null })));
      }
    }
  };

  const availableMethods = [
    ...ORDER_PAYMENT_OPTIONS.filter(m => !m.indonesiaOnly || isIndonesia),
    ...(order.payment_method === 'bank_transfer'
      ? [{ label: 'Bank Transfer (Legacy)', value: 'bank_transfer' as const, indonesiaOnly: false }]
      : []),
  ];

  const handleSave = () => {
    setFormError(null);
    const parsedQty = parseInt(numQurbansInput, 10);
    if (!Number.isFinite(parsedQty) || parsedQty < 1) {
      const msg = 'Number of Qurbans must be at least 1.';
      setFormError(msg);
      toast('error', 'Validation', msg);
      return;
    }
    const priceNum = Number(unitPrice);
    if (!(priceNum > 0)) {
      const msg = 'Unit Price must be greater than 0.';
      setFormError(msg);
      toast('error', 'Validation', msg);
      return;
    }

    const preparedEntries: QurbanEntry[] = qurbanEntries.map(q => ({
      qurban_name_holder: q.qurban_name_holder.trim(),
      delivery_portion: supportsPortions ? (q.delivery_portion ?? null) : null,
    }));

    try {
      const updated = onSave(order.id, {
        full_name: fullName.trim(),
        email: email.trim(),
        contact_number: contactNumber.trim(),
        programme: progName,
        programme_id: selectedProg?.id ?? order.programme_id,
        programme_country: progCountry,
        service_type: serviceType,
        payment_method: paymentMethod,
        installment_count: paymentMethod === 'installment' ? installmentCount : undefined,
        delivery_portion: supportsPortions ? (preparedEntries[0]?.delivery_portion ?? null) : null,
        quantity: parsedQty,
        total_amount: priceNum * parsedQty,
        currency: selectedProg?.currency ?? order.currency,
        notes,
        qurban_entries: preparedEntries,
      });
      toast('success', 'Order updated', `${updated.order_ref} saved and synced with Animal Stock.`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not update order';
      setFormError(msg);
      toast('error', 'Validation', msg);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <div>
            <div className="heading-md">Edit Order — <span style={{ fontFamily: 'monospace', color: 'var(--aig-green-300)' }}>{order.order_ref}</span></div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Updates order and linked animal stock records in-place without creating duplicates
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
            {formError && (
              <div style={{
                padding: '0.75rem 0.875rem',
                borderRadius: 8,
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#fca5a5',
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <AlertCircle size={15} />
                <span>{formError}</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }} className="settings-grid-2">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Full Name *</label>
                <input className="form-input" value={fullName} onChange={e => setFullName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Number *</label>
                <input className="form-input" value={contactNumber} onChange={e => setContactNumber(e.target.value)} />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Programme *</label>
                <select className="form-input form-select" value={programmeId} onChange={e => handleProgrammeChange(e.target.value)}>
                  {selectableProgrammes.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Type of Service *</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {ORDER_SERVICE_OPTIONS.map(s => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setServiceType(s.value)}
                      style={{
                        flex: 1, padding: '0.5rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.8125rem',
                        border: serviceType === s.value ? '1px solid var(--aig-green-400)' : '1px solid var(--border-subtle)',
                        background: serviceType === s.value ? 'rgba(47,168,118,0.15)' : 'var(--surface-900)',
                        color: serviceType === s.value ? 'var(--aig-green-200)' : 'var(--text-muted)',
                        fontWeight: serviceType === s.value ? 600 : 400,
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Payment Method *</label>
                <select className="form-input form-select" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as typeof paymentMethod)}>
                  {availableMethods.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {paymentMethod === 'installment' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-order-installment-count">Number of Installments *</label>
                  <select
                    id="edit-order-installment-count"
                    className="form-input form-select"
                    value={installmentCount}
                    onChange={e => setInstallmentCount(Number(e.target.value))}
                  >
                    {[2, 3, 4, 6].map(n => (
                      <option key={n} value={n}>
                        {n} Installments ({formatCurrency(((parseFloat(unitPrice) || 0) * numQurbans) / n, selectedProg?.currency ?? order.currency)} each)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Number of Qurbans *</label>
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  max="50"
                  value={numQurbansInput}
                  onChange={e => {
                    setNumQurbansInput(e.target.value);
                    const p = parseInt(e.target.value, 10);
                    if (Number.isFinite(p) && p >= 1) syncCount(p);
                  }}
                  onBlur={() => {
                    const p = parseInt(numQurbansInput, 10);
                    syncCount(Number.isFinite(p) && p >= 1 ? p : 1);
                  }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Unit Price ({selectedProg?.currency ?? order.currency}) *</label>
                <input className="form-input" type="number" min="0" step="0.01" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--aig-green-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem' }}>
                Qurban Details — {numQurbans} {numQurbans === 1 ? 'Qurban' : 'Qurbans'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {qurbanEntries.map((entry, i) => {
                  const code = existingAnimals[i]?.animal_code || animalCodeForOrder(order.order_ref, i);
                  return (
                    <div key={i} style={{ padding: '0.75rem 0.875rem', background: 'var(--surface-800)', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem', fontSize: '0.75rem' }}>
                        <strong style={{ color: 'var(--aig-green-300)' }}>Qurban {i + 1}</strong>
                        <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{code}</span>
                      </div>
                      <input
                        className="form-input"
                        placeholder={`Qurban Name Holder ${i + 1} *`}
                        value={entry.qurban_name_holder}
                        onChange={e => setQurbanEntries(prev => prev.map((x, idx) => (idx === i ? { ...x, qurban_name_holder: e.target.value } : x)))}
                      />
                      {supportsPortions && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>
                            Portion to be Delivered * <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Australia → Singapore)</span>
                          </label>
                          <div className="portion-btn-group">
                            {AUSTRALIA_SINGAPORE_PORTION_OPTIONS.map(dp => {
                              const active = entry.delivery_portion === dp.value;
                              return (
                                <button
                                  key={dp.value}
                                  type="button"
                                  onClick={() =>
                                    setQurbanEntries(prev =>
                                      prev.map((x, idx) => (idx === i ? { ...x, delivery_portion: dp.value } : x)),
                                    )
                                  }
                                  style={{
                                    flex: 1,
                                    padding: '0.45rem 0.5rem',
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    fontSize: '0.8125rem',
                                    border: active ? '1px solid var(--aig-green-400)' : '1px solid var(--border-subtle)',
                                    background: active ? 'rgba(47,168,118,0.15)' : 'var(--surface-900)',
                                    color: active ? 'var(--aig-green-200)' : 'var(--text-muted)',
                                    fontWeight: active ? 600 : 400,
                                  }}
                                >
                                  {dp.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
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
          <div className="status-picker-grid">
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
  const {
    orders,
    animals,
    payments,
    deliveries,
    certificates,
    programmes,
    addOrder,
    updateOrder,
    updateOrderStatus,
    cancelOrder: ctxCancelOrder,
    deleteOrder: ctxDeleteOrder,
  } = useAppData();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [programmeFilter, setProgrammeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [updateStatusOrderId, setUpdateStatusOrderId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const detailOrder = detailOrderId ? orders.find(o => o.id === detailOrderId) ?? null : null;
  const editOrderTarget = editOrderId ? orders.find(o => o.id === editOrderId) ?? null : null;
  const updateStatusOrder = updateStatusOrderId ? orders.find(o => o.id === updateStatusOrderId) ?? null : null;
  const deleteTargetOrder = deleteTargetId ? orders.find(o => o.id === deleteTargetId) ?? null : null;

  const paymentByOrderRef = useMemo(() => {
    const map = new Map<string, AppPayment>();
    for (const p of payments) {
      if (!map.has(p.order_ref)) map.set(p.order_ref, p);
    }
    return map;
  }, [payments]);

  const animalsByOrderRef = useMemo(() => {
    const map = new Map<string, typeof animals>();
    for (const a of animals) {
      if (!a.order_ref) continue;
      const arr = map.get(a.order_ref) ?? [];
      arr.push(a);
      map.set(a.order_ref, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.animal_code ?? a.animal_ref).localeCompare(b.animal_code ?? b.animal_ref));
    }
    return map;
  }, [animals]);

  const updateStatus = useCallback((id: string, status: OrderStatus) => {
    updateOrderStatus(id, status);
  }, [updateOrderStatus]);

  const cancelOrder = useCallback((id: string) => {
    ctxCancelOrder(id);
    toast('info', 'Order cancelled', 'Hidden from active Orders view (use "Cancelled" or "Show Cancelled" to view or delete permanently).');
  }, [ctxCancelOrder, toast]);

  const confirmDeleteOrder = useCallback((id: string) => {
    try {
      const target = orders.find(o => o.id === id);
      ctxDeleteOrder(id);
      setExpandedId(prev => (prev === id ? null : prev));
      toast('success', 'Order permanently deleted', target ? `${target.order_ref} and its linked records were removed.` : 'Order removed.');
    } catch (err) {
      toast('error', 'Cannot delete order', err instanceof Error ? err.message : 'Unexpected error');
    }
  }, [ctxDeleteOrder, orders, toast]);

  const cancelledCount = useMemo(() => orders.filter(o => o.status === 'cancelled').length, [orders]);

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const orderAnimals = animalsByOrderRef.get(o.order_ref) ?? [];
    const holdersAndCodes = orderAnimals
      .map(a => `${a.qurban_name_holder ?? ''} ${a.animal_code ?? a.animal_ref}`)
      .join(' ')
      .toLowerCase();
    const matchSearch =
      o.order_ref.toLowerCase().includes(q) ||
      o.participant.toLowerCase().includes(q) ||
      o.programme.toLowerCase().includes(q) ||
      (o.email ?? '').toLowerCase().includes(q) ||
      (o.contact_number ?? '').toLowerCase().includes(q) ||
      (o.service_type ?? '').toLowerCase().includes(q) ||
      holdersAndCodes.includes(q);
    // Hide cancelled orders by default unless user explicitly selects 'cancelled' status or toggles Show Cancelled
    const matchVisibility = statusFilter === 'cancelled' || showCancelled || o.status !== 'cancelled';
    const matchStatus = !statusFilter || o.status === statusFilter;
    const matchProgramme = !programmeFilter || o.programme === programmeFilter;
    return matchSearch && matchVisibility && matchStatus && matchProgramme;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="page-content animate-fadeInUp">
      {showCreate && <CreateOrderModal onClose={() => setShowCreate(false)} onCreate={addOrder} />}
      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          onClose={() => setDetailOrderId(null)}
          onEdit={o => setEditOrderId(o.id)}
          onStatusChange={updateStatus}
          onCancel={cancelOrder}
          onRequestDelete={o => setDeleteTargetId(o.id)}
        />
      )}
      {deleteTargetOrder && (
        <DeleteOrderModal
          order={deleteTargetOrder}
          linkedCounts={{
            animals: animals.filter(a => a.order_ref === deleteTargetOrder.order_ref).length,
            payments: payments.filter(p => p.order_ref === deleteTargetOrder.order_ref).length,
            deliveries: deliveries.filter(d => d.order_ref === deleteTargetOrder.order_ref).length,
            certificates: certificates.filter(c => c.order_ref === deleteTargetOrder.order_ref).length,
          }}
          onClose={() => setDeleteTargetId(null)}
          onConfirmDelete={confirmDeleteOrder}
        />
      )}
      {editOrderTarget && (
        <EditOrderModal
          order={editOrderTarget}
          onClose={() => setEditOrderId(null)}
          onSave={updateOrder}
        />
      )}
      {updateStatusOrder && (
        <UpdateStatusModal
          order={updateStatusOrder}
          onClose={() => setUpdateStatusOrderId(null)}
          onUpdate={updateStatus}
        />
      )}

      {/* Header */}
      <div className="page-header page-header-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">Manage all Qurban & Aqiqah orders across programmes</p>
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
            id="orders-search"
            type="search"
            className="form-input"
            placeholder="Search by order ref, participant, animal code, or programme..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ height: 38 }}
          />
        </div>
        <select
          id="orders-programme-filter"
          className="form-input form-select"
          style={{ width: 'auto', height: 38, fontSize: '0.8125rem' }}
          value={programmeFilter}
          onChange={e => { setProgrammeFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Programmes</option>
          {programmes.filter(p => p.is_active).map(p => (
            <option key={p.id} value={p.name}>{p.name}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              className={`btn btn-sm ${statusFilter === f.value ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
            >
              {f.value === '' && !showCancelled ? 'Active Orders' : f.label}
              {f.value === 'cancelled' && cancelledCount > 0 ? ` (${cancelledCount})` : ''}
            </button>
          ))}
          {statusFilter !== 'cancelled' && cancelledCount > 0 && (
            <button
              type="button"
              className={`btn btn-sm ${showCancelled ? 'btn-outline-green' : 'btn-ghost'}`}
              onClick={() => { setShowCancelled(s => !s); setPage(1); }}
              data-testid="toggle-show-cancelled-btn"
              title="Toggle whether cancelled orders appear in Active Orders"
            >
              {showCancelled ? `Hiding 0 Cancelled` : `+ Show ${cancelledCount} Cancelled`}
            </button>
          )}
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
                <th>Qurbans</th>
                <th>Payment</th>
                <th>Total</th>
                <th>Order Status</th>
                <th>Created</th>
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
              ) : paginated.map(o => {
                const orderAnimals = animalsByOrderRef.get(o.order_ref) ?? [];
                const linkedPay = paymentByOrderRef.get(o.order_ref);
                const payStatus = derivePaymentStatus(o, linkedPay);
                const portionSummary = summarizeOrderPortions(orderAnimals.map(a => a.delivery_portion), o.delivery_portion);
                return (
                  <React.Fragment key={o.id}>
                    <tr style={{ opacity: o.status === 'cancelled' ? 0.55 : 1 }}>
                      <td>
                        <span
                          style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--aig-green-300)', fontWeight: 600, cursor: 'pointer' }}
                          onClick={() => setDetailOrderId(o.id)}
                          title="Open Order Details"
                        >
                          {o.order_ref}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{o.participant}</div>
                        {(o.contact_number || o.email) && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {[o.contact_number, o.email].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                        <div>{o.programme}</div>
                        {portionSummary !== '—' && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--aig-green-300)' }}>
                            Portion: {portionSummary}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-teal" style={{ fontSize: '0.68rem' }}>
                          {formatServiceType(o.service_type ?? 'qurban')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{o.quantity}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          {orderAnimals.length} animal{orderAnimals.length === 1 ? '' : 's'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                          {formatPaymentMethod(o.payment_method)}
                          {o.payment_method === 'installment' && o.installment_count
                            ? ` (${o.installments_paid ?? 0}/${o.installment_count})`
                            : ''}
                        </div>
                        <span className={`badge ${payStatus.badgeClass}`} style={{ fontSize: '0.62rem', marginTop: 2 }}>
                          {payStatus.text}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(o.total_amount, o.currency)}</td>
                      <td><StatusBadge status={o.status} size="sm" /></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{formatDate(o.created_at)}</td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setExpandedId(expandedId === o.id ? null : o.id)}
                          title="Expand order details"
                        >
                          {expandedId === o.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </td>
                    </tr>

                    {/* ── Expanded inline row ── */}
                    {expandedId === o.id && (
                      <tr>
                        <td colSpan={10} style={{ background: 'var(--surface-900)', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                          <div className="settings-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.875rem', marginBottom: '1rem' }}>
                            <div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Order Reference</div>
                              <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--aig-green-300)', fontWeight: 700 }}>{o.order_ref}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Contact & Email</div>
                              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                                {o.contact_number || '—'} · {o.email || '—'}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Programme & Service</div>
                              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                                {o.programme} ({formatServiceType(o.service_type ?? 'qurban')})
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Payment Method & Status</div>
                              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                                {formatPaymentMethod(o.payment_method)}
                          {o.payment_method === 'installment' && o.installment_count
                            ? ` (${o.installments_paid ?? 0}/${o.installment_count})`
                            : ''} · {payStatus.text}
                              </div>
                            </div>
                            {portionSummary !== '—' && (
                              <div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Portion to be Delivered</div>
                                <div style={{ fontSize: '0.8125rem', color: 'var(--aig-green-300)', fontWeight: 600 }}>
                                  {portionSummary}
                                </div>
                              </div>
                            )}
                          </div>

                          {orderAnimals.length > 0 && (
                            <div style={{ marginBottom: '1rem' }}>
                              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--aig-green-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                                Linked Animals ({orderAnimals.length}) — Order Ref {o.order_ref}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {orderAnimals.map((a, idx) => (
                                  <div
                                    key={a.id}
                                    style={{
                                      padding: '0.4rem 0.65rem',
                                      borderRadius: 8,
                                      background: 'var(--surface-800)',
                                      border: '1px solid var(--border-subtle)',
                                      fontSize: '0.78rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.45rem',
                                    }}
                                  >
                                    <span style={{ color: 'var(--text-muted)' }}>#{idx + 1}</span>
                                    <span style={{ fontFamily: 'monospace', color: 'var(--aig-green-300)', fontWeight: 600 }}>
                                      {a.animal_code || a.animal_ref}
                                    </span>
                                    <span style={{ color: 'var(--text-primary)' }}>
                                      {a.qurban_name_holder || '—'}
                                    </span>
                                    {a.delivery_portion && (
                                      <span className="badge badge-teal" style={{ fontSize: '0.65rem' }}>
                                        {formatDeliveryPortion(a.delivery_portion)}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ gap: '0.375rem' }}
                              onClick={() => setDetailOrderId(o.id)}
                            >
                              <Eye size={13} /> View Full Details
                            </button>

                            {o.status !== 'cancelled' && (
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ gap: '0.375rem' }}
                                onClick={() => setEditOrderId(o.id)}
                              >
                                <Edit3 size={13} /> Edit Order
                              </button>
                            )}

                            {o.status !== 'cancelled' && (
                              <button
                                className="btn btn-sm"
                                style={{ gap: '0.375rem', background: 'rgba(47,168,118,0.1)', border: '1px solid rgba(47,168,118,0.2)', color: 'var(--aig-green-300)' }}
                                onClick={() => setUpdateStatusOrderId(o.id)}
                              >
                                <RefreshCw size={13} /> Update Status
                              </button>
                            )}

                            {o.status !== 'cancelled' && (
                              <button
                                className="btn btn-sm"
                                style={{ gap: '0.375rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
                                onClick={() => {
                                  cancelOrder(o.id);
                                  setExpandedId(null);
                                }}
                                data-testid={`cancel-order-btn-${o.order_ref}`}
                              >
                                <XCircle size={13} /> Cancel Order
                              </button>
                            )}

                            {['cancelled', 'draft', 'pending_payment', 'payment_rejected'].includes(o.status) && (
                              <button
                                className="btn btn-sm"
                                style={{ gap: '0.375rem', background: 'rgba(220,38,38,0.16)', border: '1px solid rgba(220,38,38,0.35)', color: '#fca5a5' }}
                                onClick={() => setDeleteTargetId(o.id)}
                                data-testid={`delete-order-btn-${o.order_ref}`}
                              >
                                <Trash2 size={13} /> Delete Permanently
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '0.75rem',
          padding: '0.875rem 1.25rem',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.8125rem', color: 'var(--text-muted)',
        }}>
          <span>Showing {filtered.length === 0 ? 0 : Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} orders</span>
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
