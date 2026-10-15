import React, { useState } from 'react';
import { Search, Filter, Plus, Eye, ChevronDown, ChevronUp, X } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { OrderStatus } from '@/lib/database.types';
import { formatCurrency, formatDate } from '@/lib/utils';

// ── Mock Data ────────────────────────────────────────────────
const MOCK_ORDERS = [
  { id: '1', order_ref: 'AIG-2025-000158', participant: 'Ahmad Rizal bin Yusof', programme: 'Cow Share — Somalia', quantity: 1, total_amount: 850, currency: 'SGD', status: 'payment_verified' as OrderStatus, created_at: '2025-05-14T08:22:00Z' },
  { id: '2', order_ref: 'AIG-2025-000157', participant: 'Nurul Ain binti Hassan', programme: 'Goat — Malaysia', quantity: 2, total_amount: 840, currency: 'SGD', status: 'payment_submitted' as OrderStatus, created_at: '2025-05-13T15:47:00Z' },
  { id: '3', order_ref: 'AIG-2025-000156', participant: 'Mohamad Faiz bin Ali', programme: 'Cow Share — Palestine', quantity: 1, total_amount: 950, currency: 'SGD', status: 'animal_allocated' as OrderStatus, created_at: '2025-05-13T11:05:00Z' },
  { id: '4', order_ref: 'AIG-2025-000155', participant: 'Siti Norzahra binti Md Zain', programme: 'Sheep — Turkey', quantity: 1, total_amount: 380, currency: 'SGD', status: 'delivered' as OrderStatus, created_at: '2025-05-12T09:30:00Z' },
  { id: '5', order_ref: 'AIG-2025-000154', participant: 'Zulkifli bin Othman', programme: 'Goat — Bangladesh', quantity: 1, total_amount: 390, currency: 'SGD', status: 'completed' as OrderStatus, created_at: '2025-05-11T16:20:00Z' },
  { id: '6', order_ref: 'AIG-2025-000153', participant: 'Nur Izzati binti Kamal', programme: 'Cow Share — Somalia', quantity: 1, total_amount: 850, currency: 'SGD', status: 'confirmed' as OrderStatus, created_at: '2025-05-11T10:15:00Z' },
  { id: '7', order_ref: 'AIG-2025-000152', participant: 'Hafizuddin bin Ramli', programme: 'Goat — Malaysia', quantity: 3, total_amount: 1260, currency: 'SGD', status: 'pending_payment' as OrderStatus, created_at: '2025-05-10T14:00:00Z' },
  { id: '8', order_ref: 'AIG-2025-000151', participant: 'Rohani binti Abdul Ghani', programme: 'Sheep — Turkey', quantity: 2, total_amount: 760, currency: 'SGD', status: 'draft' as OrderStatus, created_at: '2025-05-10T09:45:00Z' },
  { id: '9', order_ref: 'AIG-2025-000150', participant: 'Khairul Anwar bin Ibrahim', programme: 'Cow Share — Palestine', quantity: 1, total_amount: 950, currency: 'SGD', status: 'payment_rejected' as OrderStatus, created_at: '2025-05-09T11:30:00Z' },
  { id: '10', order_ref: 'AIG-2025-000149', participant: 'Faridah binti Salleh', programme: 'Goat — Bangladesh', quantity: 1, total_amount: 390, currency: 'SGD', status: 'certificate_generated' as OrderStatus, created_at: '2025-05-08T08:00:00Z' },
];

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Pending Payment', value: 'pending_payment' },
  { label: 'Payment Submitted', value: 'payment_submitted' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Animal Allocated', value: 'animal_allocated' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

// ── Create Order Modal ────────────────────────────────────────
function CreateOrderModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="heading-md">New Order</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '0.25rem' }}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Participant</label>
              <input className="form-input" placeholder="Search participant..." />
            </div>
            <div className="form-group">
              <label className="form-label">Programme</label>
              <select className="form-input form-select">
                <option value="">Select programme</option>
                <option>Cow Share — Somalia</option>
                <option>Goat — Malaysia</option>
                <option>Sheep — Turkey</option>
                <option>Cow Share — Palestine</option>
                <option>Goat — Bangladesh</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input className="form-input" type="number" min="1" defaultValue="1" />
              </div>
              <div className="form-group">
                <label className="form-label">Unit Price (SGD)</label>
                <input className="form-input" type="number" placeholder="0.00" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Recipient Name (optional)</label>
              <input className="form-input" placeholder="Name of the Qurban recipient" />
            </div>
            <div className="form-group">
              <label className="form-label">Special Requests</label>
              <textarea className="form-input" rows={3} placeholder="Any special instructions..." style={{ resize: 'vertical' }} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary">Create Order</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export function OrdersPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = MOCK_ORDERS.filter(o => {
    const matchSearch =
      o.order_ref.toLowerCase().includes(search.toLowerCase()) ||
      o.participant.toLowerCase().includes(search.toLowerCase()) ||
      o.programme.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="page-content animate-fadeInUp">
      {showCreate && <CreateOrderModal onClose={() => setShowCreate(false)} />}

      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">Manage all Qurban orders across programmes</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} />
          New Order
        </button>
      </div>

      {/* Stats Strip */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1.25rem' }}>
        {[
          { label: 'Total Orders', value: '156', color: 'var(--aig-green-400)' },
          { label: 'Pending Payment', value: '19', color: 'var(--warning)' },
          { label: 'In Progress', value: '71', color: 'var(--info)' },
          { label: 'Completed', value: '67', color: 'var(--success)' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ padding: '1rem' }}>
            <div className="stat-value" style={{ fontSize: '1.5rem', color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-bar">
          <Search className="search-icon" size={15} />
          <input
            id="orders-search"
            type="search"
            className="form-input"
            placeholder="Search by order ref, participant, or programme..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ height: 38 }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              className={`btn btn-sm ${statusFilter === f.value ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </button>
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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state" style={{ padding: '3rem 2rem' }}>
                      <div className="empty-icon"><Search size={24} color="var(--text-muted)" /></div>
                      <h3>No orders found</h3>
                      <p>Try adjusting your search or filter criteria</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(o => (
                <React.Fragment key={o.id}>
                  <tr>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--aig-green-300)' }}>
                        {o.order_ref}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{o.participant}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{o.programme}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{o.quantity}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(o.total_amount, o.currency)}</td>
                    <td><StatusBadge status={o.status} size="sm" /></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{formatDate(o.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setExpandedId(expandedId === o.id ? null : o.id)}
                          title="Details"
                        >
                          {expandedId === o.id ? <ChevronUp size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === o.id && (
                    <tr>
                      <td colSpan={8} style={{ background: 'var(--surface-900)', padding: '1rem 1.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Order ID</div>
                            <div style={{ fontSize: '0.875rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{o.id}</div>
                          </div>
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
                        </div>
                        <div style={{ display: 'flex', gap: '0.625rem', marginTop: '1rem' }}>
                          <button className="btn btn-secondary btn-sm">View Full Details</button>
                          <button className="btn btn-outline-green btn-sm">Update Status</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}>Cancel Order</button>
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
          <span>Showing {filtered.length} of {MOCK_ORDERS.length} orders</span>
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            <button className="btn btn-secondary btn-sm" disabled>← Prev</button>
            <button className="btn btn-primary btn-sm">1</button>
            <button className="btn btn-secondary btn-sm">2</button>
            <button className="btn btn-secondary btn-sm">Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
