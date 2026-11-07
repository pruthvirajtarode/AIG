import React, { useState, useCallback, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ToastContainer } from '@/components/ui/ToastContainer';

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const openSidebar = useCallback(() => setMobileOpen(true), []);
  const closeSidebar = useCallback(() => setMobileOpen(false), []);
  const toggleCollapse = useCallback(() => setCollapsed(c => !c), []);

  // Automatically close mobile sidebar drawer on route navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Close mobile drawer on Escape key & lock background scroll while open
  useEffect(() => {
    if (!mobileOpen || typeof document === 'undefined' || typeof window === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen]);

  return (
    <div className={`main-layout${collapsed ? ' sidebar-collapsed' : ''}`}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Dark overlay behind sidebar on mobile */}
      <div
        className={`sidebar-overlay${mobileOpen ? ' visible' : ''}`}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      <Sidebar
        mobileOpen={mobileOpen}
        onClose={closeSidebar}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
      />

      <div className="main-content">
        <Topbar onMenuClick={openSidebar} />
        <main id="main-content">
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}
