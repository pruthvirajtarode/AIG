import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AppDataProvider, useAppData } from '@/contexts/AppDataContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { CertificateDesign, formatCertificateSerialNo } from '@/components/ui/CertificateDesign';
import { usePageTitle } from '@/hooks/usePageTitle';

// ── Admin Pages (lazy loaded) ─────────────────────────────────
const DashboardPage     = lazy(() => import('@/pages/admin/DashboardPage').then(m => ({ default: m.DashboardPage })));
const OrdersPage        = lazy(() => import('@/pages/admin/OrdersPage').then(m => ({ default: m.OrdersPage })));
const PaymentsPage      = lazy(() => import('@/pages/admin/PaymentsPage').then(m => ({ default: m.PaymentsPage })));
const AnimalsPage       = lazy(() => import('@/pages/admin/AnimalsPage').then(m => ({ default: m.AnimalsPage })));
const SuppliersPage     = lazy(() => import('@/pages/admin/SuppliersPage').then(m => ({ default: m.SuppliersPage })));
const DeliveriesPage    = lazy(() => import('@/pages/admin/DeliveriesPage').then(m => ({ default: m.DeliveriesPage })));
const CertificatesPage  = lazy(() => import('@/pages/admin/CertificatesPage').then(m => ({ default: m.CertificatesPage })));
const ParticipantsPage  = lazy(() => import('@/pages/admin/ParticipantsPage').then(m => ({ default: m.ParticipantsPage })));
const ProgrammesPage    = lazy(() => import('@/pages/admin/ProgrammesPage').then(m => ({ default: m.ProgrammesPage })));
const ExceptionsPage    = lazy(() => import('@/pages/admin/ExceptionsPage').then(m => ({ default: m.ExceptionsPage })));
const AuditLogPage      = lazy(() => import('@/pages/admin/AuditLogPage').then(m => ({ default: m.AuditLogPage })));
const SettingsPage      = lazy(() => import('@/pages/admin/SettingsPage').then(m => ({ default: m.SettingsPage })));

// ── Participant Portal Pages (lazy loaded) ────────────────────
const PortalDashboardPage     = lazy(() => import('@/pages/portal/PortalDashboardPage').then(m => ({ default: m.PortalDashboardPage })));
const PortalOrdersPage        = lazy(() => import('@/pages/portal/PortalOrdersPage').then(m => ({ default: m.PortalOrdersPage })));
const PortalCertificatesPage  = lazy(() => import('@/pages/portal/PortalCertificatesPage').then(m => ({ default: m.PortalCertificatesPage })));
const PortalNotificationsPage = lazy(() => import('@/pages/portal/PortalNotificationsPage').then(m => ({ default: m.PortalNotificationsPage })));

