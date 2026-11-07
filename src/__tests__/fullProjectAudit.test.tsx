import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AppDataProvider, useAppData } from '@/contexts/AppDataContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { CertificateDesign, type Certificate } from '@/components/ui/CertificateDesign';
import { computePageSeoMeta, SITE_URL } from '@/hooks/usePageTitle';

// Pages — Auth, Admin (12), Portal (4)
import { LoginPage } from '@/pages/auth/LoginPage';
import { DashboardPage } from '@/pages/admin/DashboardPage';
import { OrdersPage } from '@/pages/admin/OrdersPage';
import { PaymentsPage } from '@/pages/admin/PaymentsPage';
import { AnimalsPage } from '@/pages/admin/AnimalsPage';
import { SuppliersPage } from '@/pages/admin/SuppliersPage';
import { DeliveriesPage } from '@/pages/admin/DeliveriesPage';
import { CertificatesPage } from '@/pages/admin/CertificatesPage';
import { ParticipantsPage } from '@/pages/admin/ParticipantsPage';
import { ProgrammesPage } from '@/pages/admin/ProgrammesPage';
import { ExceptionsPage } from '@/pages/admin/ExceptionsPage';
import { AuditLogPage } from '@/pages/admin/AuditLogPage';
import { SettingsPage } from '@/pages/admin/SettingsPage';
import { PortalDashboardPage } from '@/pages/portal/PortalDashboardPage';
import { PortalOrdersPage } from '@/pages/portal/PortalOrdersPage';
import { PortalCertificatesPage } from '@/pages/portal/PortalCertificatesPage';
import { PortalNotificationsPage } from '@/pages/portal/PortalNotificationsPage';

const ROOT_DIR = path.resolve(__dirname, '../..');

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

type CapturedContext = ReturnType<typeof useAppData>;

