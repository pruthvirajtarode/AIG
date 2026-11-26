import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppDataProvider } from '@/contexts/AppDataContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { PortalDashboardPage } from '@/pages/portal/PortalDashboardPage';
import { PortalOrdersPage } from '@/pages/portal/PortalOrdersPage';
import { PortalCertificatesPage } from '@/pages/portal/PortalCertificatesPage';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number { return this.map.size; }
  clear(): void { this.map.clear(); }
  getItem(key: string): string | null { return this.map.has(key) ? this.map.get(key)! : null; }
  key(index: number): string | null { return Array.from(this.map.keys())[index] ?? null; }
  removeItem(key: string): void { this.map.delete(key); }
  setItem(key: string, value: string): void { this.map.set(key, String(value)); }
}

const TEST_DATA = {
  orders: [
    {
      id: 'ord-10009-id',
      order_ref: 'ORD-10009',
      participant: 'MHN',
      email: 'mhn@example.com',
      contact_number: '+65 8824 0612',
      programme: 'Australia to Singapore - Lamb',
      quantity: 1,
      total_amount: 650,
      currency: 'SGD',
      status: 'confirmed',
      created_at: '2026-11-26T10:00:00Z',
    },
    {
      id: 'ord-10001-id',
      order_ref: 'ORD-10001',
      participant: 'Haji Ahmad bin Ibrahim',
      email: 'ahmad@example.com',
      contact_number: '+65 9123 4567',
      programme: 'Australia to Singapore - Lamb',
      quantity: 1,
      total_amount: 650,
      currency: 'SGD',
      status: 'completed',
      created_at: '2026-11-20T10:00:00Z',
    },
  ],
  animals: [
    {
      id: 'anm-1',
      animal_ref: 'ANM-10009-01',
      animal_code: 'ANM-10009-01',
      order_ref: 'ORD-10009',
      animal_type: 'lamb',
      status: 'allocated',
      approx_weight: '45-50 kg',
      current_weight_kg: 48,
    },
  ],
  certificates: [
    {
      id: 'cert-1',
      certificate_ref: 'CERT-2026-0001',
      order_ref: 'ORD-10001',
      participant_name: 'Haji Ahmad bin Ibrahim',
      programme_name: 'Australia to Singapore - Lamb',
      status: 'generated',
      verification_code: 'VERIFY-10001',
    },
  ],
  participants: [
    {
      id: 'part-1',
      first_name: 'MHN',
      last_name: '',
      email: 'mhn@example.com',
      phone: '+6588240612',
      participant_ref: 'PRT-10009',
    },
  ],
  payments: [],
  programmes: [],
  suppliers: [],
  deliveries: [],
  exceptions: [],
  auditLogs: [],
};

function renderPortalAt(path: string, element: React.ReactElement) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <ToastProvider>
          <AppDataProvider>
            <Routes>
              <Route path="/portal" element={element} />
              <Route path="/portal/orders" element={element} />
              <Route path="/portal/certificates" element={element} />
            </Routes>
          </AppDataProvider>
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Participant Portal Direct Tracking & Order Deep-Linking', () => {
  beforeEach(() => {
    const storage = new MemoryStorage();
    storage.setItem('aigms-data-v2', JSON.stringify(TEST_DATA));
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      configurable: true,
      writable: true,
    });
  });

  it('renders participant portal for queried order ORD-10009 for MHN', () => {
    const html = renderPortalAt('/portal?order=ORD-10009', <PortalDashboardPage />);
    expect(html).toContain('MHN');
    expect(html).toContain('ORD-10009');
    expect(html).toContain('My Orders');
    expect(html).toContain('Certificates');
  });

  it('supports orders page deep-link with ?order=ORD-10009', () => {
    const html = renderPortalAt('/portal/orders?order=ORD-10009', <PortalOrdersPage />);
    expect(html).toContain('ORD-10009');
    expect(html).toContain('Australia to Singapore - Lamb');
  });

  it('supports certificates page deep-link with ?order=ORD-10001', () => {
    const html = renderPortalAt('/portal/certificates?order=ORD-10001', <PortalCertificatesPage />);
    expect(html).toContain('My Certificates');
    expect(html).toContain('CERT-2026-0001');
  });
});