// ── Idle-time prefetch: loads all page chunks in background ───
// This eliminates the spinner delay when switching between pages.
const prefetchAllPages = () => {
  const chunks = [
    () => import('@/pages/admin/OrdersPage'),
    () => import('@/pages/admin/PaymentsPage'),
    () => import('@/pages/admin/AnimalsPage'),
    () => import('@/pages/admin/SuppliersPage'),
    () => import('@/pages/admin/DeliveriesPage'),
    () => import('@/pages/admin/CertificatesPage'),
    () => import('@/pages/admin/ParticipantsPage'),
    () => import('@/pages/admin/ProgrammesPage'),
    () => import('@/pages/admin/ExceptionsPage'),
    () => import('@/pages/admin/AuditLogPage'),
    () => import('@/pages/admin/SettingsPage'),
    () => import('@/pages/portal/PortalDashboardPage'),
    () => import('@/pages/portal/PortalOrdersPage'),
    () => import('@/pages/portal/PortalCertificatesPage'),
    () => import('@/pages/portal/PortalNotificationsPage'),
  ];

  if ('requestIdleCallback' in window) {
    chunks.forEach((load, i) => {
      (window as Window & typeof globalThis & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback(() => { load().catch(() => {}); }, { timeout: 3000 + i * 500 });
    });
  } else {
    // Safari fallback
    chunks.forEach((load, i) => {
      setTimeout(() => { load().catch(() => {}); }, 1500 + i * 300);
    });
  }
};

// ── Branded Loading Screen ─────────────────────────────────────
function AuthLoader({ message = 'Loading…' }: { message?: string }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(160deg, #060a07 0%, #0d1a0f 50%, #050807 100%)',
      gap: '1.5rem',
    }}>
      {/* Logo */}
      <div style={{
        width: 80, height: 80,
        borderRadius: 18,
        overflow: 'hidden',
        border: '1px solid rgba(212,168,50,0.25)',
        boxShadow: '0 0 40px rgba(212,168,50,0.15)',
        flexShrink: 0,
      }}>
        <img
          src="/logo.jpg"
          alt="Al Ihsan Group"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>

      {/* Brand name */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: '1.25rem',
          fontWeight: 700,
          color: '#d4a832',
          letterSpacing: '0.01em',
          marginBottom: '0.25rem',
        }}>
          Al Ihsan Group
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.4)' }}>
          AIG Management System
        </div>
      </div>

      {/* Spinner */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: 36, height: 36,
          border: '3px solid rgba(212,168,50,0.15)',
          borderTop: '3px solid #d4a832',
          borderRadius: '50%',
          animation: 'spin 0.9s linear infinite',
        }} />
        <div style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.35)' }}>{message}</div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Route Guards ──────────────────────────────────────────────
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <AuthLoader message="Checking session…" />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

function RequireStaff({ children }: { children: React.ReactNode }) {
  const { isStaff, isLoading, isAuthenticated, profileFetchAttempted } = useAuth();

  // Still initialising
  if (isLoading) return <AuthLoader message="Verifying access…" />;

  // Authenticated but profile not yet fetched
  if (isAuthenticated && !profileFetchAttempted) return <AuthLoader message="Loading profile…" />;

  // Not a staff member — send to portal
  if (!isStaff()) return <Navigate to="/portal" replace />;

  return <>{children}</>;
}

