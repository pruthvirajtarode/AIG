import React, { useState, useCallback } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Search, Plus, X, ChevronDown, ChevronUp, CheckCircle2, XCircle, RefreshCw, Eye } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { OrderStatus } from '@/lib/database.types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useToast } from '@/contexts/ToastContext';
import { useAppData, type AppOrder as Order } from '@/contexts/AppDataContext';


const NEXT_STATUSES: Partial<Record<OrderStatus, OrderStatus>> = {
  draft:             'pending_payment',
  pending_payment:   'payment_submitted',
  payment_submitted: 'payment_verified',
  payment_verified:  'confirmed',
  confirmed:         'animal_allocated',
  animal_allocated:  'delivered',
  delivered:         'completed',
  completed:         'certificate_generated',
};

const STATUS_FILTERS = [
  { label: 'All',              value: '' },
  { label: 'Draft',            value: 'draft' },
  { label: 'Pending Payment',  value: 'pending_payment' },
  { label: 'Submitted',        value: 'payment_submitted' },
  { label: 'Confirmed',        value: 'confirmed' },
  { label: 'Allocated',        value: 'animal_allocated' },
  { label: 'Delivered',        value: 'delivered' },
  { label: 'Completed',        value: 'completed' },
];

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
              ['Unit Price',   formatCurrency(order.total_amount / order.quantity, order.currency)],
              ['Date Placed',  formatDate(order.created_at)],
              ['Status',       order.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())],
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
              Advance to <strong>{nextStatus.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</strong>
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
              Advance to {nextStatus.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
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
function CreateOrderModal({ onClose, onCreate }: { onClose: () => void; onCreate: (o: Order) => void }) {
  const [participant, setParticipant] = useState('');
  const [programme, setProgramme] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState('');
  const { toast } = useToast();

  const handleSubmit = () => {
    if (!participant || !programme || !price) {
      toast('error', 'Missing fields', 'Please fill in all required fields');
      return;
    }
    const newOrder: Order = {
      id: String(Date.now()),
      order_ref: `AIG-2025-${String(Math.floor(Math.random() * 900) + 100).padStart(6, '0')}`,
      participant, programme, quantity,
      total_amount: Number(price) * quantity,
      currency: 'SGD',
      status: 'draft',
      created_at: new Date().toISOString(),
    };
    onCreate(newOrder);
    toast('success', 'Order created!', `${newOrder.order_ref} created successfully`);
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
              <label className="form-label">Participant *</label>
              <input className="form-input" placeholder="Participant name" value={participant} onChange={e => setParticipant(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Programme *</label>
              <select className="form-input form-select" value={programme} onChange={e => setProgramme(e.target.value)}>
                <option value="">Select programme</option>
                <option>Cow Share — Somalia</option>
                <option>Goat — Malaysia</option>
                <option>Sheep — Turkey</option>
                <option>Cow Share — Palestine</option>
                <option>Goat — Bangladesh</option>
                <option>Sheep — Australia</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input className="form-input" type="number" min="1" value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="form-label">Unit Price (SGD) *</label>
                <input className="form-input" type="number" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Special Requests</label>
              <textarea className="form-input" rows={3} placeholder="Any special instructions..." style={{ resize: 'vertical' }} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit}>Create Order</button>
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
  const ALL_STATUSES: OrderStatus[] = [
    'draft', 'pending_payment', 'payment_submitted', 'payment_verified',
    'confirmed', 'animal_allocated', 'delivered', 'completed', 'cancelled',
  ];
  const [selected, setSelected] = useState<OrderStatus>(order.status);
  const { toast } = useToast();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div className="heading-md">Update Order Status</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Order: <strong style={{ color: 'var(--text-primary)' }}>{order.order_ref}</strong>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {ALL_STATUSES.map(s => (
              <button
                key={s}
                onClick={() => setSelected(s)}
                style={{
                  padding: '0.625rem 0.875rem',
                  borderRadius: 8,
                  border: selected === s ? '1px solid var(--aig-green-400)' : '1px solid var(--border-subtle)',
                  background: selected === s ? 'rgba(47,168,118,0.12)' : 'var(--surface-800)',
                  color: selected === s ? 'var(--aig-green-200)' : 'var(--text-secondary)',
                  cursor: 'pointer', textAlign: 'left', fontSize: '0.875rem',
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                }}
              >
                {selected === s && <CheckCircle2 size={14} />}
                {s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </button>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => {
            onUpdate(order.id, selected);
            toast('success', 'Status updated!', `${order.order_ref} → ${selected.replace(/_/g, ' ')}`);
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
          { label: 'Pending Payment', value: String(orders.filter(o => o.status === 'pending_payment').length), color: 'var(--warning)' },
          { label: 'In Progress',     value: String(orders.filter(o => ['confirmed','animal_allocated','delivered'].includes(o.status)).length), color: 'var(--info)' },
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
                              {o.quantity} × {formatCurrency(o.total_amount / o.quantity, o.currency)}
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
