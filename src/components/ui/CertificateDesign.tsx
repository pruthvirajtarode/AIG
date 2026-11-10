import React from 'react';
import type { CertificateStatus } from '@/lib/database.types';
import { selectCertificateTemplate, type CertificateTemplateType } from '@/lib/orderRules';
import { ANIMAL_IMAGES } from '@/lib/animalImages';

// Shared Qurban / Aqiqah certificate artwork. Used by BOTH the admin and participant portals
// so participants see the exact client-supplied certificate template:
// - 'breeding_programme' (cert-sample-1.png): Indonesia Breeding Programme ONLY (framed animal photo inset)
// - 'standard' (cert-sample-2.png): All other 11 programmes including Indonesia - Goat (XL) (gold rosette seal + bottom star border)

export type Certificate = {
  id: string;
  certificate_ref: string;
  order_ref: string;
  participant_name: string;
  qurban_name_holder?: string;
  programme_name: string;
  programme_id?: string;
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
  template_type?: CertificateTemplateType;
  service_type?: 'qurban' | 'aqiqah' | 'nazar';
  animal_photo_url?: string | null;
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

// ── Gold Rosette Ribbon Seal SVG (cert-sample-2.png) ───────────
function GoldRosetteSeal() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }} data-testid="certificate-gold-rosette-seal">
      <svg
        viewBox="0 0 80 100"
        style={{ width: 'clamp(32px, 6.2vw, 64px)', height: 'clamp(40px, 7.6vw, 78px)', display: 'block' }}
      >
        <defs>
          <radialGradient id="goldRosetteGrad" cx="50%" cy="42%" r="55%">
            <stop offset="0%" stopColor="#fff2b2" />
            <stop offset="45%" stopColor="#d4a832" />
            <stop offset="85%" stopColor="#926c15" />
            <stop offset="100%" stopColor="#65490b" />
          </radialGradient>
        </defs>
        {/* Twin flowing ribbons */}
        <path d="M28,56 L18,95 L29,87 L36,96 L38,58 Z" fill="#b8891e" stroke="#65490b" strokeWidth="0.8" />
        <path d="M52,56 L62,95 L51,87 L44,96 L42,58 Z" fill="#d4a832" stroke="#65490b" strokeWidth="0.8" />
        {/* Serrated outer gold rosette */}
        <circle cx="40" cy="38" r="28" fill="url(#goldRosetteGrad)" stroke="#ffea9f" strokeWidth="1.2" strokeDasharray="3.5 1.8" />
        <circle cx="40" cy="38" r="22" fill="none" stroke="#65490b" strokeWidth="1" strokeDasharray="2 2" />
        <circle cx="40" cy="38" r="18" fill="url(#goldRosetteGrad)" stroke="#fff2b2" strokeWidth="0.9" />
      </svg>
    </div>
  );
}

// ── Ustaz Signature Block (both templates) ─────────────────────
function UstazSignatureBlock() {
  return (
    <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 'clamp(80px, 15vw, 155px)' }}>
      <svg
        viewBox="0 0 180 55"
        style={{ width: 'clamp(64px, 12vw, 130px)', height: 'clamp(22px, 4vw, 42px)', display: 'block', margin: '0 auto 2px' }}
      >
        <path
          d="M25,40 C38,12 52,10 48,32 C45,45 64,16 76,26 C86,34 96,14 110,28 C120,38 138,15 156,22 C135,34 85,38 18,44"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.92"
        />
      </svg>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.75)', width: '100%', marginBottom: 4 }} />
      <div style={{ fontSize: 'clamp(6px, 0.82vw, 10.5px)', color: '#ffffff', fontWeight: 700, letterSpacing: '0.05em' }}>
        UST KHIDR MUHAMMAD
      </div>
    </div>
  );
}

// ── Al Ihsan Logo ──────────────────────────────────────────────
function LogoText() {
  return (
    <div style={{ textAlign: 'center', flexShrink: 0 }}>
      <img
        src="/logo.jpg"
        alt="Al Ihsan Group"
        style={{
          width: 'clamp(34px, 7.5vw, 76px)',
          height: 'clamp(34px, 7.5vw, 76px)',
          objectFit: 'cover',
          borderRadius: 'clamp(6px, 1.2vw, 12px)',
          display: 'block',
          margin: '0 auto',
        }}
      />
    </div>
  );
}

export function formatCertificateSerialNo(certificateRef: string, year = '2026'): string {
  const shortYear = year.slice(-2) || '26';
  const digits = certificateRef.replace(/\D/g, '').slice(-4).padStart(4, '0');
  if (certificateRef.startsWith('AIG-')) return certificateRef;
  if (certificateRef.startsWith('CERT-')) {
    return `AIG-Q${shortYear}Y-${digits}`;
  }
  return certificateRef.replace('CERT-', 'AIG-Q');
}

