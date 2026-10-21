import React, { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ToastContainer } from '@/components/ui/ToastContainer';

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const openSidebar  = useCallback(() => setMobileOpen(true), []);
  const closeSidebar = useCallback(() => setMobileOpen(false), []);

  return (
    <div className="main-layout">
      {/* Dark overlay behind sidebar on mobile */}
      <div
        className={`sidebar-overlay${mobileOpen ? ' visible' : ''}`}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      <Sidebar mobileOpen={mobileOpen} onClose={closeSidebar} />

      <div className="main-content">
        <Topbar onMenuClick={openSidebar} />
        <main>
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}
