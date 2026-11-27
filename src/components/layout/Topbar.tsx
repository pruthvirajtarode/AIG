import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, Search, Menu, RefreshCw, ChevronDown, LogOut,
  LayoutDashboard, Settings, ExternalLink, ShoppingCart, Award,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppData } from '@/contexts/AppDataContext';
import { usePortalSession } from '@/hooks/usePortalSession';
import { useToast } from '@/contexts/ToastContext';
import { formatRelativeTime } from '@/lib/utils';

interface TopbarProps {
  title?: string;
  onMenuClick?: () => void;
}

interface QuickSearchHit {
  key: string;
  label: string;
  sub: string;
  category: string;
  path: string;
}

interface LiveNotifItem {
  id: string;
  title: string;
  body: string;
  time: string;
  path: string;
}

export function Topbar({ title, onMenuClick }: TopbarProps) {
  const { profile, isStaff, signOut } = useAuth();
  const { toast } = useToast();
  const { orders, animals, payments, exceptions, certificates, participants, refreshFromCloud, isCloudSyncing, lastCloudSync } = useAppData();
  const navigate = useNavigate();
  const location = useLocation();
  const inPortal = location.pathname.startsWith('/portal');
  const portalSession = usePortalSession();
  const inPortalMode = inPortal || (!!profile && !isStaff());

  const [showNotifs, setShowNotifs] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const fullName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim();
  const initials = (() => {
    if (inPortal) {
      const name = portalSession.participantName;
      if (name) {
        const parts = name.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
          return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
        }
        return parts[0].slice(0, 2).toUpperCase();
      }
      return 'P';
    }
    if (fullName) {
      const parts = fullName.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
      }
      return parts[0].slice(0, 2).toUpperCase();
    }
    return profile?.email?.charAt(0).toUpperCase() ?? 'U';
  })();

  const topbarDisplayName = inPortal
    ? (portalSession.participantName || portalSession.sessionEmail || 'Participant')
    : (profile?.first_name || 'Staff');

  // Close menus on route change
  useEffect(() => {
    setProfileMenuOpen(false);
    setShowNotifs(false);
    setSearchOpen(false);
  }, [location.pathname]);

  // Close popovers on outside click or Escape
  useEffect(() => {
    if ((!showNotifs && !searchOpen && !profileMenuOpen) || typeof document === 'undefined') return;
    const onDocClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) setProfileMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNotifs(false);
        setSearchOpen(false);
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [showNotifs, searchOpen, profileMenuOpen]);

  const handleSignOut = async () => {
    setProfileMenuOpen(false);
    if (inPortal && portalSession.isSignedIn) {
      portalSession.signOut();
    }
    if (!inPortal || !isStaff()) {
      await signOut();
    }
    toast('info', 'Signed Out', 'You have been signed out successfully.');
    navigate(inPortal ? '/portal' : '/login');
  };

  // Quick search across workspace (scoped strictly to portal vs staff admin)
  const searchHits = useMemo<QuickSearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    if (inPortalMode) {
      const hits: QuickSearchHit[] = [];
      for (const c of certificates.slice(0, 20)) {
        if (c.certificate_ref.toLowerCase().includes(q) || c.programme_name.toLowerCase().includes(q)) {
          hits.push({
            key: `cert-${c.id}`,
            label: c.certificate_ref,
            sub: c.programme_name,
            category: 'Certificate',
            path: '/portal/certificates',
          });
        }
      }
      return hits.slice(0, 6);
    }

    const hits: QuickSearchHit[] = [];
    for (const o of orders) {
      if (
        o.order_ref.toLowerCase().includes(q) ||
        o.participant.toLowerCase().includes(q) ||
        o.programme.toLowerCase().includes(q)
      ) {
        hits.push({
          key: `ord-${o.id}`,
          label: `${o.order_ref} · ${o.participant}`,
          sub: `${o.programme} (${o.currency} ${o.total_amount})`,
          category: 'Order',
          path: '/admin/orders',
        });
      }
      if (hits.length >= 4) break;
    }
    for (const a of animals) {
      const code = a.animal_code || a.animal_ref;
      if (
        code.toLowerCase().includes(q) ||
        (a.qurban_name_holder ?? '').toLowerCase().includes(q) ||
        (a.order_ref ?? '').toLowerCase().includes(q)
      ) {
        hits.push({
          key: `anm-${a.id}`,
          label: `${code}${a.qurban_name_holder ? ` · ${a.qurban_name_holder}` : ''}`,
          sub: a.programme || a.location,
          category: 'Animal',
          path: '/admin/animals',
        });
      }
      if (hits.length >= 6) break;
    }
    for (const p of participants) {
      const pName = `${p.first_name} ${p.last_name}`.trim();
      if (
        pName.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.participant_ref.toLowerCase().includes(q)
      ) {
        hits.push({
          key: `prt-${p.id}`,
          label: `${pName} (${p.participant_ref})`,
          sub: p.email,
          category: 'Participant',
          path: '/admin/participants',
        });
      }
      if (hits.length >= 8) break;
    }
    return hits.slice(0, 6);
  }, [query, inPortalMode, orders, animals, participants, certificates]);

  // Live notification items
  const liveNotifications = useMemo<LiveNotifItem[]>(() => {
    if (inPortalMode) {
      return [
        {
          id: 'portal-notif-link',
          title: 'Participant Updates',
          body: 'View your latest Qurban order, weight, and certificate notifications.',
          time: 'View all',
          path: '/portal/notifications',
        },
      ];
    }
    const items: LiveNotifItem[] = [];
    for (const p of payments.filter(x => x.status === 'submitted' || x.status === 'under_review').slice(0, 2)) {
      items.push({
        id: `pay-${p.id}`,
        title: 'Payment awaiting review',
        body: `${p.payment_ref} · Order ${p.order_ref} (${p.participant})`,
        time: p.submitted_at ? formatRelativeTime(p.submitted_at) : 'Pending',
        path: '/admin/payments',
      });
    }
    for (const ex of exceptions.filter(x => x.status === 'open' || x.status === 'escalated').slice(0, 2)) {
      items.push({
        id: `ex-${ex.id}`,
        title: `Exception (${ex.severity.toUpperCase()})`,
        body: ex.title,
        time: formatRelativeTime(ex.created_at),
        path: '/admin/exceptions',
      });
    }
    for (const o of orders.slice(0, 2)) {
      if (items.length >= 4) break;
      items.push({
        id: `ord-${o.id}`,
        title: `Order ${o.order_ref}`,
        body: `${o.participant} · ${o.programme}`,
        time: formatRelativeTime(o.created_at),
        path: '/admin/orders',
      });
    }
    return items;
  }, [inPortalMode, payments, exceptions, orders]);

  const hasAlertDot = inPortalMode
    ? true
    : payments.some(p => p.status === 'submitted' || p.status === 'under_review') ||
      exceptions.some(e => e.status === 'open' || e.status === 'escalated');

  return (
    <header className="topbar">
      {/* Hamburger menu — only visible on mobile */}
      <button
        type="button"
        className="hamburger-btn"
        onClick={onMenuClick}
        aria-label="Open navigation"
        id="mobile-menu-btn"
      >
        <Menu size={18} />
      </button>

      {/* Title (left side) */}
      {title && (
        <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)', marginRight: 'auto' }}>
          {title}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Search (hidden on mobile via CSS) */}
      <div ref={searchRef} className="search-bar" style={{ maxWidth: 280 }}>
        <Search className="search-icon" size={15} />
        <input
          type="search"
          className="form-input"
          placeholder={inPortalMode ? 'Search certificates…' : 'Quick search orders, animals…'}
          aria-label="Quick search"
          value={query}
          onFocus={() => setSearchOpen(true)}
          onChange={e => {
            setQuery(e.target.value);
            setSearchOpen(true);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && searchHits[0]) {
              navigate(searchHits[0].path);
              setSearchOpen(false);
              setQuery('');
            }
          }}
          style={{ height: 36, fontSize: '0.8125rem' }}
          id="topbar-search"
        />
        {searchOpen && query.trim() && (
          <div
            className="dropdown-menu"
            style={{ width: 'min(340px, calc(100vw - 2rem))', left: 0, right: 'auto' }}
          >
            {searchHits.length === 0 ? (
              <div style={{ padding: '0.625rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                No matches for &ldquo;{query.trim()}&rdquo;
              </div>
            ) : (
              searchHits.map(hit => (
                <div
                  key={hit.key}
                  className="dropdown-item"
                  style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.125rem' }}
                  onClick={() => {
                    navigate(hit.path);
                    setSearchOpen(false);
                    setQuery('');
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {hit.label}
                    </span>
                    <span className="badge badge-teal" style={{ fontSize: '0.62rem', flexShrink: 0 }}>
                      {hit.category}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                    {hit.sub}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Notifications */}
      <div className="dropdown" ref={notifRef}>
        <button
          id="notifications-btn"
          type="button"
          className="btn btn-ghost"
          aria-label="Notifications"
          aria-expanded={showNotifs}
          style={{ position: 'relative', padding: '0.5rem', borderRadius: '8px' }}
          onClick={() => setShowNotifs(v => !v)}
        >
          <Bell size={18} />
          {hasAlertDot && (
            <span style={{
              position: 'absolute', top: 4, right: 4,
              width: 8, height: 8,
              borderRadius: '50%',
              background: 'var(--danger)',
              border: '1.5px solid var(--surface-950)',
            }} />
          )}
        </button>
        {showNotifs && (
          <div
            className="dropdown-menu"
            style={{ width: 'min(320px, calc(100vw - 1.5rem))' }}
          >
            <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Notifications</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{liveNotifications.length} active</span>
            </div>
            {liveNotifications.length === 0 ? (
              <div style={{ padding: '1rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                All caught up — no pending alerts
              </div>
            ) : (
              liveNotifications.map(n => (
                <div
                  key={n.id}
                  className="dropdown-item"
                  style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.125rem' }}
                  onClick={() => {
                    setShowNotifs(false);
                    navigate(n.path);
                  }}
                >
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{n.title}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{n.body}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{n.time}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Cloud Sync Status Button */}
      <button
        type="button"
        className="btn btn-ghost"
        title={lastCloudSync ? `Cloud Synced at ${lastCloudSync}. Click to force refresh.` : 'Sync with live database. Click to refresh.'}
        aria-label="Sync with cloud database"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.35rem 0.65rem',
          fontSize: '0.75rem',
          borderRadius: 8,
          background: 'rgba(212,168,50,0.08)',
          border: '1px solid rgba(212,168,50,0.22)',
          color: isCloudSyncing ? 'var(--gold-400)' : 'var(--text-secondary)',
          cursor: isCloudSyncing ? 'wait' : 'pointer',
        }}
        onClick={async () => {
          if (!isCloudSyncing && refreshFromCloud) {
            await refreshFromCloud();
          }
        }}
      >
        <RefreshCw
          size={13}
          style={{
            color: isCloudSyncing ? 'var(--gold-400)' : 'var(--success)',
            animation: isCloudSyncing ? 'spin 1s linear infinite' : undefined,
          }}
        />
        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
          {isCloudSyncing ? 'Syncing…' : 'Live Sync'}
        </span>
      </button>

      {/* User Profile & Menu (with Log Out option) */}
      <div ref={profileMenuRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setProfileMenuOpen(prev => !prev)}
          id="topbar-profile-btn"
          title="User profile & options"
          aria-label="User profile & options"
          aria-expanded={profileMenuOpen}
          aria-haspopup="true"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: profileMenuOpen ? 'rgba(212,168,50,0.12)' : 'transparent',
            border: profileMenuOpen ? '1px solid rgba(212,168,50,0.35)' : '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            padding: '0.25rem 0.5rem',
            cursor: 'pointer',
            transition: 'all 0.18s ease',
            color: 'inherit',
          }}
          onMouseEnter={e => {
            if (!profileMenuOpen) {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.borderColor = 'rgba(212,168,50,0.2)';
            }
          }}
          onMouseLeave={e => {
            if (!profileMenuOpen) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
            }
          }}
        >
          <div className="avatar avatar-sm" style={{ background: 'var(--aig-green-700)' }}>
            {initials}
          </div>
          <span className="topbar-username" style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {topbarDisplayName}
          </span>
          <ChevronDown
            size={13}
            style={{
              color: 'var(--text-muted)',
              transition: 'transform 0.2s ease',
              transform: profileMenuOpen ? 'rotate(180deg)' : 'none',
            }}
          />
        </button>

        {profileMenuOpen && (
          <div
            className="popover"
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: 250,
              background: 'var(--surface-800)',
              border: '1px solid rgba(212,168,50,0.25)',
              borderRadius: 12,
              boxShadow: '0 12px 36px rgba(0,0,0,0.6), 0 0 20px rgba(212,168,50,0.08)',
              padding: '0.5rem',
              zIndex: 1000,
              animation: 'fadeIn 0.15s ease',
            }}
          >
            {/* User Info Header */}
            <div
              style={{
                padding: '0.75rem',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                marginBottom: '0.375rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div className="avatar avatar-sm" style={{ background: 'var(--aig-green-700)' }}>
                  {initials}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {inPortal
                      ? (portalSession.participantName || 'Participant')
                      : (fullName || profile?.email || 'Staff Member')}
                  </div>
                  <div
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {inPortal
                      ? (portalSession.sessionEmail || '')
                      : (profile?.email || '')}
                  </div>
                </div>
              </div>

              {/* Role badge */}
              <div style={{ marginTop: '0.5rem' }}>
                {inPortal ? (
                  <span
                    className={portalSession.isStaffPreview ? 'badge badge-warning' : 'badge badge-teal'}
                    style={{ fontSize: '0.68rem', textTransform: 'capitalize' }}
                  >
                    {portalSession.isStaffPreview
                      ? 'Staff Preview'
                      : portalSession.isSignedIn
                      ? 'Registered Participant'
                      : 'Guest Access'}
                  </span>
                ) : (
                  <span className="badge badge-gold" style={{ fontSize: '0.68rem', textTransform: 'capitalize' }}>
                    {profile?.role?.replace(/_/g, ' ') || 'Super Admin'}
                  </span>
                )}
              </div>
            </div>

            {/* Menu Links */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
              {!inPortal ? (
                <>
                  <button
                    type="button"
                    onClick={() => { setProfileMenuOpen(false); navigate('/admin'); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      width: '100%',
                      padding: '0.5rem 0.625rem',
                      borderRadius: 6,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <LayoutDashboard size={15} color="var(--aig-green-400)" />
                    <span>Dashboard</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setProfileMenuOpen(false); navigate('/admin/settings'); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      width: '100%',
                      padding: '0.5rem 0.625rem',
                      borderRadius: 6,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Settings size={15} color="var(--text-muted)" />
                    <span>Settings</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setProfileMenuOpen(false); navigate('/portal'); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      width: '100%',
                      padding: '0.5rem 0.625rem',
                      borderRadius: 6,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <ExternalLink size={15} color="var(--gold-400)" />
                    <span>Participant Portal Preview</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => { setProfileMenuOpen(false); navigate('/portal'); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      width: '100%',
                      padding: '0.5rem 0.625rem',
                      borderRadius: 6,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <LayoutDashboard size={15} color="var(--aig-green-400)" />
                    <span>Portal Home</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setProfileMenuOpen(false); navigate('/portal/orders'); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      width: '100%',
                      padding: '0.5rem 0.625rem',
                      borderRadius: 6,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <ShoppingCart size={15} color="var(--text-muted)" />
                    <span>My Orders</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setProfileMenuOpen(false); navigate('/portal/certificates'); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      width: '100%',
                      padding: '0.5rem 0.625rem',
                      borderRadius: 6,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Award size={15} color="var(--gold-400)" />
                    <span>My Certificates</span>
                  </button>
                  {isStaff() && (
                    <button
                      type="button"
                      onClick={() => { setProfileMenuOpen(false); navigate('/admin'); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.625rem',
                        width: '100%',
                        padding: '0.5rem 0.625rem',
                        borderRadius: 6,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <LayoutDashboard size={15} color="var(--aig-green-400)" />
                      <span>Back to Admin Panel</span>
                    </button>
                  )}
                </>
              )}

              {/* Divider */}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0.375rem 0' }} />

              {/* Log Out Option (Requested by Client) */}
              <button
                type="button"
                id="topbar-logout-btn"
                onClick={handleSignOut}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  width: '100%',
                  padding: '0.5rem 0.625rem',
                  borderRadius: 6,
                  background: 'transparent',
                  border: 'none',
                  color: '#f87171',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(239,68,68,0.12)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <LogOut size={15} color="#f87171" />
                <span>
                  {inPortal && portalSession.isSignedIn
                    ? (portalSession.isStaffPreview ? 'Exit Preview' : 'Sign Out / Switch')
                    : 'Sign Out'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
