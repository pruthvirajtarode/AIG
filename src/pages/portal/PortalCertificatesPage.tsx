import React, { useState, useCallback } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Award, Eye, X, Printer } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { AnimalPhoto } from '@/components/ui/AnimalPhoto';
import { CertificateDesign, printCertificate, type Certificate } from '@/components/ui/CertificateDesign';
import { useToast } from '@/contexts/ToastContext';

// Same shape as the admin certificates, so the participant sees the identical certificate.
const PARTICIPANT_CERTS: Certificate[] = [
  {
    id: 'c1',
    certificate_ref: 'CERT-2024-00042',
    order_ref: 'AIG-2024-000110',
    participant_name: 'Ahmad Rizal bin Yusof',
    programme_name: 'Goat — Malaysia',
    country: 'Malaysia',
    animal_ref: 'A-2024-087',
    animal_type: 'goat',
    animal_label: 'Goat',
    qurban_date: '2024-06-30',
    status: 'sent',
    generated_at: '2024-07-01T09:00:00Z',
    sent_at: '2024-07-01T09:05:00Z',
    verification_code: 'AIGCERT-A7B2-X9Q1',
    year: '2024/1445H',
  },
];

// ── Certificate viewer (same design as the admin preview) ─────
function CertViewModal({ cert, onClose }: { cert: Certificate; onClose: () => void }) {
  const { toast } = useToast();

  const handlePrint = useCallback(() => {
    if (printCertificate(cert)) toast('success', 'Certificate ready to print/save as PDF');
    else toast('error', 'Could not open print window', 'Please allow pop-ups for this site.');
  }, [cert, toast]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 860, width: '95%', background: '#111' }}
      >
        <div className="modal-header" style={{ background: '#0a0a0a', borderBottom: '1px solid rgba(212,168,50,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Award size={18} color="#d4a832" />
            <div className="heading-md" style={{ color: '#fff' }}>Qurban Certificate</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div style={{ padding: '1.25rem', background: '#0d0d0d' }}>
          <CertificateDesign cert={cert} />
        </div>

        <div className="modal-footer" style={{ background: '#0a0a0a', borderTop: '1px solid rgba(212,168,50,0.15)' }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-secondary" onClick={handlePrint} style={{ gap: '0.5rem' }}>
            <Printer size={15} /> Download / Print
          </button>
        </div>
      </div>
    </div>
  );
}

export function PortalCertificatesPage() {
  usePageTitle('My Certificates');
  const { toast } = useToast();
  const [selected, setSelected] = useState<Certificate | null>(null);

  // Download = open the viewer first (so the certificate is rendered), then print/save as PDF
  const handleDownload = (cert: Certificate) => {
    setSelected(cert);
    setTimeout(() => {
      if (!printCertificate(cert)) toast('error', 'Could not open print window', 'Please allow pop-ups for this site.');
    }, 300);
  };

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
              {/* Certificate preview — matches the admin certificate colours (black + gold) */}
              <div style={{
                padding: '1.75rem 1rem',
                background: 'linear-gradient(160deg, #0a0a0a, #17130a)',
                border: '1px solid rgba(212,168,50,0.3)',
                borderRadius: 10,
                marginBottom: '1rem',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,168,50,0.18), transparent)', top: -60, right: -60, pointerEvents: 'none' }} />
                <AnimalPhoto type={cert.animal_type} size={80} radius={16} style={{ margin: '0 auto 0.75rem' }} />
                <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.375rem', fontWeight: 700, color: '#fff', letterSpacing: '0.12em', lineHeight: 1.1, textTransform: 'uppercase' }}>
                  Qurban<br />Certificate
                </div>
                <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: 'italic', fontSize: '1.125rem', color: '#d4a832', marginTop: '0.5rem' }}>
                  {cert.participant_name}
                </div>
              </div>

              <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.25rem' }}>{cert.programme_name}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                {cert.animal_ref} · {formatDate(cert.qurban_date)}
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--gold-400)', marginBottom: '1rem' }}>
                {cert.certificate_ref}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <button className="btn btn-outline-green btn-sm" onClick={e => { e.stopPropagation(); setSelected(cert); }}>
                  <Eye size={13} /> View
                </button>
                <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); handleDownload(cert); }}>
                  <Printer size={13} /> PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