function RequireParticipant({ children }: { children: React.ReactNode }) {
  const { isParticipant, isStaff, isLoading, isAuthenticated, profileFetchAttempted } = useAuth();

  if (isLoading) return <AuthLoader message="Loading…" />;
  if (isAuthenticated && !profileFetchAttempted) return <AuthLoader message="Loading profile…" />;

  // No usable role (profile missing) — go back to login instead of bouncing between /admin and /portal
  if (!isParticipant() && !isStaff()) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

// ── Page-level Lazy Load Fallback ─────────────────────────────
function PageLoader() {
  return (
    <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{
        width: 32, height: 32,
        border: '3px solid rgba(212,168,50,0.15)',
        borderTop: '3px solid #d4a832',
        borderRadius: '50%',
        animation: 'spin 0.9s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Public Certificate Verification Page (/verify/:code) ──────
export function CertificateVerifyPage() {
  usePageTitle(
    'Verify Certificate',
    'Verify authentic Al Ihsan Group Singapore Qurban and Aqiqah digital certificates online.',
  );
  const { code: routeCode } = useParams<{ code?: string }>();
  const { certificates } = useAppData();
  const [query, setQuery] = useState(routeCode ?? '');

  const normalizedQuery = (routeCode ?? query).trim().toUpperCase();
  const matched = normalizedQuery
    ? certificates.find(
        c =>
          c.verification_code.trim().toUpperCase() === normalizedQuery ||
          c.certificate_ref.trim().toUpperCase() === normalizedQuery ||
          formatCertificateSerialNo(c.certificate_ref, c.year).toUpperCase() === normalizedQuery,
      )
    : undefined;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #060a07 0%, #0d1a0f 50%, #050807 100%)',
        color: '#f5f0e8',
        padding: '2rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: 820 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="/logo.jpg" alt="Al Ihsan Group" style={{ width: 42, height: 42, borderRadius: 10, objectFit: 'cover' }} />
            <div>
              <div style={{ fontWeight: 700, color: '#d4a832', fontSize: '1.05rem' }}>Al Ihsan Group SG</div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)' }}>Official Qurban &amp; Aqiqah Certificate Verification</div>
            </div>
          </div>
          <Link to="/login" className="btn btn-secondary btn-sm">Portal Sign In</Link>
        </div>

        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Enter a Certificate Verification Code (e.g. <code>AIGCERT-XXXX-XXXX</code>) or Certificate Reference:
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="form-input"
              placeholder="AIGCERT-XXXX-XXXX or CERT-2026-00001"
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ flex: 1, minWidth: 220, fontFamily: 'var(--font-mono)' }}
            />
          </div>
        </div>

        {normalizedQuery && matched ? (
          <div className="card" style={{ padding: '1.5rem' }} data-testid="certificate-verify-valid">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              <div>
                <span className="badge badge-success">Verified Authentic Certificate</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.4rem' }}>
                  {matched.qurban_name_holder || matched.participant_name}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--gold-400)' }}>
                {formatCertificateSerialNo(matched.certificate_ref, matched.year)}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem', fontSize: '0.8125rem' }}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Certificate Reference</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{matched.certificate_ref}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Verification Code</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{matched.verification_code}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Programme</div>
                <div style={{ fontWeight: 600 }}>{matched.programme_name}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Location &amp; Livestock</div>
                <div style={{ fontWeight: 600 }}>{matched.country} · {matched.animal_label} ({matched.animal_ref})</div>
              </div>
            </div>

            <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(212,168,50,0.35)' }}>
              <CertificateDesign cert={matched} />
            </div>
          </div>
        ) : normalizedQuery ? (
          <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }} data-testid="certificate-verify-not-found">
            <span className="badge badge-danger" style={{ marginBottom: '0.5rem' }}>Verification Code Not Found</span>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              No issued certificate matched <code>{normalizedQuery}</code>. Please check the code on your certificate or sign in to the Participant Portal.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────
export default function App() {
  // Prefetch all page chunks during idle time so nav feels instant
  useEffect(() => { prefetchAllPages(); }, []);

  return (
    <AppDataProvider>
      <ToastProvider>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify" element={<CertificateVerifyPage />} />
          <Route path="/verify/:code" element={<CertificateVerifyPage />} />

          {/* Staff Admin */}
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <RequireStaff>
                  <AppLayout />
                </RequireStaff>
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="orders"        element={<OrdersPage />} />
            <Route path="payments"      element={<PaymentsPage />} />
            <Route path="animals"       element={<AnimalsPage />} />
            <Route path="suppliers"     element={<SuppliersPage />} />
            <Route path="deliveries"    element={<DeliveriesPage />} />
            <Route path="certificates"  element={<CertificatesPage />} />
            <Route path="participants"  element={<ParticipantsPage />} />
            <Route path="programmes"    element={<ProgrammesPage />} />
            <Route path="exceptions"    element={<ExceptionsPage />} />
            <Route path="audit"         element={<AuditLogPage />} />
            <Route path="settings"      element={<SettingsPage />} />
          </Route>

          {/* Participant Portal */}
          <Route
            path="/portal"
            element={
              <RequireAuth>
                <RequireParticipant>
                  <AppLayout />
                </RequireParticipant>
              </RequireAuth>
            }
          >
            <Route index element={<PortalDashboardPage />} />
            <Route path="orders"        element={<PortalOrdersPage />} />
            <Route path="certificates"  element={<PortalCertificatesPage />} />
            <Route path="notifications" element={<PortalNotificationsPage />} />
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </Suspense>
    </ToastProvider>
    </AppDataProvider>
  );
}
