import React, { useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Search, Award, Download, Send, RefreshCw, Eye, X, QrCode } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { CertificateStatus } from '@/lib/database.types';

const CERT_STATUS_BADGE: Record<CertificateStatus, string> = {
  not_generated: 'badge-gray',
  generating:    'badge-yellow',
  generated:     'badge-blue',
  sent:          'badge-green',
  regenerated:   'badge-teal',
  failed:        'badge-red',
};

const CERT_STATUS_LABEL: Record<CertificateStatus, string> = {
  not_generated: 'Not Generated',
  generating:    'Generating',
  generated:     'Generated',
  sent:          'Sent',
  regenerated:   'Regenerated',
  failed:        'Failed',
};

const MOCK_CERTIFICATES = [
  { id: 'c1', certificate_ref: 'CERT-2025-00001', order_ref: 'AIG-2025-000155', participant_name: 'Siti Norzahra binti Md Zain', programme_name: 'Sheep — Turkey', animal_ref: 'A-2025-007', animal_type: 'sheep', qurban_date: '2025-06-28', status: 'sent' as CertificateStatus, generated_at: '2025-07-01T09:00:00Z', sent_at: '2025-07-01T09:05:00Z', verification_code: 'AIGCERT-A7B2-X9Q1' },
  { id: 'c2', certificate_ref: 'CERT-2025-00002', order_ref: 'AIG-2025-000154', participant_name: 'Zulkifli bin Othman', programme_name: 'Goat — Bangladesh', animal_ref: 'A-2025-002', animal_type: 'goat', qurban_date: '2025-06-28', status: 'sent' as CertificateStatus, generated_at: '2025-07-01T09:10:00Z', sent_at: '2025-07-01T09:15:00Z', verification_code: 'AIGCERT-C3D4-Y7W2' },
  { id: 'c3', certificate_ref: 'CERT-2025-00003', order_ref: 'AIG-2025-000150', participant_name: 'Faridah binti Salleh', programme_name: 'Goat — Bangladesh', animal_ref: 'A-2025-005', animal_type: 'goat', qurban_date: '2025-06-28', status: 'generated' as CertificateStatus, generated_at: '2025-07-02T08:30:00Z', sent_at: null, verification_code: 'AIGCERT-E5F6-Z3K8' },
  { id: 'c4', certificate_ref: 'CERT-2025-00004', order_ref: 'AIG-2025-000153', participant_name: 'Nur Izzati binti Kamal', programme_name: 'Cow Share — Somalia', animal_ref: 'A-2025-004', animal_type: 'cow', qurban_date: '2025-06-28', status: 'not_generated' as CertificateStatus, generated_at: null, sent_at: null, verification_code: 'AIGCERT-G7H8-V1M4' },
  { id: 'c5', certificate_ref: 'CERT-2025-00005', order_ref: 'AIG-2025-000156', participant_name: 'Mohamad Faiz bin Ali', programme_name: 'Cow Share — Palestine', animal_ref: 'A-2025-001', animal_type: 'cow', qurban_date: '2025-06-29', status: 'not_generated' as CertificateStatus, generated_at: null, sent_at: null, verification_code: 'AIGCERT-I9J0-U5N6' },
];

const ANIMAL_EMOJI: Record<string, string> = { cow: '🐄', goat: '🐐', sheep: '🐑', camel: '🐪', buffalo: '🐃' };

