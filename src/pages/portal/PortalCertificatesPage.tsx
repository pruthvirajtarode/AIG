import React, { useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Award, Download, QrCode, Eye, X } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { AnimalPhoto } from '@/components/ui/AnimalPhoto';

const PARTICIPANT_CERTS = [
  {
    id: 'c1',
    certificate_ref: 'CERT-2024-00042',
    programme_name: 'Goat — Malaysia',
    animal_ref: 'A-2024-087',
    animal_type: 'goat',
    qurban_date: '2024-06-30',
    status: 'sent',
    generated_at: '2024-07-01T09:00:00Z',
    verification_code: 'AIGCERT-A7B2-X9Q1',
  },
];

function CertViewModal({ cert, onClose }: { cert: typeof PARTICIPANT_CERTS[0]; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="heading-md">Qurban Certificate</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{
            background: 'linear-gradient(160deg, var(--aig-green-900) 0%, var(--surface-800) 50%, var(--surface-900) 100%)',
            border: '1px solid var(--border-green)',
            borderRadius: 16,
            padding: '3rem',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(31,133,97,0.1), transparent)', top: -100, right: -100, pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ width: 72, height: 72, borderRadius: 18, background: 'linear-gradient(135deg, var(--aig-green-700), var(--aig-green-500))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: '0 8px 24px rgba(31,133,97,0.5)' }}>
                <Award size={32} color="#fff" />
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--gold-400)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Certificate of Qurban</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>Al Ihsan Group</div>
              <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>This certifies that</div>
              <div style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: '0.5rem' }}>Ahmad Rizal bin Yusof</div>
              <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                has performed Qurban through the <strong style={{ color: 'var(--aig-green-300)' }}>{cert.programme_name}</strong> programme
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '2rem' }}>
                {[
                  ['Animal', `${cert.animal_type.charAt(0).toUpperCase() + cert.animal_type.slice(1)} · ${cert.animal_ref}`],
                  ['Qurban Date', formatDate(cert.qurban_date)],
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
          <button className="btn btn-primary" style={{ gap: '0.5rem' }}>
            <Download size={15} /> Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

export function PortalCertificatesPage() {
  usePageTitle('My Certificates');
  const [selected, setSelected] = useState<typeof PARTICIPANT_CERTS[0] | null>(null);

  return (
    <div className="page-content animate-fadeInUp">
      {selected && <CertViewModal cert={selected} onClose={() => setSelected(null)} />}

      <div className="page-header">
        <h1 className="page-title">My Certificates</h1>
        <p className="page-subtitle">View and download your Qurban certificates</p>
      </div>

      {PARTICIPANT_CERTS.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><Award size={24} color="var(--text-muted)" /></div>
            <h3>No certificates yet</h3>
            <p>Your Qurban certificates will appear here once your orders are completed.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {PARTICIPANT_CERTS.map(cert => (
            <div key={cert.id} className="card card-hover" style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => setSelected(cert)}>
              {/* Certificate preview */}
              <div style={{ padding: '2rem 1rem', background: 'linear-gradient(160deg, var(--aig-green-900), var(--surface-800))', borderRadius: 10, marginBottom: '1rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(31,133,97,0.2), transparent)', top: -50, right: -50, pointerEvents: 'none' }} />
                <AnimalPhoto type={cert.animal_type} size={88} radius={16} style={{ margin: '0 auto 0.75rem' }} />
                <Award size={36} color="var(--gold-400)" style={{ margin: '0 auto 0.75rem' }} />
                <div style={{ fontSize: '0.75rem', color: 'var(--gold-400)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Certificate of Qurban
                </div>
              </div>

              <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.25rem' }}>{cert.programme_name}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                {cert.animal_ref} · {formatDate(cert.qurban_date)}
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--aig-green-300)', marginBottom: '1rem' }}>
                {cert.certificate_ref}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <button className="btn btn-outline-green btn-sm" onClick={e => { e.stopPropagation(); setSelected(cert); }}>
                  <Eye size={13} /> View
                </button>
                <button className="btn btn-ghost btn-sm" onClick={e => e.stopPropagation()}>
                  <Download size={13} /> PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
