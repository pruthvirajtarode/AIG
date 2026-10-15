import React, { useState } from 'react';
import { Bell, CheckCircle2, CreditCard, Truck, Award, AlertTriangle, Check } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

type NotifType = 'info' | 'success' | 'warning' | 'payment' | 'delivery' | 'certificate';

const NOTIF_ICON: Record<NotifType, React.ElementType> = {
  info: Bell,
  success: CheckCircle2,
  warning: AlertTriangle,
  payment: CreditCard,
  delivery: Truck,
  certificate: Award,
};

const NOTIF_COLOR: Record<NotifType, string> = {
  info: 'var(--info)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  payment: 'var(--purple)',
  delivery: 'var(--orange)',
  certificate: 'var(--gold-400)',
};

const NOTIF_BG: Record<NotifType, string> = {
  info: 'var(--info-bg)',
  success: 'var(--success-bg)',
  warning: 'var(--warning-bg)',
  payment: 'var(--purple-bg)',
  delivery: 'var(--orange-bg)',
  certificate: 'var(--warning-bg)',
};

const MOCK_NOTIFICATIONS = [
  { id: 'n1', type: 'payment' as NotifType, title: 'Payment Verified ✓', body: 'Your payment of SGD 850 for Order AIG-2025-000158 (Cow Share — Somalia) has been verified. Your order is now confirmed.', time: '2025-05-14T10:05:00Z', read: false },
  { id: 'n2', type: 'info' as NotifType, title: 'Animal Allocation Update', body: 'Great news! An animal is being allocated for your Cow Share — Somalia order. You will receive an update shortly.', time: '2025-05-14T10:10:00Z', read: false },
  { id: 'n3', type: 'success' as NotifType, title: 'Order Confirmed', body: 'Your Qurban order AIG-2025-000158 has been confirmed. Qurban will be performed on 28 June 2025. May Allah accept your Qurban.', time: '2025-05-14T10:08:00Z', read: true },
  { id: 'n4', type: 'certificate' as NotifType, title: 'Certificate Ready 🎉', body: 'Your Qurban Certificate for Order AIG-2024-000110 (Goat — Malaysia) is ready. Click to download your PDF certificate.', time: '2024-07-01T09:05:00Z', read: true },
  { id: 'n5', type: 'delivery' as NotifType, title: 'Delivery Completed', body: 'Your Qurban meat package has been successfully delivered. Order AIG-2024-000110. JazakAllahu Khayran for your contribution.', time: '2024-06-30T15:00:00Z', read: true },
];

export function PortalNotificationsPage() {
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const unread = notifications.filter(n => !n.read).length;
  const filtered = notifications.filter(n => filter === 'all' || !n.read);

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <div className="page-content animate-fadeInUp">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">
            {unread > 0 ? `${unread} unread notification${unread > 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        {unread > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={markAllRead} style={{ gap: '0.5rem' }}>
            <Check size={14} /> Mark all read
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="tabs" style={{ marginBottom: '1.25rem' }}>
        {([['all', 'All'], ['unread', 'Unread']] as const).map(([val, label]) => (
          <button
            key={val}
            className={`tab-item ${filter === val ? 'active' : ''}`}
            onClick={() => setFilter(val)}
          >
            {label}
            {val === 'unread' && unread > 0 && (
              <span className="nav-badge" style={{ marginLeft: '0.375rem', display: 'inline-flex' }}>{unread}</span>
            )}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {filtered.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon"><Bell size={24} color="var(--text-muted)" /></div>
              <h3>No notifications</h3>
              <p>You're all caught up! No unread notifications.</p>
            </div>
          </div>
        ) : (
          filtered.map(notif => {
            const Icon = NOTIF_ICON[notif.type];
            return (
              <div
                key={notif.id}
                className="card"
                style={{
                  cursor: !notif.read ? 'pointer' : 'default',
                  borderColor: !notif.read ? 'var(--border-green)' : 'var(--border-subtle)',
                  background: !notif.read ? 'var(--surface-800)' : 'var(--surface-900)',
                  opacity: notif.read ? 0.8 : 1,
                  padding: '1rem 1.25rem',
                }}
                onClick={() => !notif.read && markRead(notif.id)}
              >
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  {/* Icon */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: NOTIF_BG[notif.type],
                    border: `1px solid ${NOTIF_COLOR[notif.type]}33`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={18} color={NOTIF_COLOR[notif.type]} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        {notif.title}
                      </div>
                      {!notif.read && (
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--aig-green-400)', flexShrink: 0 }} />
                      )}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.5rem' }}>
                      {notif.body}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {formatRelativeTime(notif.time)}
                    </div>
                  </div>

                  {/* Unread indicator */}
                  {!notif.read && (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ flexShrink: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}
                      onClick={e => { e.stopPropagation(); markRead(notif.id); }}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
