import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Bell, CheckCircle2, CreditCard, Truck, Award, AlertTriangle, Check, Download } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useAppData } from '@/contexts/AppDataContext';
import { getStatusLabel } from '@/lib/statusEngine';
import {
  OFFICIAL_WHATSAPP_DISPLAY,
  isBreedingProgramme,
  normaliseEmail,
  normaliseName,
  participantFullName,
} from '@/lib/orderRules';

type NotifType = 'info' | 'success' | 'warning' | 'payment' | 'delivery' | 'certificate';

interface PortalNotificationItem {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  time: string;
  channelLabel?: string;
  certificateLink?: boolean;
}

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

const MOCK_NOTIFICATIONS: PortalNotificationItem[] = [
  { id: 'n1', type: 'payment', title: 'Payment Verified ✓', body: 'Your payment of SGD 850 for Order AIG-2025-000158 (Cow Share — Somalia) has been verified. Your order is now confirmed.', time: '2025-05-14T10:05:00Z', channelLabel: `WhatsApp (${OFFICIAL_WHATSAPP_DISPLAY})` },
  { id: 'n2', type: 'info', title: 'Animal Allocation Update', body: 'Great news! An animal is being allocated for your Cow Share — Somalia order. You will receive an update shortly.', time: '2025-05-14T10:10:00Z', channelLabel: `WhatsApp (${OFFICIAL_WHATSAPP_DISPLAY})` },
  { id: 'n3', type: 'success', title: 'Order Confirmation & Invoice', body: 'Your Qurban order AIG-2025-000158 and official invoice have been emailed once to your registered address and confirmed via WhatsApp.', time: '2025-05-14T10:08:00Z', channelLabel: 'Email (Invoice) + WhatsApp' },
  { id: 'n4', type: 'certificate', title: 'Certificate Ready 🎉', body: 'Your Qurban Certificate for Order AIG-2024-000110 (Goat — Malaysia) is ready to download as a PDF directly from the portal.', time: '2024-07-01T09:05:00Z', channelLabel: `WhatsApp (${OFFICIAL_WHATSAPP_DISPLAY})`, certificateLink: true },
  { id: 'n5', type: 'delivery', title: 'Delivery Completed', body: 'Your Qurban meat package has been successfully delivered. Order AIG-2024-000110. JazakAllahu Khayran for your contribution.', time: '2024-06-30T15:00:00Z', channelLabel: `WhatsApp (${OFFICIAL_WHATSAPP_DISPLAY})` },
];

