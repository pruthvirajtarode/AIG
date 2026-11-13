import React, { useEffect, useState, useCallback } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Search, CheckCircle2, XCircle, Eye, Clock, X, Upload, Download, ExternalLink, ZoomIn, ZoomOut, FileX, Trash2 } from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { formatPaymentMethod, formatServiceType } from '@/lib/orderRules';
import type { PaymentStatus } from '@/lib/database.types';
import { useToast } from '@/contexts/ToastContext';
import { useAppData, type AppPayment as Payment, type AppOrder } from '@/contexts/AppDataContext';

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

// ── Proof viewer ─────────────────────────────────────────────

function ProofViewer({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [failed, setFailed] = useState(false);
  const url = payment.proof_url ?? null;
  const hasProof = !!url;
  const isPdf = !!url && /\.pdf($|\?)/i.test(url);
  const fileName = `${payment.payment_ref}-proof.${isPdf ? 'pdf' : (url?.split('?')[0].split('.').pop() || 'png')}`;

  // Esc closes only the viewer (not the parent modal)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="modal-overlay" style={{ zIndex: 200 }} onClick={e => { e.stopPropagation(); onClose(); }} role="dialog" aria-modal="true" aria-label="Proof of payment">
      <div className="modal modal-lg" style={{ maxWidth: 820 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="heading-md">Proof of Payment</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{payment.payment_ref} · {payment.participant}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            {hasProof && url && !failed && !isPdf && (
              <>
                <button type="button" className="btn btn-ghost btn-sm" title="Zoom out" onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}><ZoomOut size={16} /></button>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: 38, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
                <button type="button" className="btn btn-ghost btn-sm" title="Zoom in" onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))}><ZoomIn size={16} /></button>
              </>
            )}
            <button type="button" className="btn btn-ghost btn-sm" aria-label="Close proof viewer" onClick={onClose}><X size={18} /></button>
          </div>
        </div>
        <div className="modal-body" style={{ background: 'var(--surface-900)', minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', maxHeight: '65vh' }}>
          {!hasProof || !url || failed ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              <FileX size={36} style={{ margin: '0 auto 0.75rem' }} />
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                {failed ? 'Unable to load proof file' : 'No proof uploaded yet'}
              </div>
              <div style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                {failed ? 'The file may have expired or been removed.' : 'The participant has not submitted a bank slip for this payment.'}
              </div>
            </div>
          ) : isPdf ? (
            <iframe src={url} title="Payment proof PDF" style={{ width: '100%', height: '60vh', border: 'none', borderRadius: 8, background: '#fff' }} />
          ) : (
            <img
              src={url}
              alt={`Proof of payment ${payment.payment_ref}`}
              onError={() => setFailed(true)}
              style={{ width: `${zoom * 100}%`, maxWidth: zoom <= 1 ? 560 : 'none', borderRadius: 8, transition: 'width 0.15s ease', boxShadow: 'var(--shadow-lg)' }}
            />
          )}
        </div>
        {hasProof && url && !failed && (
          <div className="modal-footer">
            <a className="btn btn-secondary btn-sm" href={url} target="_blank" rel="noopener noreferrer" style={{ gap: '0.375rem' }}>
              <ExternalLink size={14} /> Open in new tab
            </a>
            <a className="btn btn-primary btn-sm" href={url} download={fileName} style={{ gap: '0.375rem' }}>
              <Download size={14} /> Download
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentDetailModal({ payment, linkedOrder, onClose, onVerify, onReject, onDelete }: {
  payment: Payment;
  linkedOrder?: AppOrder;
  onClose: () => void;
  onVerify: (id: string) => void;
  onReject: (id: string, reason?: string) => void;
  onDelete?: (id: string) => void;
}) {
  const { toast } = useToast();
  const [rejectReason, setRejectReason] = useState('');
  const [showProof, setShowProof] = useState(false);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="heading-md">Payment Details</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
              {payment.payment_ref} · Order <span style={{ fontFamily: 'monospace', color: 'var(--aig-green-300)' }}>{payment.order_ref}</span>
            </div>
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
                  ['Order Reference', payment.order_ref],
                  ['Participant', payment.participant],
                  ...(linkedOrder ? [
                    ['Programme', linkedOrder.programme],
                    ['Service Type', formatServiceType(linkedOrder.service_type ?? 'qurban')],
                    ['No. of Qurbans', String(linkedOrder.quantity)],
                  ] : []),
                  ['Amount', formatCurrency(payment.amount, payment.currency)],
                  ['Method', formatPaymentMethod(payment.method) + (payment.method === 'installment' && payment.installment_count ? ` (${payment.installments_paid ?? 0}/${payment.installment_count} paid)` : '')],
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
                  ...(payment.rejection_reason ? [['Rejection Reason', payment.rejection_reason]] : []),
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
                <button
                  type="button"
                  id="view-proof-btn"
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '0.5rem' }}
                  onClick={() => setShowProof(true)}
                >
                  View Proof
                </button>
              </div>
            </div>
          </div>

          {['pending', 'submitted', 'under_review', 'rejected'].includes(payment.status) ? (
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--surface-700)', borderRadius: 8 }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', fontWeight: 600 }}>Review Action</div>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label">Rejection Reason (if applicable)</label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="State reason for rejection..."
                  style={{ resize: 'none' }}
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  style={{ gap: '0.5rem' }}
                  onClick={() => { onVerify(payment.id); onClose(); toast('success', 'Payment verified!', `${payment.payment_ref} has been verified.`); }}
                >
                  <CheckCircle2 size={15} /> Verify Payment
                </button>
                {payment.status !== 'rejected' && (
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      if (!rejectReason.trim()) { toast('warning', 'Reason required', 'Please state a reason for rejection'); return; }
                      onReject(payment.id, rejectReason); onClose();
                      toast('error', 'Payment rejected', `${payment.payment_ref}: ${rejectReason}`);
                    }}
                  >
                    <XCircle size={15} /> Reject
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {onDelete && (
            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {payment.status === 'cancelled'
                  ? 'Cancelled payment record. Deleting cleans it from the system.'
                  : 'Deleting a payment will automatically update the linked order back to pending payment.'}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--danger)', gap: '0.35rem' }}
                onClick={() => {
                  if (window.confirm(`Permanently delete payment ${payment.payment_ref}? Linked order status will update accordingly.`)) {
                    onDelete(payment.id);
                    onClose();
                    toast('success', 'Payment deleted', `Payment ${payment.payment_ref} removed. Linked order status synced.`);
                  }
                }}
              >
                <Trash2 size={14} /> Delete Payment
              </button>
            </div>
          )}
        </div>
      </div>
      {showProof && <ProofViewer payment={payment} onClose={() => setShowProof(false)} />}
    </div>
  );
}