function mountStore() {
  let latest: CapturedContext | null = null;

  function Reader() {
    latest = useAppData();
    return null;
  }

  const read = (): CapturedContext => {
    renderToStaticMarkup(
      <AuthProvider>
        <ToastProvider>
          <AppDataProvider>
            <Reader />
          </AppDataProvider>
        </ToastProvider>
      </AuthProvider>,
    );
    if (!latest) throw new Error('Could not capture AppDataContext');
    return latest;
  };

  read();

  const renderAt = (initialEntry: string, element: React.ReactElement): string =>
    renderToStaticMarkup(
      <MemoryRouter initialEntries={[initialEntry]}>
        <AuthProvider>
          <ToastProvider>
            <AppDataProvider>{element}</AppDataProvider>
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

  return { getState: read, renderAt };
}

describe('AIGMS Full Project Audit — Functional Completeness, Mobile Responsiveness & SEO', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: new MemoryStorage(),
      configurable: true,
      writable: true,
    });
  });

  it('renders LoginPage (admin & participant modes), AppLayout (Sidebar + Topbar), all 12 Admin pages, all 4 Portal pages, and CertificateDesign without errors', () => {
    const { renderAt } = mountStore();

    // Public Auth routes
    const staffLoginHtml = renderAt('/login', <LoginPage />);
    expect(staffLoginHtml).toContain('Al Ihsan Group');
    expect(staffLoginHtml).toContain('Forgot password?');
    expect(staffLoginHtml).toContain('Access the portal');

    const participantLoginHtml = renderAt('/login?mode=participant', <LoginPage />);
    expect(participantLoginHtml).toContain('Participant Sign In');
    expect(participantLoginHtml).toContain('Access My Portal');

    // AppLayout with Sidebar, Topbar, skip-link & main landmark
    const layoutHtml = renderAt(
      '/admin',
      <Routes>
        <Route path="/admin" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
        </Route>
      </Routes>,
    );
    expect(layoutHtml).toContain('Skip to main content');
    expect(layoutHtml).toContain('id="main-content"');
    expect(layoutHtml).toContain('id="mobile-menu-btn"');
    expect(layoutHtml).toContain('id="topbar-search"');
    expect(layoutHtml).toContain('id="notifications-btn"');

    // All 12 Admin pages
    const adminPages: [string, React.ReactElement, string][] = [
      ['/admin', <DashboardPage />, 'Dashboard'],
      ['/admin/orders', <OrdersPage />, 'Orders'],
      ['/admin/payments', <PaymentsPage />, 'Payments'],
      ['/admin/animals', <AnimalsPage />, 'Animals'],
      ['/admin/suppliers', <SuppliersPage />, 'Suppliers'],
      ['/admin/deliveries', <DeliveriesPage />, 'Deliveries'],
      ['/admin/certificates', <CertificatesPage />, 'Certificates'],
      ['/admin/participants', <ParticipantsPage />, 'Participants'],
      ['/admin/programmes', <ProgrammesPage />, 'Programmes'],
      ['/admin/exceptions', <ExceptionsPage />, 'Exceptions'],
      ['/admin/audit', <AuditLogPage />, 'Audit Log'],
      ['/admin/settings', <SettingsPage />, 'Settings'],
    ];

    for (const [route, element, expectedHeading] of adminPages) {
      const html = renderAt(route, element);
      expect(html).toContain(expectedHeading);
    }

    // All 4 Participant Portal pages
    const portalPages: [string, React.ReactElement, string][] = [
      ['/portal', <PortalDashboardPage />, 'My Orders'],
      ['/portal/orders', <PortalOrdersPage />, 'My Orders'],
      ['/portal/certificates', <PortalCertificatesPage />, 'My Certificates'],
      ['/portal/notifications', <PortalNotificationsPage />, 'Notifications'],
    ];

    for (const [route, element, expectedHeading] of portalPages) {
      const html = renderAt(route, element);
      expect(html).toContain(expectedHeading);
    }

    // Shared CertificateDesign artwork
    const sampleCert: Certificate = {
      id: 'cert-test-1',
      certificate_ref: 'CERT-2026-0001',
      order_ref: 'ORD-20001',
      participant_name: 'Haji Ismail bin Yusof',
      programme_name: 'Australia to Singapore - Lamb',
      country: 'Australia',
      animal_ref: 'ANM-20001-01',
      animal_type: 'lamb',
      animal_label: 'Lamb',
      qurban_date: '2026-05-27',
      status: 'generated',
      generated_at: '2026-05-28T08:00:00Z',
      sent_at: null,
      verification_code: 'AIGCERT-TEST-0001',
      year: '2026/1447H',
    };
    const certHtml = renderToStaticMarkup(<CertificateDesign cert={sampleCert} />);
    expect(certHtml).toContain('id="certificate-print-area"');
    expect(certHtml).toContain('Haji Ismail bin Yusof');
    expect(certHtml).toContain('AIGCERT-TEST-0001');
  });

  it('completes full operational lifecycle (Order → Payment → Animals → Delivery → Certificate → Exception → Audit Log) cleanly', () => {
    const { getState, renderAt } = mountStore();
    const auSgProg = getState().programmes.find(p => p.name === 'Australia to Singapore - Lamb');
    expect(auSgProg).toBeDefined();

    // 1. Create Order with 2 Qurbans & per-Qurban portions
    const order = getState().addOrder({
      order_ref: 'ORD-50001',
      full_name: 'Zainab binte Omar',
      email: 'zainab@example.sg',
      contact_number: '+65 9876 5432',
      programme: auSgProg!.name,
      programme_id: auSgProg!.id,
      programme_country: auSgProg!.country,
      service_type: 'qurban',
      payment_method: 'paynow',
      delivery_portion: 'full',
      quantity: 2,
      total_amount: auSgProg!.price_per_share * 2,
      currency: 'SGD',
      status: 'payment_submitted',
      qurban_entries: [
        { qurban_name_holder: 'Zainab binte Omar', delivery_portion: 'full' },
        { qurban_name_holder: 'Omar bin Hassan', delivery_portion: 'one_third' },
      ],
    });
    expect(order.order_ref).toBe('ORD-50001');

    // 2. Verify Payment
    const payment = getState().payments.find(p => p.order_ref === 'ORD-50001');
    expect(payment).toBeDefined();
    getState().verifyPayment(payment!.id);
    expect(getState().payments.find(p => p.id === payment!.id)?.status).toBe('verified');

    // 3. Progress Order through Qurban Complete & Delivery Scheduled
    getState().updateOrderStatus(order.id, 'animal_allocated');
    getState().updateOrderStatus(order.id, 'qurban_complete');
    getState().updateOrderStatus(order.id, 'delivery_scheduled');

    const delivery = getState().deliveries.find(d => d.order_ref === 'ORD-50001');
    expect(delivery).toBeDefined();

    // 4. Simulate failed delivery raising an exception, verify Sidebar live exception badge, then resolve
    getState().updateDeliveryStatus(delivery!.id, 'failed');
    const raisedEx = getState().exceptions.find(e => e.status === 'open');
    expect(raisedEx).toBeDefined();

    const layoutWithEx = renderAt(
      '/admin',
      <Routes>
        <Route path="/admin" element={<AppLayout />}>
          <Route index element={<ExceptionsPage />} />
        </Route>
      </Routes>,
    );
    expect(layoutWithEx).toContain('nav-badge');

    getState().assignException(raisedEx!.id, 'Operations Admin');
    getState().resolveException(raisedEx!.id, 'Rescheduled with recipient');
    expect(getState().exceptions.find(e => e.id === raisedEx!.id)?.status).toBe('resolved');

    // 5. Reschedule & complete delivery
    getState().updateDelivery(delivery!.id, {
      scheduled_date: '2026-05-29',
      delivery_slot: '10am – 1pm',
      driver: 'Ridzuan',
      address: '12 Tampines Ave 4, Singapore',
    });
    getState().updateDeliveryStatus(delivery!.id, 'delivered');
    expect(getState().deliveries.find(d => d.id === delivery!.id)?.status).toBe('delivered');

    // 6. Generate & send certificate
    const cert = getState().certificates.find(c => c.order_ref === 'ORD-50001');
    expect(cert).toBeDefined();
    getState().updateCertStatus(cert!.id, 'generated');
    getState().updateCertStatus(cert!.id, 'sent');
    expect(getState().certificates.find(c => c.id === cert!.id)?.status).toBe('sent');

    // 7. Register supplier
    getState().addSupplier({
      id: 'sup-audit-1',
      supplier_ref: 'SUP-001',
      name: 'Barakah Livestock Australia',
      contact_name: 'Yusuf Ali',
      email: 'yusuf@barakah.au',
      phone: '+61 400 123 456',
      country: 'Australia',
      region: 'Victoria',
      animal_types: ['lamb', 'sheep', 'cow'],
      is_active: true,
      animals_count: 0,
    });
    expect(getState().suppliers.some(s => s.name === 'Barakah Livestock Australia')).toBe(true);

    // 8. Verify AuditLogPage displays accurate total entries count (not 0!)
    const totalAuditEntries = getState().auditLogs.length;
    expect(totalAuditEntries).toBeGreaterThan(0);
    const auditHtml = renderAt('/admin/audit', <AuditLogPage />);
    expect(auditHtml).toContain(`Showing ${totalAuditEntries} of ${totalAuditEntries} entries`);
  });

  it('validates SEO friendliness, structured data, canonical domain (https://www.aigsuite.com), robots.txt, sitemap.xml, webmanifest, and dynamic route meta', () => {
    const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');

    // Must point to live production domain https://www.aigsuite.com, never stale vercel domain or global noindex
    expect(indexHtml).toContain('href="https://www.aigsuite.com/"');
    expect(indexHtml).toContain('content="https://www.aigsuite.com/"');
    expect(indexHtml).toContain('content="https://www.aigsuite.com/logo.jpg"');
    expect(indexHtml).not.toContain('aigms.vercel.app');
    expect(indexHtml).toContain('name="robots" content="index, follow');
    expect(indexHtml).toContain('rel="manifest" href="/site.webmanifest"');
    expect(indexHtml).toContain('name="viewport" content="width=device-width, initial-scale=1.0');

    // Extract & parse JSON-LD structured data
    const jsonLdMatch = indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(jsonLdMatch).not.toBeNull();
    const parsedLd = JSON.parse(jsonLdMatch![1]);
    expect(parsedLd['@context']).toBe('https://schema.org');
    expect(Array.isArray(parsedLd['@graph'])).toBe(true);
    const types = parsedLd['@graph'].map((node: { '@type': string }) => node['@type']);
    expect(types).toContain('Organization');
    expect(types).toContain('WebSite');
    expect(types).toContain('WebApplication');

    // robots.txt
    const robotsTxt = fs.readFileSync(path.join(ROOT_DIR, 'public/robots.txt'), 'utf8');
    expect(robotsTxt).toContain('Allow: /login');
    expect(robotsTxt).toContain('Disallow: /admin/');
    expect(robotsTxt).toContain('Disallow: /portal/');
    expect(robotsTxt).toContain('Sitemap: https://www.aigsuite.com/sitemap.xml');

    // sitemap.xml
    const sitemapXml = fs.readFileSync(path.join(ROOT_DIR, 'public/sitemap.xml'), 'utf8');
    expect(sitemapXml).toContain('<loc>https://www.aigsuite.com/</loc>');
    expect(sitemapXml).toContain('<loc>https://www.aigsuite.com/login</loc>');

    // site.webmanifest
    const manifestRaw = fs.readFileSync(path.join(ROOT_DIR, 'public/site.webmanifest'), 'utf8');
    const manifest = JSON.parse(manifestRaw);
    expect(manifest.short_name).toBe('AIGMS');
    expect(manifest.start_url).toBe('/login');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons[0].src).toBe('/logo.jpg');

    // vercel.json
    const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'vercel.json'), 'utf8'));
    expect(vercelConfig.rewrites[0].source).toContain('robots\\.txt');
    expect(vercelConfig.rewrites[0].source).toContain('sitemap\\.xml');
    expect(vercelConfig.headers.length).toBeGreaterThan(0);

    // Dynamic per-route SEO policy
    const publicLoginMeta = computePageSeoMeta('/login', 'Sign In');
    expect(publicLoginMeta.canonicalUrl).toBe(`${SITE_URL}/login`);
    expect(publicLoginMeta.robots).toContain('index, follow');

    const privateAdminMeta = computePageSeoMeta('/admin/orders', 'Orders');
    expect(privateAdminMeta.canonicalUrl).toBe(`${SITE_URL}/admin/orders`);
    expect(privateAdminMeta.robots).toBe('noindex, nofollow');

    const privatePortalMeta = computePageSeoMeta('/portal/certificates', 'My Certificates');
    expect(privatePortalMeta.canonicalUrl).toBe(`${SITE_URL}/portal/certificates`);
    expect(privatePortalMeta.robots).toBe('noindex, nofollow');
  });

  it('enforces mobile responsiveness CSS breakpoints, overflow guards, and responsive card grids across all pages', () => {
    const css = fs.readFileSync(path.join(ROOT_DIR, 'src/index.css'), 'utf8');

    // Breakpoints & mobile navigation drawer rules
    expect(css).toContain('overflow-x: hidden');
    expect(css).toContain('@media (max-width: 1024px)');
    expect(css).toContain('@media (max-width: 768px)');
    expect(css).toContain('@media (max-width: 480px)');
    expect(css).toContain('.sidebar.mobile-open');
    expect(css).toContain('.hamburger-btn');
    expect(css).toContain('.main-layout.sidebar-collapsed .main-content');
    expect(css).toContain('.card-grid-responsive');
    expect(css).toContain('.portion-btn-group');
    expect(css).toContain('.status-picker-grid');
    expect(css).toContain('.filter-bar .form-select');

    // Ensure no page uses rigid minmax(320px/340px, 1fr) without min(100%, ...) which would overflow 320px mobile viewports
    const pageDirs = [
      path.join(ROOT_DIR, 'src/pages/admin'),
      path.join(ROOT_DIR, 'src/pages/portal'),
      path.join(ROOT_DIR, 'src/pages/auth'),
    ];
    for (const dir of pageDirs) {
      for (const file of fs.readdirSync(dir)) {
        if (!file.endsWith('.tsx')) continue;
        const src = fs.readFileSync(path.join(dir, file), 'utf8');
        expect(src, `${file} has rigid minmax(340px)`).not.toContain('minmax(340px, 1fr)');
        expect(src, `${file} has rigid minmax(320px)`).not.toContain('minmax(320px, 1fr)');
      }
    }
  });
});
