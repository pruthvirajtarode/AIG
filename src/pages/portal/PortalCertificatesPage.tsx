import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Award, Eye, X, Printer, LogOut, CheckCircle2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { AnimalPhoto } from '@/components/ui/AnimalPhoto';
import { CertificateDesign, printCertificate, type Certificate } from '@/components/ui/CertificateDesign';
import { useToast } from '@/contexts/ToastContext';
import { usePortalSession } from '@/hooks/usePortalSession';
import { ParticipantSignInCard } from '@/components/portal/ParticipantSignInCard';

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
        style={{ maxWidth: 860, width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: '#111' }}
      >
        <div className="modal-header" style={{ background: '#0a0a0a', borderBottom: '1px solid rgba(212,168,50,0.15)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Award size={18} color="#d4a832" />
            <div className="heading-md" style={{ color: '#fff' }}>Qurban Certificate</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div style={{ padding: 'clamp(0.625rem, 2.5vw, 1.25rem)', background: '#0d0d0d', overflowY: 'auto', flex: 1 }}>
          <CertificateDesign cert={cert} />
        </div>

        <div className="modal-footer" style={{ background: '#0a0a0a', borderTop: '1px solid rgba(212,168,50,0.15)', flexShrink: 0 }}>
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
  const [searchParams] = useSearchParams();
  const orderParam = (searchParams.get('order') || searchParams.get('ref') || '').trim().toUpperCase();

  const {
    sessionEmail,
    sessionOrderRef,
    participantName,
    matchedCertificates,
    isSignedIn,
    isStaffUser,
    isStaffPreview,
    signIn,
    signOut,
  } = usePortalSession();

  const [selected, setSelected] = useState<Certificate | null>(null);

  useEffect(() => {
    if (orderParam && matchedCertificates.length > 0) {
      const match = matchedCertificates.find(c => c.order_ref.trim().toUpperCase() === orderParam);
      if (match) setSelected(match as Certificate);
    }
  }, [orderParam, matchedCertificates]);

  // Download = open the viewer first (so the certificate is rendered), then print/save as PDF
  const handleDownload = (cert: Certificate) => {
    setSelected(cert);
    setTimeout(() => {
      if (!printCertificate(cert)) toast('error', 'Could not open print window', 'Please allow pop-ups for this site.');
    }, 300);
  };

  // If not signed in to a participant session, show Participant Sign In Card
  if (!isSignedIn) {
    return (
      <div className="page-content animate-fadeInUp">
        <div className="page-header">
          <h1 className="page-title">My Certificates</h1>
          <p className="page-subtitle">View and download your official Qurban digital certificates</p>
        </div>
        <ParticipantSignInCard
          title="Download Your Certificate"
          subtitle="Enter your registered email address or Order Reference to access your official Al Ihsan Group Qurban/Aqiqah certificate."
          actionLabel="Access My Certificates"
          signIn={signIn}
          isStaffUser={isStaffUser}
        />
      </div>
    );
  }

  return (
    <div className="page-content animate-fadeInUp">
      {selected && <CertViewModal cert={selected} onClose={() => setSelected(null)} />}

      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <h1 className="page-title">My Certificates</h1>
        <p className="page-subtitle">View and download your official Qurban digital certificates</p>
      </div>

      {/* Active participant banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          background: 'rgba(212,168,50,0.08)',
          border: '1px solid rgba(212,168,50,0.22)',
          borderRadius: 10,
          marginBottom: '1.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <CheckCircle2 size={16} color="#d4a832" />
          <div style={{ fontSize: '0.8125rem', color: '#f5f0e8' }}>
            {isStaffPreview && (
              <span className="badge badge-warning" style={{ marginRight: '0.5rem', fontSize: '0.7rem' }}>
                Staff Preview
              </span>
            )}
            Participant: <strong>{participantName || sessionEmail || sessionOrderRef}</strong>
            {sessionEmail && (
              <span style={{ color: 'var(--text-muted)', marginLeft: '0.375rem' }}>({sessionEmail})</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="btn btn-ghost btn-sm"
          style={{ fontSize: '0.75rem', gap: '0.35rem', color: 'var(--text-secondary)' }}
        >
          <LogOut size={13} />
          Switch Participant / Sign Out
        </button>
      </div>

      {matchedCertificates.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><Award size={24} color="var(--text-muted)" /></div>
            <h3>No certificates issued yet</h3>
            <p>Your official Qurban digital certificate will appear here as soon as your ritual is performed and verified.</p>
          </div>
        </div>
      ) : (
        <div className="card-grid-responsive">
          {matchedCertificates.map(cert => (
            <div
              key={cert.id}
              className="card card-hover"
              style={{ cursor: 'pointer', textAlign: 'center' }}
              onClick={() => setSelected(cert as Certificate)}
            >
              {/* Certificate preview */}
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
                  {cert.service_type === 'aqiqah' ? 'Aqiqah' : 'Qurban'}<br />Certificate
                </div>
                <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: 'italic', fontSize: '1.125rem', color: '#d4a832', marginTop: '0.5rem' }}>
                  {cert.qurban_name_holder || cert.participant_name}
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
                <button
                  className="btn btn-outline-green btn-sm"
                  onClick={e => { e.stopPropagation(); setSelected(cert as Certificate); }}
                >
                  <Eye size={13} /> View
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={e => { e.stopPropagation(); handleDownload(cert as Certificate); }}
                >
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
