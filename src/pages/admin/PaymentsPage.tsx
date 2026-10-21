import React, { useState } from 'react';
import { Search, CheckCircle2, XCircle, Eye, Clock, X, Upload } from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import type { PaymentStatus } from '@/lib/database.types';

const STATUS_COLOR: Record<PaymentStatus, string> = {
  pending:      'badge-yellow',
  submitted:    'badge-orange',
  under_review: 'badge-orange',
  verified:     'badge-green',
  rejected:     'badge-red',
  refunded:     'badge-gray',
  cancelled:    'badge-gray',
};

const STATUS_LABEL: Record<PaymentStatus, string> = {
  pending:      'Pending',
  submitted:    'Submitted',
  under_review: 'Under Review',
  verified:     'Verified',
  rejected:     'Rejected',
  refunded:     'Refunded',
  cancelled:    'Cancelled',
};

const MOCK_PAYMENTS = [
  { id: 'p1', payment_ref: 'PAY-2025-000042', order_ref: 'AIG-2025-000158', participant: 'Ahmad Rizal bin Yusof', amount: 850, currency: 'SGD', method: 'bank_transfer', status: 'verified' as PaymentStatus, submitted_at: '2025-05-14T08:22:00Z', verified_at: '2025-05-14T10:05:00Z', bank: 'Maybank', notes: null },
  { id: 'p2', payment_ref: 'PAY-2025-000041', order_ref: 'AIG-2025-000157', participant: 'Nurul Ain binti Hassan', amount: 840, currency: 'SGD', method: 'bank_transfer', status: 'submitted' as PaymentStatus, submitted_at: '2025-05-13T15:47:00Z', verified_at: null, bank: 'CIMB', notes: 'Transferred via IBG' },
  { id: 'p3', payment_ref: 'PAY-2025-000040', order_ref: 'AIG-2025-000156', participant: 'Mohamad Faiz bin Ali', amount: 950, currency: 'SGD', method: 'online_gateway', status: 'verified' as PaymentStatus, submitted_at: '2025-05-13T11:05:00Z', verified_at: '2025-05-13T13:30:00Z', bank: null, notes: null },
  { id: 'p4', payment_ref: 'PAY-2025-000039', order_ref: 'AIG-2025-000155', participant: 'Siti Norzahra binti Md Zain', amount: 380, currency: 'SGD', method: 'bank_transfer', status: 'under_review' as PaymentStatus, submitted_at: '2025-05-12T09:30:00Z', verified_at: null, bank: 'RHB', notes: null },
  { id: 'p5', payment_ref: 'PAY-2025-000038', order_ref: 'AIG-2025-000154', participant: 'Zulkifli bin Othman', amount: 390, currency: 'SGD', method: 'bank_transfer', status: 'rejected' as PaymentStatus, submitted_at: '2025-05-11T16:20:00Z', verified_at: null, bank: 'Public Bank', notes: 'Bank slip unclear, cannot verify' },
  { id: 'p6', payment_ref: 'PAY-2025-000037', order_ref: 'AIG-2025-000153', participant: 'Nur Izzati binti Kamal', amount: 850, currency: 'SGD', method: 'credit_card', status: 'verified' as PaymentStatus, submitted_at: '2025-05-11T10:15:00Z', verified_at: '2025-05-11T10:16:00Z', bank: null, notes: null },
  { id: 'p7', payment_ref: 'PAY-2025-000036', order_ref: 'AIG-2025-000152', participant: 'Hafizuddin bin Ramli', amount: 1260, currency: 'SGD', method: 'bank_transfer', status: 'pending' as PaymentStatus, submitted_at: null, verified_at: null, bank: null, notes: null },
];