function CertPreviewModal({ cert, onClose }: { cert: typeof MOCK_CERTIFICATES[0]; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="heading-md">Certificate Preview</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {/* Certificate Design */}
          <div style={{
            background: 'linear-gradient(160deg, var(--aig-green-900) 0%, var(--surface-800) 50%, var(--surface-900) 100%)',
            border: '1px solid var(--border-green)',
            borderRadius: 16,
            padding: '3rem',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Decorative circles */}
            <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(31,133,97,0.1), transparent)', top: -100, right: -100, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,168,50,0.08), transparent)', bottom: -60, left: -60, pointerEvents: 'none' }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ width: 72, height: 72, borderRadius: 18, background: 'linear-gradient(135deg, var(--aig-green-700), var(--aig-green-500))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: '0 8px 24px rgba(31,133,97,0.5)' }}>
                <Award size={32} color="#fff" />
              </div>

              <div style={{ fontSize: '0.875rem', color: 'var(--gold-400)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
                Certificate of Qurban
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>Al Ihsan Group · {new Date().getFullYear()}</div>

              <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>This is to certify that</div>
              <div style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: '0.5rem' }}>
                {cert.participant_name}
              </div>
              <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                has performed Qurban through the <strong style={{ color: 'var(--aig-green-300)' }}>{cert.programme_name}</strong> programme
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '2rem' }}>
                {[
                  ['Animal', `${ANIMAL_EMOJI[cert.animal_type]} ${cert.animal_ref}`],
                  ['Qurban Date', cert.qurban_date ? formatDate(cert.qurban_date) : '—'],
                  ['Certificate', cert.certificate_ref],
                ].map(([label, value]) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                    <div style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', fontWeight: 600, marginTop: '0.25rem' }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '0.875rem 1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
                <QrCode size={28} color="var(--aig-green-300)" />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Verification Code</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--aig-green-200)', fontWeight: 600 }}>{cert.verification_code}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-secondary" style={{ gap: '0.5rem' }}>
            <Download size={15} /> Download PDF
          </button>
          {cert.status !== 'sent' && (
            <button className="btn btn-primary" style={{ gap: '0.5rem' }}>
              <Send size={15} /> Send to Participant
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function CertificatesPage() {
  usePageTitle('Certificates');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<typeof MOCK_CERTIFICATES[0] | null>(null);

  const filtered = MOCK_CERTIFICATES.filter(c => {
    const matchSearch = c.certificate_ref.toLowerCase().includes(search.toLowerCase()) || c.participant_name.toLowerCase().includes(search.toLowerCase()) || c.order_ref.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="page-content animate-fadeInUp">
      {selected && <CertPreviewModal cert={selected} onClose={() => setSelected(null)} />}

      <div className="page-header page-header-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Certificates</h1>
          <p className="page-subtitle">Generate and distribute Qurban certificates</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary btn-sm">
            <RefreshCw size={14} />
            Bulk Generate
          </button>
          <button className="btn btn-primary btn-sm">
            <Send size={14} />
            Bulk Send
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        {[
          { label: 'Total', value: String(MOCK_CERTIFICATES.length), color: 'var(--aig-green-400)' },
          { label: 'Not Generated', value: String(MOCK_CERTIFICATES.filter(c => c.status === 'not_generated').length), color: 'var(--text-muted)' },
          { label: 'Generated', value: String(MOCK_CERTIFICATES.filter(c => c.status === 'generated').length), color: 'var(--info)' },
          { label: 'Sent', value: String(MOCK_CERTIFICATES.filter(c => c.status === 'sent').length), color: 'var(--success)' },
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
          <input id="certificates-search" type="search" className="form-input" placeholder="Search certificates..." value={search} onChange={e => setSearch(e.target.value)} style={{ height: 38 }} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['', 'not_generated', 'generated', 'sent', 'failed'] as const).map(s => (
            <button key={s} className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter(s)}>
              {s === '' ? 'All' : CERT_STATUS_LABEL[s as CertificateStatus]}
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
                <th>Certificate Ref</th>
                <th>Participant</th>
                <th>Programme</th>
                <th>Animal</th>
                <th>Qurban Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--gold-400)' }}>{c.certificate_ref}</span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{c.participant_name}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{c.programme_name}</td>
                  <td>
                    <span>{ANIMAL_EMOJI[c.animal_type]} {c.animal_ref}</span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    {c.qurban_date ? formatDate(c.qurban_date) : '—'}
                  </td>
                  <td><span className={`badge ${CERT_STATUS_BADGE[c.status]}`}>{CERT_STATUS_LABEL[c.status]}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      {c.status === 'not_generated' ? (
                        <button className="btn btn-primary btn-sm" style={{ gap: '0.375rem' }}>
                          <Award size={12} /> Generate
                        </button>
                      ) : (
                        <>
                          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(c)} title="Preview">
                            <Eye size={14} />
                          </button>
                          <button className="btn btn-ghost btn-sm" title="Download">
                            <Download size={14} />
                          </button>
                          {c.status === 'generated' && (
                            <button className="btn btn-outline-green btn-sm" style={{ gap: '0.375rem' }}>
                              <Send size={12} /> Send
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0.875rem 1.25rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Showing {filtered.length} of {MOCK_CERTIFICATES.length} certificates
        </div>
      </div>
    </div>
  );
}