// ── Certificate Design ─────────────────────────────────────────
export function CertificateDesign({ cert }: { cert: Certificate }) {
  const templateType: CertificateTemplateType =
    cert.template_type ?? selectCertificateTemplate(cert.programme_name, cert.programme_id);
  const isBreedingTemplate = templateType === 'breeding_programme';
  const isAqiqah = cert.service_type === 'aqiqah';
  const holderName = (cert.qurban_name_holder || cert.participant_name || '').trim() || cert.participant_name;
  const serialNo = formatCertificateSerialNo(cert.certificate_ref, cert.year);
  const animalPhotoUrl =
    cert.animal_photo_url ||
    ANIMAL_IMAGES[cert.animal_type?.toLowerCase?.() ?? 'goat'] ||
    ANIMAL_IMAGES.goat;

  return (
    <div
      id="certificate-print-area"
      data-template-type={templateType}
      data-service-type={cert.service_type ?? 'qurban'}
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

      {/* ── Bottom border: Ornate 8-point star geometric lattice on Standard template (cert-sample-2.png) ── */}
      {!isBreedingTemplate && (
        <svg
          viewBox="0 0 900 36"
          data-testid="certificate-standard-bottom-border"
          style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', pointerEvents: 'none', zIndex: 1 }}
          preserveAspectRatio="none"
        >
          <rect x="0" y="0" width="900" height="36" fill="rgba(180,140,30,0.14)" />
          <line x1="0" y1="2" x2="900" y2="2" stroke="#d4a832" strokeWidth="1.6" opacity="0.8" />
          <line x1="0" y1="6" x2="900" y2="6" stroke="#d4a832" strokeWidth="0.6" opacity="0.5" />
          {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21].map(i => (
            <g key={i}>
              <rect x={i*42+8} y={11} width="18" height="18" fill="none" stroke="#d4a832" strokeWidth="0.8" opacity="0.65" />
              <rect x={i*42+8} y={11} width="18" height="18" fill="none" stroke="#d4a832" strokeWidth="0.8" opacity="0.65" transform={`rotate(45,${i*42+17},20)`} />
            </g>
          ))}
        </svg>
      )}

      {/* ── Certificate body (fluid responsive scaling for phones → A4 print) ── */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          textAlign: 'center',
          width: '100%',
          padding: 'clamp(16px, 8.5%, 80px) clamp(12px, 5.5%, 54px) clamp(10px, 3%, 26px)',
          boxSizing: 'border-box',
        }}
      >

        {/* QURBAN / AQIQAH CERTIFICATE heading */}
        <div style={{
          fontFamily: "'Cormorant Garamond', 'Georgia', serif",
          fontSize: 'clamp(14px, 3.8vw, 42px)',
          fontWeight: 700,
          color: '#ffffff',
          letterSpacing: '0.12em',
          lineHeight: 1.1,
          textTransform: 'uppercase',
          textShadow: '0 2px 8px rgba(0,0,0,0.5)',
          marginBottom: '0.35em',
        }}>
          {isAqiqah ? 'AQIQAH' : 'QURBAN'}<br />CERTIFICATE
        </div>

        {/* Description */}
        <div style={{
          fontSize: 'clamp(7px, 1.1vw, 13px)',
          color: 'rgba(255,255,255,0.85)',
          maxWidth: 500,
          margin: '0 auto 0.55em',
          lineHeight: 1.5,
          fontWeight: 400,
        }}>
          This is to certify that Al Ihsan Group SG has faithfully fulfilled the amanah<br />
          entrusted to them in performing the {isAqiqah ? 'Aqiqah' : 'Qurban'} ritual for
        </div>

        {/* Qurban Name Holder / Participant name — gold cursive */}
        <div style={{
          fontFamily: "'Cormorant Garamond', 'Georgia', serif",
          fontSize: 'clamp(16px, 4.4vw, 52px)',
          fontWeight: 600,
          fontStyle: 'italic',
          color: '#d4a832',
          textShadow: '0 2px 12px rgba(212,168,50,0.3)',
          margin: '0.06em 0 0.22em',
          lineHeight: 1.2,
          letterSpacing: '-0.01em',
        }}>
          {holderName}
        </div>

        {/* Details row */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 'clamp(8px, 2.8vw, 40px)',
          fontSize: 'clamp(7px, 1.1vw, 13px)',
          fontWeight: 700,
          color: '#ffffff',
          letterSpacing: '0.08em',
          marginBottom: '0.4em',
          flexWrap: 'wrap',
        }}>
          <span>LOCATION : {cert.country.toUpperCase()}</span>
          <span>LIVESTOCK : {cert.animal_label.toUpperCase()}</span>
          <span>YEAR : {cert.year}</span>
        </div>

        {/* Du'a */}
        <div style={{
          fontSize: 'clamp(6.5px, 0.95vw, 12px)',
          color: 'rgba(255,255,255,0.75)',
          marginBottom: '0.75em',
          fontStyle: 'italic',
          lineHeight: 1.55,
        }}>
          May Allah swt accept this Ibadah and reward us the best in this life and hereafter.<br />
          Ameen ya Rabb
        </div>

        {/* ── Footer Layout: Template-Specific ── */}
        {isBreedingTemplate ? (
          /* Template 1 (cert-sample-1.png): Indonesia Breeding Programme ONLY
             Left: Framed Animal Photo + Serial No | Center: Al Ihsan Logo | Right: Ustaz Signature */
          <div
            data-testid="certificate-breeding-footer"
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              maxWidth: 740,
              margin: '0 auto',
              padding: '0 6px',
              gap: '10px',
            }}
          >
            {/* Framed Animal Photo Inset + Serial No */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'clamp(8px, 1.6vw, 18px)', textAlign: 'left' }}>
              <div
                data-testid="certificate-breeding-photo-inset"
                style={{
                  width: 'clamp(58px, 12vw, 135px)',
                  height: 'clamp(44px, 9vw, 100px)',
                  border: '2px solid #d4a832',
                  borderRadius: 4,
                  overflow: 'hidden',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.65)',
                  background: '#1a1a1a',
                  flexShrink: 0,
                }}
              >
                <img
                  src={animalPhotoUrl}
                  alt={`${cert.animal_label} — ${holderName}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>
              <div style={{ paddingBottom: 2 }}>
                <div style={{ fontSize: 'clamp(6px, 0.85vw, 11px)', color: '#ffffff', fontWeight: 700, letterSpacing: '0.06em' }}>
                  SERIAL NO:
                </div>
                <div style={{ fontSize: 'clamp(7px, 1vw, 12.5px)', fontWeight: 700, color: '#d4a832', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
                  {serialNo}
                </div>
              </div>
            </div>

            {/* Center Logo */}
            <LogoText />

            {/* Right Signature */}
            <UstazSignatureBlock />
          </div>
        ) : (
          /* Template 2 (cert-sample-2.png): Standard Programme (All other 11 programmes incl. Indonesia Goat XL)
             4-column bottom row: Serial No | Al Ihsan Logo | Gold Rosette Ribbon Seal | Ustaz Signature */
          <div
            data-testid="certificate-standard-footer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              maxWidth: 700,
              margin: '0 auto',
              padding: '0 6px',
              gap: '10px',
            }}
          >
            {/* Serial No */}
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 'clamp(6px, 0.85vw, 11px)', color: '#ffffff', fontWeight: 700, letterSpacing: '0.06em' }}>
                SERIAL NO:
              </div>
              <div style={{ fontSize: 'clamp(7px, 1vw, 13px)', fontWeight: 700, color: '#d4a832', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                {serialNo}
              </div>
            </div>

            {/* Al Ihsan Logo */}
            <LogoText />

            {/* Gold Rosette Ribbon Seal */}
            <GoldRosetteSeal />

            {/* Ustaz Signature */}
            <UstazSignatureBlock />
          </div>
        )}

        {/* Verification code */}
        <div style={{
          marginTop: '0.35em',
          fontSize: 'clamp(5.5px, 0.75vw, 9.5px)',
          color: 'rgba(255,255,255,0.4)',
          fontFamily: 'monospace',
          letterSpacing: '0.08em',
        }}>
          VERIFICATION: {cert.verification_code} · {cert.certificate_ref} · {cert.animal_ref}
        </div>
      </div>
    </div>
  );
}

/** Opens the rendered certificate (#certificate-print-area) in a print window so it can be printed / saved as PDF. */
export function printCertificate(cert: Pick<Certificate, 'participant_name' | 'qurban_name_holder'>): boolean {
  const el = document.getElementById('certificate-print-area');
  if (!el) return false;
  const displayHolder = cert.qurban_name_holder || cert.participant_name;
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>Certificate - ${displayHolder}</title><link rel="preconnect" href="https://fonts.googleapis.com"/><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#0a0a0a;}#certificate-print-area{width:297mm!important;height:210mm!important;}@page{size:A4 landscape;margin:0;}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style></head><body>${el.outerHTML}<script>window.onload=function(){window.print();window.close();}</script></body></html>`;
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
