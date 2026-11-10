import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import type { Certificate, Order, Participant, Programme } from '@/lib/database.types';
import { selectCertificateTemplate, type CertificateTemplateType } from '@/lib/orderRules';
import { formatCertificateSerialNo } from '@/components/ui/CertificateDesign';

export interface CertificateData {
  certificate: Certificate & {
    qurban_name_holder?: string;
    template_type?: CertificateTemplateType;
    service_type?: 'qurban' | 'aqiqah' | 'nazar';
    animal_ref?: string;
    animal_label?: string;
    year?: string;
  };
  order: Order;
  participant: Participant;
  programme: Programme & {
    supports_weight_timeline?: boolean;
  };
}

export function getCertificateVerificationUrl(verificationCode: string): string {
  const baseUrl = (import.meta.env.VITE_APP_URL ?? 'https://www.aigsuite.com').replace(/\/+$/, '');
  return `${baseUrl}/verify/${encodeURIComponent(verificationCode)}`;
}

export async function generateCertificatePdf(data: CertificateData): Promise<Blob> {
  const { certificate, participant, programme, order } = data;
  const templateType: CertificateTemplateType =
    certificate.template_type ??
    selectCertificateTemplate(programme.name, programme.id, programme.supports_weight_timeline);
  const isBreedingTemplate = templateType === 'breeding_programme';
  const serviceType = certificate.service_type ?? order.service_type ?? 'qurban';
  const isAqiqah = serviceType === 'aqiqah';
  const holderName =
    certificate.qurban_name_holder?.trim() ||
    `${participant.first_name} ${participant.last_name}`.trim();
  const yearStr = certificate.year || (programme.qurban_date ? programme.qurban_date.slice(0, 4) : '2026');
  const serialNo = formatCertificateSerialNo(certificate.certificate_ref, yearStr);
  const livestockLabel = (
    certificate.animal_label ||
    `${programme.animal_type.charAt(0).toUpperCase()}${programme.animal_type.slice(1)}`
  ).toUpperCase();

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const W = doc.internal.pageSize.getWidth(); // 297mm
  const H = doc.internal.pageSize.getHeight(); // 210mm

  // ── Dark Obsidian Background (#0a0a0a) ──────────────────────
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, W, H, 'F');

  // ── Top Gold Arch & Side Geometric Panels ───────────────────
  doc.setFillColor(35, 28, 10);
  doc.rect(0, 0, 62, 54, 'F');
  doc.rect(W - 62, 0, 62, 54, 'F');

  doc.setDrawColor(212, 168, 50); // #d4a832
  doc.setLineWidth(0.9);
  doc.line(0, 2, W, 2);
  doc.setLineWidth(0.35);
  doc.line(0, 4, W, 4);
  doc.rect(4, 6, 54, 44, 'S');
  doc.rect(W - 58, 6, 54, 44, 'S');

  // Arch line across top center
  doc.setLineWidth(1.1);
  doc.line(62, 2, W / 2, 34);
  doc.line(W / 2, 34, W - 62, 2);

  // ── Certificate Title (QURBAN / AQIQAH CERTIFICATE) ─────────
  doc.setTextColor(255, 255, 255);
  doc.setFont('times', 'bold');
  doc.setFontSize(28);
  doc.text(isAqiqah ? 'AQIQAH' : 'QURBAN', W / 2, 50, { align: 'center' });
  doc.text('CERTIFICATE', W / 2, 61, { align: 'center' });

  // ── Amanah Statement ────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(225, 225, 225);
  doc.text(
    'This is to certify that Al Ihsan Group SG has faithfully fulfilled the amanah',
    W / 2,
    74,
    { align: 'center' }
  );
  doc.text(
    `entrusted to them in performing the ${isAqiqah ? 'Aqiqah' : 'Qurban'} ritual for`,
    W / 2,
    80,
    { align: 'center' }
  );

  // ── Qurban Holder Name (Gold Italic) ────────────────────────
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(30);
  doc.setTextColor(212, 168, 50);
  doc.text(holderName, W / 2, 97, { align: 'center' });

  // ── Location / Livestock / Year Row ─────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(
    `LOCATION : ${programme.country.toUpperCase()}        LIVESTOCK : ${livestockLabel}        YEAR : ${yearStr}`,
    W / 2,
    112,
    { align: 'center' }
  );

  // ── Du'a ────────────────────────────────────────────────────
  doc.setFont('times', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(200, 200, 200);
  doc.text(
    'May Allah swt accept this Ibadah and reward us the best in this life and hereafter.',
    W / 2,
    124,
    { align: 'center' }
  );
  doc.text('Ameen ya Rabb', W / 2, 130, { align: 'center' });

  // ── Template-Specific Footer Layout ─────────────────────────
  if (isBreedingTemplate) {
    // Template 1 (cert-sample-1.png): Indonesia Breeding Programme ONLY
    // Left: Gold-framed animal photo inset + Serial No
    doc.setDrawColor(212, 168, 50);
    doc.setFillColor(24, 24, 24);
    doc.setLineWidth(0.8);
    doc.roundedRect(24, 142, 42, 32, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(212, 168, 50);
    doc.text('BREEDING LIVESTOCK', 45, 157, { align: 'center' });
    doc.setFontSize(6.5);
    doc.setTextColor(200, 200, 200);
    doc.text(certificate.animal_ref || order.order_ref, 45, 163, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('SERIAL NO:', 72, 164);
    doc.setTextColor(212, 168, 50);
    doc.text(serialNo, 72, 171);
  } else {
    // Template 2 (cert-sample-2.png): Standard Programme (All other 11 programmes)
    // Left: Serial No | Center-Right: Gold Rosette Seal | Bottom: Gold Star Geometric Lattice
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text('SERIAL NO:', 32, 160);
    doc.setTextColor(212, 168, 50);
    doc.text(serialNo, 32, 167);

    // Gold Rosette Seal
    doc.setFillColor(212, 168, 50);
    doc.setDrawColor(255, 238, 170);
    doc.setLineWidth(0.7);
    doc.circle(185, 158, 11, 'FD');
    doc.setDrawColor(101, 73, 11);
    doc.circle(185, 158, 8, 'S');

    // Bottom geometric gold band
    doc.setFillColor(35, 28, 10);
    doc.rect(0, H - 12, W, 12, 'F');
    doc.setDrawColor(212, 168, 50);
    doc.setLineWidth(0.6);
    doc.line(0, H - 12, W, H - 12);
  }

  // Center Logo Box
  doc.setDrawColor(212, 168, 50);
  doc.setLineWidth(0.6);
  doc.roundedRect(W / 2 - 16, 145, 32, 26, 2, 2, 'S');
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(212, 168, 50);
  doc.text('Al Ihsan', W / 2, 157, { align: 'center' });
  doc.setFontSize(8);
  doc.text('GROUP', W / 2, 163, { align: 'center' });

  // Right Ustaz Signature Block
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.4);
  doc.line(W - 86, 164, W - 34, 164);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('UST KHIDR MUHAMMAD', W - 60, 170, { align: 'center' });

  // ── QR Code & Verification Footer ───────────────────────────
  const verifyUrl = getCertificateVerificationUrl(certificate.verification_code);
  try {
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 72,
      margin: 1,
      color: { dark: '#0a0a0a', light: '#f6e3a1' },
    });
    doc.addImage(qrDataUrl, 'PNG', W - 28, 144, 20, 20);
  } catch (_) {
    // QR generation may be skipped in headless canvas-less test environments
  }

  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `VERIFICATION: ${certificate.verification_code} · ${certificate.certificate_ref} · Order: ${order.order_ref}`,
    W / 2,
    H - 16,
    { align: 'center' }
  );

  return doc.output('blob');
}

export function downloadPdf(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
