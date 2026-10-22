import React, { useState, useRef, useCallback } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Search, Award, Download, Send, RefreshCw, Eye, X, CheckCircle2, Printer } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { CertificateStatus } from '@/lib/database.types';
import { useToast } from '@/contexts/ToastContext';
import { AnimalPhoto } from '@/components/ui/AnimalPhoto';

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

type Certificate = {
  id: string;
  certificate_ref: string;
  order_ref: string;
  participant_name: string;
  programme_name: string;
  country: string;
  animal_ref: string;
  animal_type: string;
  animal_label: string;
  qurban_date: string;
  status: CertificateStatus;
  generated_at: string | null;
  sent_at: string | null;
  verification_code: string;
  year: string;
};

const INITIAL_CERTIFICATES: Certificate[] = [
  { id: 'c1', certificate_ref: 'CERT-2025-00001', order_ref: 'AIG-2025-000155', participant_name: 'Siti Norzahra binti Md Zain', programme_name: 'Sheep — Turkey', country: 'Turkey', animal_ref: 'A-2025-007', animal_type: 'sheep', animal_label: 'Sheep', qurban_date: '2025-06-28', status: 'sent', generated_at: '2025-07-01T09:00:00Z', sent_at: '2025-07-01T09:05:00Z', verification_code: 'AIGCERT-A7B2-X9Q1', year: '2025/1446H' },
  { id: 'c2', certificate_ref: 'CERT-2025-00002', order_ref: 'AIG-2025-000154', participant_name: 'Zulkifli bin Othman', programme_name: 'Goat — Bangladesh', country: 'Bangladesh', animal_ref: 'A-2025-002', animal_type: 'goat', animal_label: 'Goat', qurban_date: '2025-06-28', status: 'sent', generated_at: '2025-07-01T09:10:00Z', sent_at: '2025-07-01T09:15:00Z', verification_code: 'AIGCERT-C3D4-Y7W2', year: '2025/1446H' },
  { id: 'c3', certificate_ref: 'CERT-2025-00003', order_ref: 'AIG-2025-000150', participant_name: 'Faridah binti Salleh', programme_name: 'Goat — Bangladesh', country: 'Bangladesh', animal_ref: 'A-2025-005', animal_type: 'goat', animal_label: 'Goat', qurban_date: '2025-06-28', status: 'generated', generated_at: '2025-07-02T08:30:00Z', sent_at: null, verification_code: 'AIGCERT-E5F6-Z3K8', year: '2025/1446H' },
  { id: 'c4', certificate_ref: 'CERT-2025-00004', order_ref: 'AIG-2025-000153', participant_name: 'Nur Izzati binti Kamal', programme_name: 'Cow Share — Somalia', country: 'Somalia', animal_ref: 'A-2025-004', animal_type: 'cow', animal_label: 'Cow', qurban_date: '2025-06-28', status: 'not_generated', generated_at: null, sent_at: null, verification_code: 'AIGCERT-G7H8-V1M4', year: '2025/1446H' },
  { id: 'c5', certificate_ref: 'CERT-2025-00005', order_ref: 'AIG-2025-000156', participant_name: 'Mohamad Faiz bin Ali', programme_name: 'Cow Share — Palestine', country: 'Palestine', animal_ref: 'A-2025-001', animal_type: 'cow', animal_label: 'Cow', qurban_date: '2025-06-29', status: 'not_generated', generated_at: null, sent_at: null, verification_code: 'AIGCERT-I9J0-U5N6', year: '2025/1446H' },
];


// ── Islamic Lantern SVG ────────────────────────────────────────
function Lantern({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      {/* chain */}
      <line x1="20" y1="-30" x2="20" y2="0" stroke="#d4a832" strokeWidth="1.5" />
      {/* lantern body */}
      <ellipse cx="20" cy="18" rx="14" ry="18" fill="#d4a832" />
      <ellipse cx="20" cy="18" rx="10" ry="14" fill="#b8860b" opacity="0.6" />
      {/* top cap */}
      <path d="M10,4 Q20,-2 30,4" fill="#d4a832" stroke="#b8860b" strokeWidth="0.5"/>
      {/* bottom tip */}
      <path d="M14,34 Q20,42 26,34" fill="#d4a832"/>
      {/* glow */}
      <ellipse cx="20" cy="18" rx="6" ry="8" fill="#ffe082" opacity="0.5" />
    </g>
  );
}