export function PaymentsPage() {
  usePageTitle('Payments');
  const { toast } = useToast();
  const { payments, orders, verifyPayment, rejectPayment, deletePayment } = useAppData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const isPaymentCancelled = useCallback((p: Payment) => {
    if (p.status === 'cancelled') return true;
    const linkedOrder = orders.find(o => o.order_ref === p.order_ref);
    if (linkedOrder && linkedOrder.status === 'cancelled') return true;
    return false;
  }, [orders]);

  const cancelledCount = payments.filter(isPaymentCancelled).length;
  const livePayments = payments.filter(p => !isPaymentCancelled(p));

  const selected = selectedId ? payments.find(p => p.id === selectedId) ?? null : null;
  const selectedOrder = selected ? orders.find(o => o.order_ref === selected.order_ref) : undefined;

  const filtered = payments.filter(p => {
    const isCancelled = isPaymentCancelled(p);
    if (statusFilter === 'cancelled') {
      if (!isCancelled) return false;
    } else {
      if (!showCancelled && isCancelled) return false;
      if (statusFilter && p.status !== statusFilter) return false;
    }
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      p.payment_ref.toLowerCase().includes(q) ||
      p.participant.toLowerCase().includes(q) ||
      p.order_ref.toLowerCase().includes(q) ||
      formatPaymentMethod(p.method).toLowerCase().includes(q);
    return matchSearch;
  });

  const pendingReview = livePayments.filter(p => p.status === 'submitted' || p.status === 'under_review').length;
  const totalCollected = livePayments.filter(p => p.status === 'verified').reduce((a, p) => a + p.amount, 0);
  const verifiedCount = livePayments.filter(p => p.status === 'verified').length;
  const rejectedCount = livePayments.filter(p => p.status === 'rejected').length;

  return (
    <div className="page-content animate-fadeInUp">
      {selected && (
        <PaymentDetailModal
          payment={selected}
          linkedOrder={selectedOrder}
          onClose={() => setSelectedId(null)}
          onVerify={verifyPayment}
          onReject={rejectPayment}
          onDelete={deletePayment}
        />
      )}

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
          {
            label: 'Total Collected',
            value: `SGD ${totalCollected.toLocaleString()}`,
            sub: cancelledCount > 0 ? `+ ${cancelledCount} cancelled` : 'All payments live',
            color: 'var(--aig-green-400)',
          },
          { label: 'Pending Review', value: String(pendingReview), sub: undefined, color: 'var(--warning)' },
          { label: 'Verified',       value: String(verifiedCount), sub: undefined, color: 'var(--success)' },
          { label: 'Rejected',       value: String(rejectedCount), sub: undefined, color: 'var(--danger)' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ padding: '1rem' }}>
            <div className="stat-value" style={{ fontSize: '1.375rem', color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
            {s.sub && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                {s.sub}
              </div>
            )}
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
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {(['', 'pending', 'submitted', 'under_review', 'verified', 'rejected', 'cancelled'] as const).map(s => {
            if (s === 'cancelled' && cancelledCount === 0) return null;
            return (
              <button
                key={s}
                className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter(s)}
              >
                {s === '' ? (!showCancelled ? 'Live Payments' : 'All Payments') : s === 'cancelled' ? `Cancelled (${cancelledCount})` : STATUS_LABEL[s as PaymentStatus]}
              </button>
            );
          })}
          {statusFilter !== 'cancelled' && cancelledCount > 0 && (
            <button
              type="button"
              className={`btn btn-sm ${showCancelled ? 'btn-outline-green' : 'btn-ghost'}`}
              onClick={() => setShowCancelled(s => !s)}
              data-testid="toggle-show-cancelled-payments-btn"
              title="Toggle whether cancelled payments appear in Live Payments"
            >
              {showCancelled ? 'Hiding Cancelled' : `+ Show ${cancelledCount} Cancelled`}
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
                <th>Payment Ref</th>
                <th>Order Reference</th>
                <th>Participant</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state" style={{ padding: '3rem 2rem' }}>
                      <div className="empty-icon"><Search size={22} color="var(--text-muted)" /></div>
                      <h3>{payments.length ? 'No payments match your filter' : 'No payments yet'}</h3>
                      <p>{payments.length ? 'Try selecting a different status or clearing the search.' : 'Payments appear here automatically when orders are created.'}</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(p => (
                <tr key={p.id}>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--aig-green-300)' }}>
                      {p.payment_ref}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {p.order_ref}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{p.participant}</td>
                  <td style={{ fontWeight: 600 }}>{formatCurrency(p.amount, p.currency)}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    {formatPaymentMethod(p.method)}
                    {p.method === 'installment' && p.installment_count
                      ? ` (${p.installments_paid ?? 0}/${p.installment_count})`
                      : ''}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_COLOR[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    {p.submitted_at ? formatDate(p.submitted_at) : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                      {(p.status === 'submitted' || p.status === 'under_review') && (
                        <>
                          <button className="btn btn-sm" style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.2)', gap: '0.25rem' }} onClick={() => setSelectedId(p.id)}>
                            <CheckCircle2 size={13} /> Verify
                          </button>
                        </>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => setSelectedId(p.id)} title="View details">
                        <Eye size={14} />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--danger)' }}
                        title="Delete payment"
                        onClick={() => {
                          if (window.confirm(`Permanently delete payment ${p.payment_ref}? Linked order will update automatically.`)) {
                            deletePayment(p.id);
                            toast('success', 'Payment deleted', `Payment ${p.payment_ref} removed. Linked order status synced.`);
                          }
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0.875rem 1.25rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Showing {filtered.length} of {payments.length} payments
        </div>
      </div>
    </div>
  );
}
