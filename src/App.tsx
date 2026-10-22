import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/auth/LoginPage';

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
          Qurban Management System
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

// ── App ───────────────────────────────────────────────────────
export default function App() {
  // Prefetch all page chunks during idle time so nav feels instant
  useEffect(() => { prefetchAllPages(); }, []);

  return (
    <ToastProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

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
            <Route index element={<PortalOrdersPage />} />
            <Route path="certificates"  element={<PortalCertificatesPage />} />
            <Route path="notifications" element={<PortalNotificationsPage />} />
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </Suspense>
    </ToastProvider>
  );
}