// ── Al Ihsan Logo (vector) ─────────────────────────────────────
function LogoText() {
  return (
    <div style={{ textAlign: 'center' }}>
      <img src="/logo.jpg" alt="Al Ihsan Group" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 12, display: 'block', margin: '0 auto' }} />
    </div>
  );
}

// ── Certificate Design ─────────────────────────────────────────
function CertificateDesign({ cert }: { cert: Certificate }) {
  return (
    <div
      id="certificate-print-area"
      style={{
        background: '#0a0a0a',
        width: '100%',
        aspectRatio: '1.414 / 1', // A4 landscape ratio
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        padding: '0',
      }}
    >
      {/* ── Top Islamic arch + geometric border ── */}
      <svg
        viewBox="0 0 900 220"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', pointerEvents: 'none', zIndex: 1 }}
        preserveAspectRatio="none"
      >
        {/* Top left geometric pattern */}
        <rect x="0" y="0" width="200" height="220" fill="rgba(180,140,30,0.12)" />
        <rect x="0" y="0" width="180" height="200" fill="none" stroke="#d4a832" strokeWidth="0.5" opacity="0.4" />
        {/* Diamond pattern tiling — left */}
        {[0,1,2,3,4,5].map(row => [0,1,2,3].map(col => (
          <rect key={`tl-${row}-${col}`} x={col*40+5} y={row*35+5} width="28" height="28" fill="none" stroke="#d4a832" strokeWidth="0.4" opacity="0.3" transform={`rotate(45,${col*40+19},${row*35+19})`} />
        )))}
        {/* Top right geometric pattern */}
        <rect x="700" y="0" width="200" height="220" fill="rgba(180,140,30,0.12)" />
        {[0,1,2,3,4,5].map(row => [0,1,2,3].map(col => (
          <rect key={`tr-${row}-${col}`} x={705+col*40} y={row*35+5} width="28" height="28" fill="none" stroke="#d4a832" strokeWidth="0.4" opacity="0.3" transform={`rotate(45,${705+col*40+14},${row*35+19})`} />
        )))}
        {/* Black arch curve */}
        <path d="M200,0 Q450,200 700,0" fill="#0a0a0a" />
        {/* Gold arch border */}
        <path d="M200,0 Q450,200 700,0" fill="none" stroke="#d4a832" strokeWidth="3" />
        {/* Gold border lines at top */}
        <line x1="0" y1="2" x2="900" y2="2" stroke="#d4a832" strokeWidth="1.5" opacity="0.6" />
        <line x1="0" y1="6" x2="900" y2="6" stroke="#d4a832" strokeWidth="0.5" opacity="0.4" />
        {/* Lanterns */}
        <Lantern x={130} y={10} scale={1.1} />
        <Lantern x={175} y={20} scale={0.8} />
        <Lantern x={690} y={10} scale={1.1} />
        <Lantern x={720} y={22} scale={0.75} />
      </svg>

      {/* ── Bottom border ── */}
      <svg viewBox="0 0 900 30" style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', pointerEvents: 'none', zIndex: 1 }} preserveAspectRatio="none">
        <line x1="0" y1="2" x2="900" y2="2" stroke="#d4a832" strokeWidth="1.5" opacity="0.6" />
        <line x1="0" y1="6" x2="900" y2="6" stroke="#d4a832" strokeWidth="0.5" opacity="0.4" />
        {/* Bottom geometric row */}
        {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(i => (
          <rect key={i} x={i*46+5} y={10} width="30" height="16" fill="none" stroke="#d4a832" strokeWidth="0.6" opacity="0.4" transform={`rotate(45,${i*46+20},18)`} />
        ))}
      </svg>

      {/* ── Certificate body ── */}
      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', width: '100%', padding: '80px 60px 20px', boxSizing: 'border-box' }}>

        {/* QURBAN CERTIFICATE heading */}
        <div style={{
          fontFamily: "'Cormorant Garamond', 'Georgia', serif",
          fontSize: 'clamp(20px, 4vw, 42px)',
          fontWeight: 700,
          color: '#ffffff',
          letterSpacing: '0.12em',
          lineHeight: 1.1,
          textTransform: 'uppercase',
          textShadow: '0 2px 8px rgba(0,0,0,0.5)',
          marginBottom: '0.4em',
        }}>
          QURBAN<br />CERTIFICATE
        </div>

        {/* Description */}
        <div style={{
          fontSize: 'clamp(9px, 1.1vw, 13px)',
          color: 'rgba(255,255,255,0.85)',
          maxWidth: 480,
          margin: '0 auto 0.8em',
          lineHeight: 1.6,
          fontWeight: 400,
        }}>
          This is to certify that Al Ihsan Group SG has faithfully fulfilled the amanah<br />
          entrusted to them in performing the Qurban ritual for
        </div>

        {/* Participant name — gold cursive */}
        <div style={{
          fontFamily: "'Cormorant Garamond', 'Georgia', serif",
          fontSize: 'clamp(22px, 4.5vw, 52px)',
          fontWeight: 600,
          fontStyle: 'italic',
          color: '#d4a832',
          textShadow: '0 2px 12px rgba(212,168,50,0.3)',
          margin: '0.1em 0 0.3em',
          lineHeight: 1.2,
          letterSpacing: '-0.01em',
        }}>
          {cert.participant_name}
        </div>

        {/* Details row */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 'clamp(16px, 3vw, 40px)',
          fontSize: 'clamp(9px, 1.1vw, 13px)',
          fontWeight: 700,
          color: '#ffffff',
          letterSpacing: '0.08em',
          marginBottom: '0.5em',
          flexWrap: 'wrap',
        }}>
          <span>LOCATION : {cert.country.toUpperCase()}</span>
          <span>LIVESTOCK : {cert.animal_label.toUpperCase()}</span>
          <span>YEAR : {cert.year}</span>
        </div>

        {/* Du'a */}
        <div style={{
          fontSize: 'clamp(8px, 0.95vw, 12px)',
          color: 'rgba(255,255,255,0.75)',
          marginBottom: '1em',
          fontStyle: 'italic',
          lineHeight: 1.7,
        }}>
          May Allah swt accept this Ibadah and reward us the best in this life and hereafter.<br />
          Ameen ya Rabb
        </div>

        {/* Bottom row: Serial | Logo | Signature */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: 620,
          margin: '0 auto',
          padding: '0 10px',
        }}>
          {/* Serial */}
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 'clamp(7px, 0.85vw, 11px)', color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: '0.06em' }}>SERIAL NO:</div>
            <div style={{ fontSize: 'clamp(8px, 1vw, 13px)', fontWeight: 700, color: '#d4a832', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
              {cert.certificate_ref.replace('CERT-', 'AIG-Q')}
            </div>
          </div>

          {/* Logo */}
          <LogoText />

          {/* Gold seal / signature */}
          <div style={{ textAlign: 'right' }}>
            <div style={{
              width: 50, height: 50,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #d4a832 0%, #92700e 60%, #6b5010 100%)',
              margin: '0 auto 4px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(212,168,50,0.4)',
            }}>
              <Award size={20} color="#fff" />
            </div>
            <div style={{ fontSize: 'clamp(7px, 0.8vw, 10px)', color: 'rgba(255,255,255,0.7)', fontWeight: 600, letterSpacing: '0.04em' }}>UST KHIDR MUHAMMAD</div>
          </div>
        </div>

        {/* Verification code */}
        <div style={{
          marginTop: '0.5em',
          fontSize: 'clamp(7px, 0.8vw, 10px)',
          color: 'rgba(255,255,255,0.35)',
          fontFamily: 'monospace',
          letterSpacing: '0.08em',
        }}>
          VERIFICATION: {cert.verification_code} · {cert.certificate_ref}
        </div>
      </div>
    </div>
  );
}

