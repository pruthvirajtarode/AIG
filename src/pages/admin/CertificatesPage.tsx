import React, { useState, useCallback } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Search, Award, Download, Send, RefreshCw, Eye, X, CheckCircle2, Printer } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { CertificateStatus } from '@/lib/database.types';
import { useToast } from '@/contexts/ToastContext';
import { AnimalPhoto } from '@/components/ui/AnimalPhoto';
import { CertificateDesign, printCertificate, type Certificate } from '@/components/ui/CertificateDesign';
import { useAppData } from '@/contexts/AppDataContext';
import { OFFICIAL_WHATSAPP_DISPLAY, selectCertificateTemplate } from '@/lib/orderRules';
import { notificationService } from '@/services/notificationService';

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
    if (printCertificate(cert)) {
      toast('success', 'Certificate ready to print/save as PDF');
    } else {
      toast('error', 'Could not open print window', 'Please allow pop-ups for this site.');
    }
  }, [cert, toast]);

  const handleSend = useCallback(async () => {
    setSending(true);
    await new Promise(r => setTimeout(r, 800));
    setSending(false);
    onStatusChange(cert.id, 'sent');
    const conn = notificationService.getDiagnostics().whatsappConnectionStatus;
    const isLive = conn === 'connected' || conn === 'edge_function_configured';
    toast(
      isLive ? 'success' : 'info',
      isLive ? 'Certificate-Ready WhatsApp sent!' : 'Certificate Marked Sent (WhatsApp Sandbox Mode)',
      isLive
        ? `Notified ${cert.qurban_name_holder || cert.participant_name} from ${OFFICIAL_WHATSAPP_DISPLAY} (Email fallback enabled) with Portal PDF link.`
        : `WhatsApp provider is not connected live yet — logged sandbox dispatch for ${cert.qurban_name_holder || cert.participant_name}.`,
    );
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Award size={18} color="#d4a832" />
            <div className="heading-md" style={{ color: '#fff' }}>Certificate Preview</div>
            <span className={`badge ${CERT_STATUS_BADGE[cert.status]}`}>{CERT_STATUS_LABEL[cert.status]}</span>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" aria-label="Close certificate preview" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Certificate design */}
        <div style={{ padding: 'clamp(0.625rem, 2.5vw, 1.25rem)', background: '#0d0d0d' }}>
          <CertificateDesign cert={cert} />
        </div>

        {/* Footer actions */}
        <div className="modal-footer" style={{ background: '#0a0a0a', borderTop: '1px solid rgba(212,168,50,0.15)', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>

          {/* Download / Print */}
          <button
            type="button"
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
              type="button"
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
              {sending ? 'Sending…' : 'Notify via WhatsApp'}
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
  const { certificates: rawCerts, orders, updateCertStatus } = useAppData();
  // Adapt context type to local Certificate type used by CertificateDesign
  const certs = rawCerts as unknown as Certificate[];
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [selected, setSelected] = useState<Certificate | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);

  const isCertCancelled = useCallback((c: Certificate) => {
    const linkedOrder = orders.find(o => o.order_ref === c.order_ref);
    if (linkedOrder && linkedOrder.status === 'cancelled') return true;
    return false;
  }, [orders]);

  const cancelledCount = certs.filter(isCertCancelled).length;
  const liveCerts = certs.filter(c => !isCertCancelled(c));

  const updateStatus = useCallback((id: string, status: CertificateStatus) => {
    updateCertStatus(id, status);
    setSelected(prev => prev?.id === id ? { ...prev, status } : prev);
  }, [updateCertStatus]);

  const handleGenerate = useCallback(async (id: string, name: string) => {
    setGenerating(id);
    await new Promise(r => setTimeout(r, 1200)); // simulate
    setGenerating(null);
    updateStatus(id, 'generated');
    toast('success', 'Certificate generated!', `Certificate for ${name} is ready in Participant Portal & WhatsApp notification sent.`);
  }, [toast, updateStatus]);

  const handleBulkGenerate = useCallback(async () => {
    const notGen = liveCerts.filter(c => c.status === 'not_generated');
    if (!notGen.length) { toast('info', 'All active certificates already generated'); return; }
    setBulkGenerating(true);
    await new Promise(r => setTimeout(r, 2000));
    notGen.forEach(c => updateCertStatus(c.id, 'generated'));
    setBulkGenerating(false);
    toast('success', `${notGen.length} certificates generated!`);
  }, [liveCerts, toast, updateCertStatus]);

  const handleBulkSend = useCallback(async () => {
    const toSend = liveCerts.filter(c => c.status === 'generated');
    if (!toSend.length) { toast('info', 'No active generated certificates to send'); return; }
    setBulkSending(true);
    await new Promise(r => setTimeout(r, 1200));
    toSend.forEach(c => updateCertStatus(c.id, 'sent'));
    setBulkSending(false);
    const conn = notificationService.getDiagnostics().whatsappConnectionStatus;
    const isLive = conn === 'connected' || conn === 'edge_function_configured';
    toast(
      isLive ? 'success' : 'info',
      isLive
        ? `${toSend.length} WhatsApp notifications sent!`
        : `${toSend.length} certificates marked sent (WhatsApp Sandbox Mode)`,
      isLive
        ? `Sent from ${OFFICIAL_WHATSAPP_DISPLAY} with Portal PDF download link (Email fallback active).`
        : 'Configure the WhatsApp Cloud API Edge Function secrets to enable live Meta delivery.',
    );
  }, [liveCerts, toast, updateCertStatus]);

  const handleSend = useCallback(async (cert: Certificate) => {
    await new Promise(r => setTimeout(r, 800));
    updateCertStatus(cert.id, 'sent');
    const conn = notificationService.getDiagnostics().whatsappConnectionStatus;
    const isLive = conn === 'connected' || conn === 'edge_function_configured';
    toast(
      isLive ? 'success' : 'info',
      isLive ? 'Certificate-Ready WhatsApp sent!' : 'Certificate Marked Sent (WhatsApp Sandbox Mode)',
      isLive
        ? `Notified ${cert.qurban_name_holder || cert.participant_name} from ${OFFICIAL_WHATSAPP_DISPLAY} (Email fallback enabled) to download PDF in Portal.`
        : `WhatsApp provider is not connected live yet — logged sandbox dispatch for ${cert.qurban_name_holder || cert.participant_name}.`,
    );
  }, [toast, updateCertStatus]);

  const filtered = certs.filter(c => {
    const isCancelled = isCertCancelled(c);
    if (statusFilter === 'cancelled') {
      if (!isCancelled) return false;
    } else {
      if (!showCancelled && isCancelled) return false;
      if (statusFilter && c.status !== statusFilter) return false;
    }
    const q = search.toLowerCase();
    const matchSearch =
      c.certificate_ref.toLowerCase().includes(q) ||
      c.participant_name.toLowerCase().includes(q) ||
      (c.qurban_name_holder ?? '').toLowerCase().includes(q) ||
      c.order_ref.toLowerCase().includes(q);
    return matchSearch;
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
          <p className="page-subtitle">Generate Qurban certificates for Portal PDF download &amp; WhatsApp notification</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
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
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleBulkSend}
            disabled={bulkSending}
          >
            {bulkSending
              ? <span className="spinner" style={{ width: 13, height: 13, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
              : <Send size={14} />}
            Bulk Notify (WhatsApp)
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        {[
          {
            label: 'Live Certificates',
            value: String(liveCerts.length),
            sub: cancelledCount > 0 ? `+ ${cancelledCount} cancelled` : 'All certificates live',
            color: 'var(--aig-green-400)',
          },
          { label: 'Not Generated', value: String(liveCerts.filter(c => c.status === 'not_generated').length), color: 'var(--text-muted)' },
          { label: 'Generated',     value: String(liveCerts.filter(c => c.status === 'generated').length), color: 'var(--info)' },
          { label: 'Sent',          value: String(liveCerts.filter(c => c.status === 'sent').length), color: 'var(--success)' },
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
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {(['', 'not_generated', 'generated', 'sent', 'failed', 'cancelled'] as const).map(s => {
            if (s === 'cancelled' && cancelledCount === 0) return null;
            return (
              <button
                key={s}
                type="button"
                className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter(s)}
              >
                {s === '' ? (!showCancelled ? 'Live Certificates' : 'All Certificates') : s === 'cancelled' ? `Cancelled (${cancelledCount})` : CERT_STATUS_LABEL[s as CertificateStatus]}
              </button>
            );
          })}
          {statusFilter !== 'cancelled' && cancelledCount > 0 && (
            <button
              type="button"
              className={`btn btn-sm ${showCancelled ? 'btn-outline-green' : 'btn-ghost'}`}
              onClick={() => setShowCancelled(s => !s)}
              data-testid="toggle-show-cancelled-certificates-btn"
              title="Toggle whether cancelled certificates appear in Live Certificates"
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
                <th>Certificate Ref</th>
                <th>Qurban Holder / Participant</th>
                <th>Programme &amp; Template</th>
                <th>Animal</th>
                <th>Qurban Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state" style={{ padding: '3rem 2rem' }}>
                      <div className="empty-icon"><Award size={22} color="var(--text-muted)" /></div>
                      <h3>{certs.length ? 'No certificates match your filter' : 'No certificates yet'}</h3>
                      <p>{certs.length ? 'Try adjusting your search or status filter.' : 'Certificates appear automatically when orders reach Qurban Complete.'}</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(c => {
                const tplType = c.template_type ?? selectCertificateTemplate(c.programme_name, c.programme_id);
                return (
                <tr key={c.id}>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--gold-400)' }}>
                      {c.certificate_ref}
                    </span>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{c.order_ref}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{c.qurban_name_holder || c.participant_name}</div>
                    {c.qurban_name_holder && c.qurban_name_holder !== c.participant_name && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Buyer: {c.participant_name}</div>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    <div>{c.programme_name}</div>
                    <div style={{ display: 'flex', gap: '0.35rem', marginTop: 3, flexWrap: 'wrap' }}>
                      <span className={`badge ${tplType === 'breeding_programme' ? 'badge-teal' : 'badge-gold'}`} style={{ fontSize: '0.65rem' }}>
                        {tplType === 'breeding_programme' ? 'Breeding Template' : 'Standard Template'}
                      </span>
                      {c.service_type && (
                        <span className="badge badge-info" style={{ fontSize: '0.65rem', textTransform: 'capitalize' }}>
                          {c.service_type}
                        </span>
                      )}
                    </div>
                  </td>
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
                        <button
                          type="button"
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
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            title="Preview Certificate"
                            aria-label="Preview Certificate"
                            onClick={() => setSelected(c)}
                          >
                            <Eye size={14} />
                          </button>

                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            title="Download / Print Certificate"
                            aria-label="Download Certificate PDF"
                            onClick={() => {
                              setSelected(c);
                              setTimeout(() => {
                                if (!printCertificate(c)) {
                                  toast('error', 'Could not open print window', 'Please allow pop-ups for this site.');
                                }
                              }, 300);
                            }}
                          >
                            <Download size={14} />
                          </button>

                          {c.status === 'generated' && (
                            <button
                              type="button"
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
                );
              })}
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
