import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, CreditCard, Dog, Users,
  Truck, Award, AlertTriangle, FileText, Settings,
  ChevronLeft, ChevronRight, BookOpen, Package, UserCheck,
  Bell, LogOut,
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
  staffOnly?: boolean;
  participantOnly?: boolean;
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
      { label: 'Orders',       icon: ShoppingCart, path: '/admin/orders' },
      { label: 'Payments',     icon: CreditCard,   path: '/admin/payments' },
      { label: 'Animals',      icon: Dog,          path: '/admin/animals' },
      { label: 'Suppliers',    icon: Package,      path: '/admin/suppliers' },
    ],
  },
  {
    label: 'Logistics',
    items: [
      { label: 'Deliveries',   icon: Truck,        path: '/admin/deliveries' },
      { label: 'Certificates', icon: Award,        path: '/admin/certificates' },
    ],
  },
  {
    label: 'Management',
    items: [
      { label: 'Participants', icon: UserCheck,    path: '/admin/participants' },
      { label: 'Programmes',   icon: BookOpen,     path: '/admin/programmes' },
      { label: 'Exceptions',   icon: AlertTriangle, path: '/admin/exceptions', badge: 3 },
      { label: 'Audit Log',    icon: FileText,     path: '/admin/audit' },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Settings',     icon: Settings,     path: '/admin/settings' },
    ],
  },
];

const PARTICIPANT_NAV: NavGroup[] = [
  {
    items: [
      { label: 'My Orders',    icon: ShoppingCart, path: '/portal' },
      { label: 'Certificates', icon: Award,        path: '/portal/certificates' },
      { label: 'Notifications', icon: Bell,        path: '/portal/notifications' },
    ],
  },
];

export function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const { profile, isStaff, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const navGroups = isStaff() ? STAFF_NAV : PARTICIPANT_NAV;
  const initials = profile
    ? `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`
    : 'U';

  // Close mobile sidebar on nav click
  const handleNavClick = () => {
    if (onClose) onClose();
  };

  const handleSignOut = () => {
    signOut();
    if (onClose) onClose();
  };

  // Build className: sidebar, optionally collapsed, optionally mobile-open
  const sidebarClass = [
    'sidebar',
    collapsed ? 'collapsed' : '',
    mobileOpen ? 'mobile-open' : '',
  ].filter(Boolean).join(' ');

  return (
    <aside className={sidebarClass}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-mark">A</div>
        <div className="logo-text">
          <div className="logo-name">AIGMS</div>
          <div className="logo-sub">Qurban Management</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            {group.label && !collapsed && (
              <div className="nav-section-label">{group.label}</div>
            )}
            {group.items.map(item => {
              const Icon = item.icon;
              const isActive = item.path === (isStaff() ? '/admin' : '/portal')
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path);

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`nav-item${isActive ? ' active' : ''}`}
                  title={collapsed ? item.label : undefined}
                  onClick={handleNavClick}
                >
                  <Icon className="nav-icon" />
                  <span>{item.label}</span>
                  {item.badge ? (
                    <span className="nav-badge">{item.badge}</span>
                  ) : null}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {/* User Profile */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.625rem',
          borderRadius: 'var(--border-radius-sm)',
          marginBottom: '0.5rem',
          background: 'var(--surface-700)',
        }}>
          <div className="avatar avatar-sm" style={{ flexShrink: 0 }}>
            {initials}
          </div>
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.first_name} {profile?.last_name}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                {profile?.role?.replace(/_/g, ' ')}
              </div>
            </div>
          )}
        </div>

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className="nav-item"
          style={{ width: '100%', border: 'none', background: 'none', color: 'var(--text-muted)' }}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut className="nav-icon" />
          <span>Sign Out</span>
        </button>

        {/* Collapse Toggle — only for desktop (hidden on mobile via: the mobile sidebar is full-width anyway) */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="nav-item"
          style={{ width: '100%', border: 'none', background: 'none', marginTop: '0.25rem' }}
          title={collapsed ? 'Expand' : 'Collapse'}
          id="sidebar-collapse-btn"
        >
          {collapsed ? <ChevronRight className="nav-icon" /> : <ChevronLeft className="nav-icon" />}
          <span>Collapse</span>
        </button>
      </div>
    </aside>
  );
}
