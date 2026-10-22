import React from 'react';
import { Award } from 'lucide-react';
import type { CertificateStatus } from '@/lib/database.types';

// Shared Qurban certificate artwork. Used by BOTH the admin and participant portals
// so participants see exactly the same certificate format that admins issue.

export type Certificate = {
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
export function CertificateDesign({ cert }: { cert: Certificate }) {
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

/** Opens the rendered certificate (#certificate-print-area) in a print window so it can be printed / saved as PDF. */
export function printCertificate(cert: Pick<Certificate, 'participant_name'>): boolean {
  const el = document.getElementById('certificate-print-area');
  if (!el) return false;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Qurban Certificate - ${cert.participant_name}</title><link rel="preconnect" href="https://fonts.googleapis.com"/><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#0a0a0a;}@page{size:A4 landscape;margin:0;}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style></head><body>${el.outerHTML}<script>window.onload=function(){window.print();window.close();}</script></body></html>`;
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}