import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import type { Certificate, Order, Participant, Programme } from '@/lib/database.types';

export interface CertificateData {
  certificate: Certificate;
  order: Order;
  participant: Participant;
  programme: Programme;
}

export async function generateCertificatePdf(data: CertificateData): Promise<Blob> {
  const { certificate, participant, programme } = data;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // ── Background ──────────────────────────────────────────────
  doc.setFillColor(10, 61, 42); // AIG dark green
  doc.rect(0, 0, W, H, 'F');

  // Inner cream panel
  doc.setFillColor(253, 250, 244);
  doc.roundedRect(12, 12, W - 24, H - 24, 4, 4, 'F');

  // Gold border lines
  doc.setDrawColor(184, 145, 48);
  doc.setLineWidth(1.2);
  doc.roundedRect(16, 16, W - 32, H - 32, 3, 3, 'S');
  doc.setLineWidth(0.4);
  doc.roundedRect(18, 18, W - 36, H - 36, 2, 2, 'S');

  // ── Header ──────────────────────────────────────────────────
  doc.setTextColor(10, 61, 42);
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.text('AL IHSAN GROUP', W / 2, 36, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 90, 90);
  doc.text('QURBAN CERTIFICATE', W / 2, 44, { align: 'center' });

  // Decorative line
  doc.setDrawColor(184, 145, 48);
  doc.setLineWidth(0.6);
  doc.line(W / 2 - 60, 48, W / 2 + 60, 48);

  // ── Body ────────────────────────────────────────────────────
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'normal');
  doc.text('This is to certify that', W / 2, 62, { align: 'center' });

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(10, 61, 42);
  const fullName = `${participant.first_name} ${participant.last_name}`;
  doc.text(fullName, W / 2, 76, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('has successfully performed Qurban through', W / 2, 88, { align: 'center' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(10, 61, 42);
  doc.text(programme.name, W / 2, 98, { align: 'center' });

  // ── Details grid ────────────────────────────────────────────
  const details = [
    ['Certificate No.', certificate.certificate_ref],
    ['Order Reference', data.order.order_ref],
    ['Animal Type', programme.animal_type.charAt(0).toUpperCase() + programme.animal_type.slice(1)],
    ['Qurban Date', certificate.qurban_date ?? 'N/A'],
    ['Country', programme.country],
  ];

  let y = 115;
  doc.setFontSize(9);
  details.forEach(([label, value], i) => {
    const x = i % 2 === 0 ? W / 2 - 90 : W / 2 + 10;
    if (i % 2 === 0 && i > 0) y += 12;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(90, 90, 90);
    doc.text(label + ':', x, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 20, 20);
    doc.text(value ?? 'N/A', x + 40, y);
  });

  // ── QR Code ─────────────────────────────────────────────────
  const verifyUrl = `${import.meta.env.VITE_APP_URL ?? 'https://alhisangroup.com'}/verify/${certificate.verification_code}`;
  try {
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 80,
      margin: 1,
      color: { dark: '#0a3d2a', light: '#fdfaf4' },
    });
    doc.addImage(qrDataUrl, 'PNG', W - 54, H - 58, 36, 36);
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('Scan to verify', W - 36, H - 18, { align: 'center' });
  } catch (_) {
    // QR generation failed — continue without it
  }

  // ── Footer ──────────────────────────────────────────────────
  doc.setDrawColor(184, 145, 48);
  doc.setLineWidth(0.4);
  doc.line(W / 2 - 80, H - 34, W / 2 + 80, H - 34);

  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.setFont('helvetica', 'normal');
  doc.text('Al Ihsan Group | Daredevil Digital Implementation', W / 2, H - 26, { align: 'center' });
  doc.text(`Verification: ${certificate.verification_code}`, W / 2, H - 20, { align: 'center' });

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
