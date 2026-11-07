import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Search, Menu } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppData } from '@/contexts/AppDataContext';
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
  const { profile, isStaff } = useAuth();
  const { orders, animals, payments, exceptions, certificates, participants } = useAppData();
  const navigate = useNavigate();
  const location = useLocation();
  const inPortal = location.pathname.startsWith('/portal');
  const inPortalMode = inPortal || (!!profile && !isStaff());

  const [showNotifs, setShowNotifs] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);

  const fullName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim();
  const initials = fullName
    ? `${profile!.first_name.charAt(0)}${profile!.last_name.charAt(0)}`.toUpperCase()
    : (profile?.email?.charAt(0).toUpperCase() ?? 'U');

  // Close popovers on outside click or Escape
  useEffect(() => {
    if ((!showNotifs && !searchOpen) || typeof document === 'undefined') return;
    const onDocClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNotifs(false);
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [showNotifs, searchOpen]);

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

      {/* User Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div className="avatar avatar-sm">{initials}</div>
        <span className="topbar-username" style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
          {profile?.first_name}
        </span>
      </div>
    </header>
  );
}
