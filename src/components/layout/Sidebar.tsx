import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, CreditCard, Dog,
  Truck, Award, AlertTriangle, FileText, Settings,
  ChevronLeft, ChevronRight, BookOpen, Package, UserCheck,
  Bell, LogOut, X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface NavGroup {
  label?: string;
  items: NavItem[];
}

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  badge?: number;
}

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

const STAFF_NAV: NavGroup[] = [
  {
    items: [
      { label: 'Dashboard',    icon: LayoutDashboard, path: '/admin' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Orders',       icon: ShoppingCart,  path: '/admin/orders' },
      { label: 'Payments',     icon: CreditCard,    path: '/admin/payments' },
      { label: 'Animals',      icon: Dog,           path: '/admin/animals' },
      { label: 'Suppliers',    icon: Package,       path: '/admin/suppliers' },
    ],
  },
  {
    label: 'Logistics',
    items: [
      { label: 'Deliveries',   icon: Truck,         path: '/admin/deliveries' },
      { label: 'Certificates', icon: Award,         path: '/admin/certificates' },
    ],
  },
  {
    label: 'Management',
    items: [
      { label: 'Participants', icon: UserCheck,     path: '/admin/participants' },
      { label: 'Programmes',   icon: BookOpen,      path: '/admin/programmes' },
      { label: 'Exceptions',   icon: AlertTriangle, path: '/admin/exceptions', badge: 3 },
      { label: 'Audit Log',    icon: FileText,      path: '/admin/audit' },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Settings',     icon: Settings,      path: '/admin/settings' },
    ],
  },
];

const PARTICIPANT_NAV: NavGroup[] = [
  {
    items: [
      { label: 'Home',          icon: LayoutDashboard, path: '/portal' },
      { label: 'My Orders',     icon: ShoppingCart, path: '/portal/orders' },
      { label: 'Certificates',  icon: Award,        path: '/portal/certificates' },
      { label: 'Notifications', icon: Bell,         path: '/portal/notifications' },
    ],
  },
];

export function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const { profile, isStaff, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  // Menu follows the section being viewed. Staff browsing /portal get the participant menu
  // plus a shortcut back to the admin panel.
  const inPortal = location.pathname.startsWith('/portal');
  const navGroups: NavGroup[] = inPortal
    ? [
        ...PARTICIPANT_NAV,
        ...(isStaff()
          ? [{ label: 'Staff', items: [{ label: 'Admin Panel', icon: LayoutDashboard, path: '/admin' }] }]
          : []),
      ]
    : (isStaff() ? STAFF_NAV : PARTICIPANT_NAV);
  const rootPath = inPortal || !isStaff() ? '/portal' : '/admin';
  const fullName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim();
  const displayName = fullName || (inPortal ? (profile?.email ?? '') : '');
  const initials = fullName
    ? `${profile!.first_name.charAt(0)}${profile!.last_name.charAt(0)}`.toUpperCase()
    : (profile?.email?.charAt(0).toUpperCase() ?? 'U');

  const handleNavClick = () => { if (onClose) onClose(); };

  const handleSignOut = async () => {
    await signOut();
    if (onClose) onClose();
  };

  const sidebarClass = [
    'sidebar',
    collapsed ? 'collapsed' : '',
    mobileOpen ? 'mobile-open' : '',
  ].filter(Boolean).join(' ');

  return (
    <aside className={sidebarClass}>

      {/* ── Header: Logo + Collapse Arrow ─────────────────────── */}
      <div className="sidebar-logo" style={{ position: 'relative' }}>
        <div className="logo-mark" style={{ background: 'transparent', padding: 0, overflow: 'hidden' }}>
          <img
            src="/logo.jpg"
            alt="Al Ihsan Group"
            style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '8px', display: 'block' }}
          />
        </div>

        {!collapsed && (
          <div className="logo-text">
            <div className="logo-name">Al Ihsan Group</div>
            <div className="logo-sub">Qurban Management</div>
          </div>
        )}

        {/* Collapse / Expand arrow — desktop only */}
        <button
          id="sidebar-collapse-btn"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            position: 'absolute',
            right: collapsed ? '50%' : '0.75rem',
            transform: collapsed ? 'translateX(50%)' : 'none',
            bottom: '-14px',
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'var(--surface-700)',
            border: '1px solid rgba(212,168,50,0.2)',
            color: 'var(--gold-400)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            transition: 'all 0.2s ease',
            flexShrink: 0,
          }}
          className="sidebar-collapse-btn desktop-only"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Mobile close button */}
        {mobileOpen && (
          <button
            onClick={onClose}
            aria-label="Close sidebar"
            style={{
              marginLeft: 'auto',
              width: 32, height: 32,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* ── Navigation ─────────────────────────────────────────── */}
      <nav className="sidebar-nav" style={{ marginTop: '1rem' }}>
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {group.label && !collapsed && (
              <div className="nav-section-label">{group.label}</div>
            )}
            {group.items.map(item => {
              const Icon = item.icon;
              const isActive = item.path === rootPath || item.path === '/admin'
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`nav-item${isActive ? ' active' : ''}`}
                  title={collapsed ? item.label : undefined}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={handleNavClick}
                >
                  <Icon className="nav-icon" />
                  <span>{item.label}</span>
                  {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Footer: User Info + Logout ─────────────────────────── */}
      <div className="sidebar-footer">

        {/* User profile card */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.625rem',
          padding: '0.625rem 0.75rem',
          borderRadius: 8,
          background: 'rgba(212,168,50,0.06)',
          border: '1px solid rgba(212,168,50,0.1)',
          marginBottom: '0.625rem',
        }}>
          <div className="avatar avatar-sm" style={{ flexShrink: 0, background: 'var(--aig-green-700)' }}>
            {initials}
          </div>
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              {displayName && (
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </div>
              )}
              {/* Role label is for the admin panel only — never shown to participants / in the portal */}
              {!inPortal && (
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'capitalize', marginTop: '0.0625rem' }}>
                  {profile?.role?.replace(/_/g, ' ')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Logout button — prominent red */}
        <button
          id="logout-btn"
          onClick={handleSignOut}
          title={collapsed ? 'Sign Out' : undefined}
          aria-label="Sign out"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            padding: '0.625rem 0.75rem',
            borderRadius: 8,
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: '#f87171',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 600,
            transition: 'all 0.18s ease',
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.15)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.35)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.2)';
          }}
        >
          <LogOut size={16} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