export function PortalNotificationsPage() {
  usePageTitle('Notifications');
  const { user, profile } = useAuth();
  const { orders, payments, animals, programmes, certificates, participants } = useAppData();
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set(['n3', 'n4', 'n5']));
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const items = useMemo<PortalNotificationItem[]>(() => {
    const authEmail = normaliseEmail(profile?.email ?? user?.email);
    const authName = normaliseName(profile ? `${profile.first_name} ${profile.last_name}` : '');
    const matchedParticipant = authEmail
      ? participants.find(p => normaliseEmail(p.email) === authEmail)
      : undefined;

    const myOrders = orders.filter(o => {
      if (matchedParticipant && o.participant_id === matchedParticipant.id) return true;
      if (authEmail && o.email && normaliseEmail(o.email) === authEmail) return true;
      if (matchedParticipant && normaliseName(o.participant) === normaliseName(participantFullName(matchedParticipant))) return true;
      if (authName && authName !== 'demo admin' && normaliseName(o.participant) === authName) return true;
      return false;
    });

    if (myOrders.length === 0) return MOCK_NOTIFICATIONS;

    const built: PortalNotificationItem[] = [];
    for (const o of myOrders) {
      if (o.confirmation_email_sent_at || o.status !== 'draft') {
        built.push({
          id: `ord-inv-${o.id}`,
          type: 'success',
          title: `Order Confirmation & Invoice (${o.order_ref})`,
          body: `Your order ${o.order_ref} (${o.programme}, ${o.currency} ${o.total_amount.toLocaleString()}) confirmation & invoice was sent once to ${o.email || 'your email'} and confirmed via WhatsApp.`,
          time: o.confirmation_email_sent_at || o.created_at,
          channelLabel: `Email (Once) + WhatsApp (${OFFICIAL_WHATSAPP_DISPLAY})`,
        });
      }

      const pay = payments.find(p => p.order_ref === o.order_ref);
      if (pay && pay.status === 'verified') {
        built.push({
          id: `pay-ver-${pay.id}`,
          type: 'payment',
          title: `Payment Verified ✓ (${o.order_ref})`,
          body: `Your payment ${pay.payment_ref} (${pay.currency} ${pay.amount.toLocaleString()}) has been verified.`,
          time: pay.verified_at || o.created_at,
          channelLabel: `WhatsApp (${OFFICIAL_WHATSAPP_DISPLAY}) · Email fallback`,
        });
      } else if (pay && pay.status === 'rejected') {
        built.push({
          id: `pay-rej-${pay.id}`,
          type: 'warning',
          title: `Payment Requires Attention (${o.order_ref})`,
          body: `Payment ${pay.payment_ref} could not be verified${pay.rejection_reason ? `: ${pay.rejection_reason}` : ''}.`,
          time: o.created_at,
          channelLabel: `WhatsApp (${OFFICIAL_WHATSAPP_DISPLAY}) · Email fallback`,
        });
      }

      if (!['draft', 'pending_payment'].includes(o.status)) {
        built.push({
          id: `ord-st-${o.id}-${o.status}`,
          type: 'info',
          title: `Qurban Status Update — ${getStatusLabel(o.status)}`,
          body: `Order ${o.order_ref} (${o.programme}) is currently marked as ${getStatusLabel(o.status)}.`,
          time: o.created_at,
          channelLabel: `WhatsApp (${OFFICIAL_WHATSAPP_DISPLAY}) · Email fallback`,
        });
      }

      const prog = programmes.find(p => (o.programme_id && p.id === o.programme_id) || normaliseName(p.name) === normaliseName(o.programme));
      if (isBreedingProgramme(o.programme, prog?.supports_weight_timeline)) {
        const orderAnimals = animals.filter(a => a.order_ref === o.order_ref);
        for (const a of orderAnimals) {
          for (const [wi, w] of (a.weight_history ?? []).entries()) {
            built.push({
              id: `wt-${a.id}-${wi}`,
              type: 'info',
              title: `Breeding Weight Update — ${a.animal_code || a.animal_ref}`,
              body: `${a.qurban_name_holder || o.participant}'s animal (${a.animal_code || a.animal_ref}) recorded ${w.weight_kg} kg${w.notes ? ` (${w.notes})` : ''}.`,
              time: w.recorded_at,
              channelLabel: `WhatsApp (${OFFICIAL_WHATSAPP_DISPLAY}) · Email fallback`,
            });
          }
        }
      }

      const cert = certificates.find(c => c.order_ref === o.order_ref && ['generated', 'sent', 'regenerated'].includes(c.status));
      if (cert) {
        built.push({
          id: `cert-${cert.id}`,
          type: 'certificate',
          title: `Certificate Ready 🎉 (${cert.certificate_ref})`,
          body: `Your Qurban Certificate for ${o.order_ref} (${o.programme}) is ready! Download your PDF certificate directly in the portal.`,
          time: cert.sent_at || cert.generated_at || o.created_at,
          channelLabel: `WhatsApp (${OFFICIAL_WHATSAPP_DISPLAY}) · Email fallback`,
          certificateLink: true,
        });
      }
    }

    return built.sort((a, b) => b.time.localeCompare(a.time));
  }, [user, profile, orders, payments, animals, programmes, certificates, participants]);

  const unread = items.filter(n => !readIds.has(n.id)).length;
  const filtered = items.filter(n => filter === 'all' || !readIds.has(n.id));

  const markRead = (id: string) => {
    setReadIds(prev => new Set([...prev, id]));
  };

  const markAllRead = () => {
    setReadIds(new Set(items.map(n => n.id)));
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
              <p>You&apos;re all caught up! No unread notifications.</p>
            </div>
          </div>
        ) : (
          filtered.map(notif => {
            const Icon = NOTIF_ICON[notif.type];
            const isRead = readIds.has(notif.id);
            return (
              <div
                key={notif.id}
                className="card"
                style={{
                  cursor: !isRead ? 'pointer' : 'default',
                  borderColor: !isRead ? 'var(--border-green)' : 'var(--border-subtle)',
                  background: !isRead ? 'var(--surface-800)' : 'var(--surface-900)',
                  opacity: isRead ? 0.82 : 1,
                  padding: '1rem 1.25rem',
                }}
                onClick={() => !isRead && markRead(notif.id)}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.375rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        {notif.title}
                      </div>
                      {notif.channelLabel && (
                        <span className="badge badge-teal" style={{ fontSize: '0.65rem' }}>
                          {notif.channelLabel}
                        </span>
                      )}
                      {!isRead && (
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--aig-green-400)', flexShrink: 0 }} />
                      )}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.5rem' }}>
                      {notif.body}
                    </div>
                    {notif.certificateLink && (
                      <div style={{ marginBottom: '0.5rem' }}>
                        <Link
                          to="/portal/certificates"
                          className="btn btn-outline-green btn-sm"
                          onClick={e => e.stopPropagation()}
                          style={{ gap: '0.4rem' }}
                        >
                          <Download size={13} /> Download PDF Certificate
                        </Link>
                      </div>
                    )}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {formatRelativeTime(notif.time)}
                    </div>
                  </div>

                  {/* Unread indicator */}
                  {!isRead && (
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