function PaymentDetailModal({ payment, onClose }: { payment: typeof MOCK_PAYMENTS[0]; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="heading-md">Payment Details</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{payment.payment_ref}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} className="settings-grid-2">
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Payment Info</div>
              <div className="detail-list">
                {[
                  ['Reference', payment.payment_ref],
                  ['Order Ref', payment.order_ref],
                  ['Participant', payment.participant],
                  ['Amount', formatCurrency(payment.amount, payment.currency)],
                  ['Method', payment.method.replace(/_/g, ' ')],
                  ['Bank', payment.bank || '—'],
                  ['Status', STATUS_LABEL[payment.status]],
                ].map(([k, v]) => (
                  <div key={k} className="detail-row">
                    <div className="detail-key">{k}</div>
                    <div className="detail-val">{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Timeline</div>
              <div className="detail-list">
                {[
                  ['Submitted', payment.submitted_at ? formatDateTime(payment.submitted_at) : '—'],
                  ['Verified', payment.verified_at ? formatDateTime(payment.verified_at) : '—'],
                  ['Notes', payment.notes || '—'],
                ].map(([k, v]) => (
                  <div key={k} className="detail-row">
                    <div className="detail-key">{k}</div>
                    <div className="detail-val">{v}</div>
                  </div>
                ))}
              </div>

              {/* Proof upload area */}
              <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'var(--surface-700)', borderRadius: 8, border: '1px dashed var(--border-default)', textAlign: 'center' }}>
                <Upload size={20} color="var(--text-muted)" style={{ margin: '0 auto 0.5rem' }} />
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Bank slip / proof of payment</div>
                <button className="btn btn-secondary btn-sm" style={{ marginTop: '0.5rem' }}>View Proof</button>
              </div>
            </div>
          </div>

          {payment.status === 'submitted' || payment.status === 'under_review' ? (
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--surface-700)', borderRadius: 8 }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', fontWeight: 600 }}>Review Action</div>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label">Rejection Reason (if applicable)</label>
                <textarea className="form-input" rows={2} placeholder="State reason for rejection..." style={{ resize: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-primary" style={{ gap: '0.5rem' }}>
                  <CheckCircle2 size={15} /> Verify Payment
                </button>
                <button className="btn btn-danger">
                  <XCircle size={15} /> Reject
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function PaymentsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<typeof MOCK_PAYMENTS[0] | null>(null);

  const filtered = MOCK_PAYMENTS.filter(p => {
    const matchSearch =
      p.payment_ref.toLowerCase().includes(search.toLowerCase()) ||
      p.participant.toLowerCase().includes(search.toLowerCase()) ||
      p.order_ref.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pendingReview = MOCK_PAYMENTS.filter(p => p.status === 'submitted' || p.status === 'under_review').length;

  return (
    <div className="page-content animate-fadeInUp">
      {selected && <PaymentDetailModal payment={selected} onClose={() => setSelected(null)} />}

      <div className="page-header page-header-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="page-subtitle">Review and verify payment submissions</p>
        </div>
        {pendingReview > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1rem', background: 'var(--warning-bg)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 8 }}>
            <Clock size={16} color="var(--warning)" />
            <span style={{ fontSize: '0.875rem', color: 'var(--warning)', fontWeight: 600 }}>{pendingReview} awaiting review</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        {[
          { label: 'Total Collected', value: 'SGD 91K', color: 'var(--aig-green-400)' },
          { label: 'Pending Review', value: String(pendingReview), color: 'var(--warning)' },
          { label: 'Verified', value: '3', color: 'var(--success)' },
          { label: 'Rejected', value: '1', color: 'var(--danger)' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ padding: '1rem' }}>
            <div className="stat-value" style={{ fontSize: '1.375rem', color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-bar">
          <Search className="search-icon" size={15} />
          <input
            id="payments-search"
            type="search"
            className="form-input"
            placeholder="Search payments..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ height: 38 }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['', 'pending', 'submitted', 'under_review', 'verified', 'rejected'] as const).map(s => (
            <button
              key={s}
              className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === '' ? 'All' : STATUS_LABEL[s as PaymentStatus]}
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
                <th>Payment Ref</th>
                <th>Order</th>
                <th>Participant</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--aig-green-300)' }}>
                      {p.payment_ref}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{p.order_ref}</td>
                  <td style={{ fontWeight: 500 }}>{p.participant}</td>
                  <td style={{ fontWeight: 600 }}>{formatCurrency(p.amount, p.currency)}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', textTransform: 'capitalize' }}>
                    {p.method.replace(/_/g, ' ')}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_COLOR[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    {p.submitted_at ? formatDate(p.submitted_at) : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
                      {(p.status === 'submitted' || p.status === 'under_review') && (
                        <>
                          <button className="btn btn-sm" style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.2)', gap: '0.25rem' }} onClick={() => setSelected(p)}>
                            <CheckCircle2 size={13} /> Verify
                          </button>
                        </>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => setSelected(p)}>
                        <Eye size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0.875rem 1.25rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Showing {filtered.length} of {MOCK_PAYMENTS.length} payments
        </div>
      </div>
    </div>
  );
}
