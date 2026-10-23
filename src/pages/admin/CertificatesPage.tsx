import React, { useState, useRef, useCallback } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Search, Award, Download, Send, RefreshCw, Eye, X, CheckCircle2, Printer } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { CertificateStatus } from '@/lib/database.types';
import { useToast } from '@/contexts/ToastContext';
import { AnimalPhoto } from '@/components/ui/AnimalPhoto';
import { CertificateDesign, type Certificate } from '@/components/ui/CertificateDesign';

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


const INITIAL_CERTIFICATES: Certificate[] = [];


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
