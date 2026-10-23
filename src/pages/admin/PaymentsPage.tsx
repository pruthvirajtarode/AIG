import React, { useEffect, useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Search, CheckCircle2, XCircle, Eye, Clock, X, Upload, Download, ExternalLink, ZoomIn, ZoomOut, FileX } from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import type { PaymentStatus } from '@/lib/database.types';
import { useToast } from '@/contexts/ToastContext';

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

// ── Payment type ──────────────────────────────────────────────
type Payment = {
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
  /** URL (signed/public) of the uploaded bank slip. When absent, a sample slip is rendered for submitted payments. */
  proof_url?: string | null;
};

const MOCK_PAYMENTS: Payment[] = [];

// ── Proof helpers ─────────────────────────────────────────────
const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Builds a sample bank-slip SVG for mock data (until real proofs come from storage). */
function buildSampleSlipSvg(p: Payment): string {
  const rows: [string, string][] = [
    ['Reference', p.payment_ref],
    ['Order', p.order_ref],
    ['Sender', p.participant],
    ['Bank', p.bank || '—'],
    ['Amount', formatCurrency(p.amount, p.currency)],
    ['Date', p.submitted_at ? formatDateTime(p.submitted_at) : '—'],
    ['Status', 'SUCCESSFUL'],
  ];
  const body = rows.map(([k, v], i) =>
    `<text x="40" y="${190 + i * 44}" font-size="16" fill="#6b7280">${escapeXml(k)}</text>` +
    `<text x="560" y="${190 + i * 44}" font-size="18" font-weight="600" fill="#111827" text-anchor="end">${escapeXml(v)}</text>` +
    `<line x1="40" y1="${202 + i * 44}" x2="560" y2="${202 + i * 44}" stroke="#e5e7eb"/>`
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="560" viewBox="0 0 600 560" font-family="Arial, Helvetica, sans-serif">` +
    `<rect width="600" height="560" fill="#ffffff"/>` +
    `<rect width="600" height="110" fill="#0f6b4d"/>` +
    `<text x="40" y="58" font-size="26" font-weight="700" fill="#ffffff">${escapeXml(p.bank || 'Bank')} — Transfer Receipt</text>` +
    `<text x="40" y="88" font-size="14" fill="#bbf7d0">Sample proof of payment</text>` +
    body +
    `<text x="300" y="530" font-size="13" fill="#9ca3af" text-anchor="middle">This is a system-generated sample slip</text>` +
    `</svg>`;
}

function ProofViewer({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [failed, setFailed] = useState(false);
  const hasProof = !!payment.proof_url || !!payment.submitted_at;

  // Resolve the proof URL (blob URL for generated sample slips so it can be opened/downloaded)
  const [sampleUrl, setSampleUrl] = useState<string | null>(null);
  useEffect(() => {
    if (payment.proof_url || !payment.submitted_at) { setSampleUrl(null); return; }
    const objectUrl = URL.createObjectURL(new Blob([buildSampleSlipSvg(payment)], { type: 'image/svg+xml' }));
    setSampleUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [payment]);

  const url = payment.proof_url ?? sampleUrl;
  const isPdf = !!url && /\.pdf($|\?)/i.test(url);
  const fileName = `${payment.payment_ref}-proof.${isPdf ? 'pdf' : payment.proof_url ? (payment.proof_url.split('?')[0].split('.').pop() || 'png') : 'svg'}`;

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

function PaymentDetailModal({ payment, onClose, onVerify, onReject }: {
  payment: Payment;
  onClose: () => void;
  onVerify: (id: string) => void;
  onReject: (id: string) => void;
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

          {payment.status === 'submitted' || payment.status === 'under_review' ? (
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
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  className="btn btn-primary"
                  style={{ gap: '0.5rem' }}
                  onClick={() => { onVerify(payment.id); onClose(); toast('success', 'Payment verified!', `${payment.payment_ref} has been verified.`); }}
                >
                  <CheckCircle2 size={15} /> Verify Payment
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => { onReject(payment.id); onClose(); toast('error', 'Payment rejected', rejectReason || `${payment.payment_ref} has been rejected.`); }}
                >
                  <XCircle size={15} /> Reject
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {showProof && <ProofViewer payment={payment} onClose={() => setShowProof(false)} />}
    </div>
  );
}

export function PaymentsPage() {
  usePageTitle('Payments');
  const [payments, setPayments] = useState<Payment[]>(MOCK_PAYMENTS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Payment | null>(null);

  const verifyPayment = (id: string) => {
    setPayments(prev => prev.map(p => p.id === id
      ? { ...p, status: 'verified' as PaymentStatus, verified_at: new Date().toISOString() }
      : p
    ));
  };

  const rejectPayment = (id: string) => {
    setPayments(prev => prev.map(p => p.id === id
      ? { ...p, status: 'rejected' as PaymentStatus }
      : p
    ));
  };

  const filtered = payments.filter(p => {
    const matchSearch =
      p.payment_ref.toLowerCase().includes(search.toLowerCase()) ||
      p.participant.toLowerCase().includes(search.toLowerCase()) ||
      p.order_ref.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pendingReview = payments.filter(p => p.status === 'submitted' || p.status === 'under_review').length;

  return (
    <div className="page-content animate-fadeInUp">
      {selected && (
        <PaymentDetailModal
          payment={selected}
          onClose={() => setSelected(null)}
          onVerify={verifyPayment}
          onReject={rejectPayment}
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
          { label: 'Total Collected', value: `SGD ${payments.filter(p => p.status === 'verified').reduce((a, p) => a + p.amount, 0).toLocaleString()}`, color: 'var(--aig-green-400)' },
          { label: 'Pending Review', value: String(pendingReview), color: 'var(--warning)' },
          { label: 'Verified',       value: String(payments.filter(p => p.status === 'verified').length), color: 'var(--success)' },
          { label: 'Rejected',       value: String(payments.filter(p => p.status === 'rejected').length), color: 'var(--danger)' },
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
          Showing {filtered.length} of {payments.length} payments
        </div>
      </div>
    </div>
  );
}
