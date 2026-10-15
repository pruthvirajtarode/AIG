import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
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
const PortalOrdersPage       = lazy(() => import('@/pages/portal/PortalOrdersPage').then(m => ({ default: m.PortalOrdersPage })));
const PortalCertificatesPage = lazy(() => import('@/pages/portal/PortalCertificatesPage').then(m => ({ default: m.PortalCertificatesPage })));
const PortalNotificationsPage = lazy(() => import('@/pages/portal/PortalNotificationsPage').then(m => ({ default: m.PortalNotificationsPage })));

// ── Guards ────────────────────────────────────────────────────
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function RequireStaff({ children }: { children: React.ReactNode }) {
  const { isStaff, isLoading } = useAuth();

  if (isLoading) return null;
  if (!isStaff()) return <Navigate to="/portal" replace />;

  return <>{children}</>;
}

function RequireParticipant({ children }: { children: React.ReactNode }) {
  const { isParticipant, isStaff, isLoading } = useAuth();

  if (isLoading) return null;
  if (!isParticipant() && !isStaff()) return <Navigate to="/admin" replace />;

  return <>{children}</>;
}

// ── Loading Fallback ──────────────────────────────────────────
function PageLoader() {
  return (
    <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <LoadingSpinner size="lg" />
    </div>
  );
}

export default function App() {
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
                <AppLayout />
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