// ── Certificate Preview + Action Modal ─────────────────────────
function CertPreviewModal({
  cert,
  onClose,
  onStatusChange,
}: {
  cert: Certificate;
  onClose: () => void;
  onStatusChange: (id: string, status: CertificateStatus) => void;
}) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  const handleDownload = useCallback(() => {
    // Open a new print window with the certificate
    const certEl = document.getElementById('certificate-print-area');
    if (!certEl) return;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8"/>
        <title>Qurban Certificate — ${cert.participant_name}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { background:#0a0a0a; }
          @page { size: A4 landscape; margin: 0; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        ${certEl.outerHTML}
        <script>window.onload = function(){ window.print(); window.close(); }</script>
      </body>
      </html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
    toast('success', 'Certificate ready to print/save as PDF');
  }, [cert, toast]);

  const handleSend = useCallback(async () => {
    setSending(true);
    // Simulate email send (1.5s delay)
    await new Promise(r => setTimeout(r, 1500));
    setSending(false);
    onStatusChange(cert.id, 'sent');
    toast('success', 'Certificate sent!', `Email sent to participant for ${cert.participant_name}`);
    onClose();
  }, [cert, toast, onStatusChange, onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 860, width: '95%', background: '#111' }}
      >
        {/* Header */}
        <div className="modal-header" style={{ background: '#0a0a0a', borderBottom: '1px solid rgba(212,168,50,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Award size={18} color="#d4a832" />
            <div className="heading-md" style={{ color: '#fff' }}>Certificate Preview</div>
            <span className={`badge ${CERT_STATUS_BADGE[cert.status]}`}>{CERT_STATUS_LABEL[cert.status]}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Certificate design */}
        <div style={{ padding: '1.25rem', background: '#0d0d0d' }}>
          <CertificateDesign cert={cert} />
        </div>

        {/* Footer actions */}
        <div className="modal-footer" style={{ background: '#0a0a0a', borderTop: '1px solid rgba(212,168,50,0.15)', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>

          {/* Download / Print */}
          <button
            className="btn btn-secondary"
            onClick={handleDownload}
            style={{ gap: '0.5rem' }}
          >
            <Printer size={15} />
            Download / Print
          </button>

          {/* Send */}
          {cert.status !== 'sent' && (
            <button
              className="btn"
              onClick={handleSend}
              disabled={sending}
              style={{
                gap: '0.5rem',
                background: 'linear-gradient(135deg, #92700e, #d4a832, #92700e)',
                color: '#fff',
                border: 'none',
                boxShadow: '0 4px 14px rgba(212,168,50,0.3)',
              }}
            >
              {sending ? <span className="spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff', width: 14, height: 14 }} /> : <Send size={15} />}
              {sending ? 'Sending…' : 'Send to Participant'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export function CertificatesPage() {
  usePageTitle('Certificates');
  const { toast } = useToast();
  const [certs, setCerts] = useState<Certificate[]>(INITIAL_CERTIFICATES);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Certificate | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);

  const updateStatus = useCallback((id: string, status: CertificateStatus) => {
    setCerts(prev => prev.map(c => c.id === id
      ? { ...c, status, generated_at: c.generated_at ?? new Date().toISOString() }
      : c
    ));
    // Update selected if open
    setSelected(prev => prev?.id === id ? { ...prev, status } : prev);
  }, []);

  const handleGenerate = useCallback(async (id: string, name: string) => {
    setGenerating(id);
    await new Promise(r => setTimeout(r, 1200)); // simulate
    setGenerating(null);
    updateStatus(id, 'generated');
    toast('success', 'Certificate generated!', `Certificate for ${name} is ready.`);
  }, [toast, updateStatus]);

  const handleBulkGenerate = useCallback(async () => {
    const notGen = certs.filter(c => c.status === 'not_generated');
    if (!notGen.length) { toast('info', 'All certificates already generated'); return; }
    setBulkGenerating(true);
    await new Promise(r => setTimeout(r, 2000));
    setCerts(prev => prev.map(c =>
      c.status === 'not_generated' ? { ...c, status: 'generated', generated_at: new Date().toISOString() } : c
    ));
    setBulkGenerating(false);
    toast('success', `${notGen.length} certificates generated!`);
  }, [certs, toast]);

  const handleBulkSend = useCallback(async () => {
    const toSend = certs.filter(c => c.status === 'generated');
    if (!toSend.length) { toast('info', 'No generated certificates to send'); return; }
    setBulkSending(true);
    await new Promise(r => setTimeout(r, 2000));
    setCerts(prev => prev.map(c =>
      c.status === 'generated' ? { ...c, status: 'sent', sent_at: new Date().toISOString() } : c
    ));
    setBulkSending(false);
    toast('success', `${toSend.length} certificates sent to participants!`);
  }, [certs, toast]);

  const handleSend = useCallback(async (cert: Certificate) => {
    await new Promise(r => setTimeout(r, 1200));
    updateStatus(cert.id, 'sent');
    toast('success', 'Certificate sent!', `Email sent for ${cert.participant_name}`);
  }, [toast, updateStatus]);

  const filtered = certs.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = c.certificate_ref.toLowerCase().includes(q) || c.participant_name.toLowerCase().includes(q);
    const matchStatus = !statusFilter || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="page-content animate-fadeInUp">
      {selected && (
        <CertPreviewModal
          cert={selected}
          onClose={() => setSelected(null)}
          onStatusChange={updateStatus}
        />
      )}

      {/* Header */}
      <div className="page-header page-header-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Certificates</h1>
          <p className="page-subtitle">Generate and distribute Qurban certificates</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleBulkGenerate}
            disabled={bulkGenerating}
          >
            {bulkGenerating
              ? <span className="spinner" style={{ width: 13, height: 13 }} />
              : <RefreshCw size={14} />}
            Bulk Generate
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleBulkSend}
            disabled={bulkSending}
          >
            {bulkSending
              ? <span className="spinner" style={{ width: 13, height: 13, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
              : <Send size={14} />}
            Bulk Send
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        {[
          { label: 'Total', value: String(certs.length), color: 'var(--aig-green-400)' },
          { label: 'Not Generated', value: String(certs.filter(c => c.status === 'not_generated').length), color: 'var(--text-muted)' },
          { label: 'Generated', value: String(certs.filter(c => c.status === 'generated').length), color: 'var(--info)' },
          { label: 'Sent', value: String(certs.filter(c => c.status === 'sent').length), color: 'var(--success)' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ padding: '1rem' }}>
            <div className="stat-value" style={{ fontSize: '1.375rem', color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="search-bar">
          <Search className="search-icon" size={15} />
          <input
            id="certificates-search"
            type="search"
            className="form-input"
            placeholder="Search by name or ref…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ height: 38 }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(['', 'not_generated', 'generated', 'sent', 'failed'] as const).map(s => (
            <button
              key={s}
              className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter(s)}
            >
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
                    <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--gold-400)' }}>
                      {c.certificate_ref}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{c.participant_name}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{c.programme_name}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                      <AnimalPhoto type={c.animal_type} size={32} radius={8} />
                      {c.animal_ref}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    {c.qurban_date ? formatDate(c.qurban_date) : '—'}
                  </td>
                  <td>
                    <span className={`badge ${CERT_STATUS_BADGE[c.status]}`}>
                      {CERT_STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                      {c.status === 'not_generated' ? (
                        /* GENERATE button */
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ gap: '0.375rem' }}
                          disabled={generating === c.id}
                          onClick={() => handleGenerate(c.id, c.participant_name)}
                        >
                          {generating === c.id
                            ? <span className="spinner" style={{ width: 12, height: 12, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                            : <Award size={12} />}
                          {generating === c.id ? 'Generating…' : 'Generate'}
                        </button>
                      ) : (
                        <>
                          {/* PREVIEW */}
                          <button
                            className="btn btn-ghost btn-sm"
                            title="Preview Certificate"
                            onClick={() => setSelected(c)}
                          >
                            <Eye size={14} />
                          </button>

                          {/* DOWNLOAD */}
                          <button
                            className="btn btn-ghost btn-sm"
                            title="Download / Print Certificate"
                            onClick={() => {
                              setSelected(c);
                              // slight delay so modal renders before we trigger print
                              setTimeout(() => {
                                const el = document.getElementById('certificate-print-area');
                                if (!el) return;
                                const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Qurban Certificate — ${c.participant_name}</title><link rel="preconnect" href="https://fonts.googleapis.com"/><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet"/><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#0a0a0a;}@page{size:A4 landscape;margin:0;}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style></head><body>${el.outerHTML}<script>window.onload=function(){window.print();window.close();}</script></body></html>`;
                                const w = window.open('', '_blank');
                                if (w) { w.document.write(html); w.document.close(); }
                              }, 300);
                            }}
                          >
                            <Download size={14} />
                          </button>

                          {/* SEND — only for generated, not yet sent */}
                          {c.status === 'generated' && (
                            <button
                              className="btn btn-sm"
                              style={{
                                gap: '0.375rem',
                                background: 'linear-gradient(135deg, #92700e, #d4a832)',
                                color: '#fff',
                                border: 'none',
                                boxShadow: '0 2px 8px rgba(212,168,50,0.25)',
                              }}
                              onClick={() => handleSend(c)}
                            >
                              <Send size={12} />
                              Send
                            </button>
                          )}

                          {/* Sent badge indicator */}
                          {c.status === 'sent' && (
                            <span title={`Sent ${c.sent_at ? formatDate(c.sent_at) : ''}`}>
                              <CheckCircle2 size={14} color="var(--success)" />
                            </span>
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
          Showing {filtered.length} of {certs.length} certificates
        </div>
      </div>
    </div>
  );
}
