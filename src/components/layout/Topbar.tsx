import React, { useState } from 'react';
import { Bell, Search, Menu } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface TopbarProps {
  title?: string;
  onMenuClick?: () => void;
}

export function Topbar({ title, onMenuClick }: TopbarProps) {
  const { profile } = useAuth();
  const [showNotifs, setShowNotifs] = useState(false);
  const initials = profile
    ? `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`
    : 'U';

  return (
    <header className="topbar">
      {/* Hamburger menu — only visible on mobile */}
      <button
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
      <div className="search-bar" style={{ maxWidth: 280 }}>
        <Search className="search-icon" size={15} />
        <input
          type="search"
          className="form-input"
          placeholder="Search..."
          style={{ height: 36, fontSize: '0.8125rem' }}
          id="topbar-search"
        />
      </div>

      {/* Notifications */}
      <div className="dropdown">
        <button
          id="notifications-btn"
          className="btn btn-ghost"
          style={{ position: 'relative', padding: '0.5rem', borderRadius: '8px' }}
          onClick={() => setShowNotifs(v => !v)}
        >
          <Bell size={18} />
          <span style={{
            position: 'absolute', top: 4, right: 4,
            width: 8, height: 8,
            borderRadius: '50%',
            background: 'var(--danger)',
            border: '1.5px solid var(--surface-950)',
          }} />
        </button>
        {showNotifs && (
          <div className="dropdown-menu" style={{ width: 320 }} onClick={() => setShowNotifs(false)}>
            <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>Notifications</span>
            </div>
            {[
              { title: 'Payment submitted', body: 'Order #AIG-2025-000042 requires review', time: '5m ago', type: 'info' },
              { title: 'Exception raised', body: 'Animal weight below threshold — Animal #A-2025-008', time: '18m ago', type: 'warning' },
              { title: 'Delivery confirmed', body: 'Order #AIG-2025-000039 delivered successfully', time: '1h ago', type: 'success' },
            ].map((n, i) => (
              <div key={i} className="dropdown-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.125rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{n.title}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{n.body}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{n.time}</span>
              </div>
            ))}
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
