import React, { useState, useCallback } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Search, Plus, X, ChevronDown, ChevronUp, CheckCircle2, XCircle, RefreshCw, Eye } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { OrderStatus } from '@/lib/database.types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getStatusLabel } from '@/lib/statusEngine';
import { useToast } from '@/contexts/ToastContext';
import { useAppData, orderRank, type AppOrder as Order, type NewOrderInput } from '@/contexts/AppDataContext';

/** Used only until real programmes are created on the Programmes page. */
const FALLBACK_PROGRAMMES = [
  'Cow Share — Somalia', 'Goat — Malaysia', 'Sheep — Turkey',
  'Cow Share — Palestine', 'Goat — Bangladesh', 'Sheep — Australia',
];

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
  const nextStatus = NEXT_STATUSES[order.status];
  const isCancellable = !['completed', 'cancelled', 'certificate_generated', 'delivered'].includes(order.status);

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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }} className="settings-grid-2">
            {[
              ['Order Ref',    order.order_ref],
              ['Participant',  order.participant],
              ['Programme',    order.programme],
              ['Quantity',     String(order.quantity)],
              ['Total Amount', formatCurrency(order.total_amount, order.currency)],
              ['Unit Price',   formatCurrency(order.total_amount / (order.quantity || 1), order.currency)],
              ['Date Placed',  formatDate(order.created_at)],
              ['Status',       label(order.status)],
              ['Notes',        order.notes || '—'],
            ].map(([k, v]) => (
              <div key={k} className="detail-row">
                <div className="detail-key">{k}</div>
                <div className="detail-val">{v}</div>
              </div>
            ))}
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
function CreateOrderModal({ onClose, onCreate }: { onClose: () => void; onCreate: (o: NewOrderInput) => Order }) {
  const { programmes, participants } = useAppData();
  const [participant, setParticipant] = useState('');
  const [programme, setProgramme] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [initialStatus, setInitialStatus] = useState<OrderStatus>('draft');
  const { toast } = useToast();

  const activeProgrammes = programmes.filter(p => p.is_active);
  const programmeOptions = activeProgrammes.length ? activeProgrammes.map(p => p.name) : FALLBACK_PROGRAMMES;

  const onProgrammeChange = (name: string) => {
    setProgramme(name);
    const prog = programmes.find(p => p.name === name);
    if (prog) {
      setPrice(String(prog.price_per_share));
      if (quantity < prog.min_quantity) setQuantity(prog.min_quantity);
    }
  };

  const handleSubmit = () => {
    if (!participant.trim() || !programme || !price) {
      toast('error', 'Missing fields', 'Please fill in all required fields');
      return;
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      toast('error', 'Invalid quantity', 'Quantity must be at least 1');
      return;
    }
    if (!(Number(price) > 0)) {
      toast('error', 'Invalid price', 'Unit price must be greater than 0');
      return;
    }
    const created = onCreate({
      participant, programme, quantity,
      total_amount: Number(price) * quantity,
      currency: programmes.find(p => p.name === programme)?.currency ?? 'SGD',
      notes,
      status: initialStatus,
    });
    toast('success', 'Order created!', `${created.order_ref} created — ${label(initialStatus)}. ${syncSummary(initialStatus)}`);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="heading-md">New Order</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="order-participant">Participant *</label>
              <input id="order-participant" className="form-input" placeholder="Participant name" list="order-participant-list"
                value={participant} onChange={e => setParticipant(e.target.value)} autoFocus />
              <datalist id="order-participant-list">
                {participants.map(p => <option key={p.id} value={`${p.first_name} ${p.last_name}`.trim()}>{p.email}</option>)}
              </datalist>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="order-programme">Programme *</label>
              <select id="order-programme" className="form-input form-select" value={programme} onChange={e => onProgrammeChange(e.target.value)}>
                <option value="">Select programme</option>
                {programmeOptions.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="order-quantity">Quantity</label>
                <input id="order-quantity" className="form-input" type="number" min="1" value={quantity} onChange={e => setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="order-price">Unit Price (SGD) *</label>
                <input id="order-price" className="form-input" type="number" min="0" step="0.01" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="order-initial-status">Initial Status</label>
              <select id="order-initial-status" className="form-input form-select" value={initialStatus} onChange={e => setInitialStatus(e.target.value as OrderStatus)}>
                <option value="draft">Draft</option>
                <option value="pending_payment">Pending Payment (creates a payment record)</option>
                <option value="payment_submitted">Payment Submitted (awaiting verification)</option>
                <option value="payment_verified">Payment Verified</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="order-notes">Special Requests</label>
              <textarea id="order-notes" className="form-input" rows={3} placeholder="Any special instructions..." style={{ resize: 'vertical' }}
                value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
            {price && quantity > 0 && (
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                Total: <strong style={{ color: 'var(--aig-green-300)' }}>{formatCurrency(Number(price) * quantity, 'SGD')}</strong>
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
  const { orders, addOrder, updateOrderStatus, cancelOrder: ctxCancelOrder } = useAppData();
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
    const matchSearch = o.order_ref.toLowerCase().includes(q) || o.participant.toLowerCase().includes(q) || o.programme.toLowerCase().includes(q);
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
                <th>Qty</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={8}>
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
                    <td style={{ fontWeight: 500 }}>{o.participant}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{o.programme}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{o.quantity}</td>
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
                      <td colSpan={8} style={{ background: 'var(--surface-900)', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '1rem' }}>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Programme</div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{o.programme}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Quantity × Unit Price</div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                              {o.quantity} × {formatCurrency(o.total_amount / (o.quantity || 1), o.currency)}
                            </div>
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
