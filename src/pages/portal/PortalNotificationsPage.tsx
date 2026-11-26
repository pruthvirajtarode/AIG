import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Bell, CheckCircle2, CreditCard, Truck, Award, AlertTriangle, Check, Download, LogOut } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import { useAppData } from '@/contexts/AppDataContext';
import { usePortalSession } from '@/hooks/usePortalSession';
import { ParticipantSignInCard } from '@/components/portal/ParticipantSignInCard';
import { getStatusLabel } from '@/lib/statusEngine';
import {
  OFFICIAL_WHATSAPP_DISPLAY,
  isBreedingProgramme,
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

export function PortalNotificationsPage() {
  usePageTitle('Notifications');
  const { payments, animals, programmes, certificates } = useAppData();
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const {
    sessionEmail,
    sessionOrderRef,
    participantName,
    matchedOrders,
    isSignedIn,
    isStaffUser,
    isStaffPreview,
    signIn,
    signOut,
  } = usePortalSession();

  const items = useMemo<PortalNotificationItem[]>(() => {
    if (matchedOrders.length === 0) return [];

    const built: PortalNotificationItem[] = [];
    for (const o of matchedOrders) {
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

      const linkedAnimal = animals.find(a => a.order_ref === o.order_ref);
      if (linkedAnimal) {
        built.push({
          id: `anm-alloc-${linkedAnimal.id}`,
          type: 'info',
          title: `Animal Allocated (${linkedAnimal.animal_code || linkedAnimal.animal_ref})`,
          body: `Livestock ${linkedAnimal.animal_code || linkedAnimal.animal_ref} has been allocated to your order ${o.order_ref} for ${o.programme}.`,
          time: o.created_at,
          channelLabel: `WhatsApp (${OFFICIAL_WHATSAPP_DISPLAY}) · Email fallback`,
        });

        const prog = programmes.find(p => (o.programme_id && p.id === o.programme_id) || p.name === o.programme);
        const supportsWeight = isBreedingProgramme(o.programme, prog?.supports_weight_timeline);
        if (supportsWeight && linkedAnimal.weight_history && linkedAnimal.weight_history.length > 0) {
          const latestWeight = linkedAnimal.weight_history[linkedAnimal.weight_history.length - 1];
          const weightTime = latestWeight.recorded_at;
          built.push({
            id: `anm-weight-${linkedAnimal.id}-${weightTime}`,
            type: 'info',
            title: `Breeding Weight Update — ${latestWeight.weight_kg} kg`,
            body: `Indonesia Breeding animal ${linkedAnimal.animal_code || linkedAnimal.animal_ref} (${linkedAnimal.qurban_name_holder || o.participant}): monthly weight verified at ${latestWeight.weight_kg} kg on ${formatRelativeTime(weightTime)}.`,
            time: weightTime,
            channelLabel: `WhatsApp (${OFFICIAL_WHATSAPP_DISPLAY}) · Portal Timeline`,
          });
        }
      }

      if (['qurban_complete', 'processing', 'completed'].includes(o.status)) {
        built.push({
          id: `qurb-done-${o.id}`,
          type: 'success',
          title: `Qurban Performed Alhamdulillah (${o.order_ref})`,
          body: `The Qurban sacrifice ritual for order ${o.order_ref} (${o.programme}) has been fulfilled.`,
          time: o.created_at,
          channelLabel: `WhatsApp (${OFFICIAL_WHATSAPP_DISPLAY}) · Email fallback`,
        });
      }

      const cert = certificates.find(
        c => c.order_ref === o.order_ref && ['generated', 'sent', 'regenerated'].includes(c.status),
      );
      if (cert) {
        built.push({
          id: `cert-ready-${cert.id}`,
          type: 'certificate',
          title: `Official Certificate Ready (${cert.certificate_ref})`,
          body: `Your official digital Qurban/Aqiqah certificate is available for download in the Participant Portal.`,
          time: cert.generated_at || o.created_at,
          channelLabel: `WhatsApp (${OFFICIAL_WHATSAPP_DISPLAY}) · Portal PDF`,
          certificateLink: true,
        });
      }
    }

    return built.sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime());
  }, [matchedOrders, payments, animals, programmes, certificates]);

  const markAllRead = () => {
    setReadIds(new Set(items.map(i => i.id)));
  };

  const markRead = (id: string) => {
    setReadIds(prev => new Set([...prev, id]));
  };

  const unread = items.filter(i => !readIds.has(i.id)).length;
  const filtered = filter === 'unread' ? items.filter(i => !readIds.has(i.id)) : items;

  if (!isSignedIn) {
    return (
      <div className="page-content animate-fadeInUp">
        <div className="page-header">
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">WhatsApp &amp; Email updates regarding your Qurban registrations</p>
        </div>
        <ParticipantSignInCard
          title="View Your Notifications"
          subtitle="Enter your registered email address or Order Reference to view your WhatsApp & Email order notifications and certificate download links."
          actionLabel="View Notifications"
          signIn={signIn}
          isStaffUser={isStaffUser}
        />
      </div>
    );
  }

  return (
    <div className="page-content animate-fadeInUp">
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <h1 className="page-title">Notifications</h1>
        <p className="page-subtitle">WhatsApp &amp; Email updates regarding your Qurban registrations</p>
      </div>

      {/* Participant Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          background: 'rgba(212,168,50,0.08)',
          border: '1px solid rgba(212,168,50,0.22)',
          borderRadius: 10,
          marginBottom: '1.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <CheckCircle2 size={16} color="#d4a832" />
          <div style={{ fontSize: '0.8125rem', color: '#f5f0e8' }}>
            {isStaffPreview && (
              <span className="badge badge-warning" style={{ marginRight: '0.5rem', fontSize: '0.7rem' }}>
                Staff Preview
              </span>
            )}
            Participant: <strong>{participantName || sessionEmail || sessionOrderRef}</strong>
            {sessionEmail && (
              <span style={{ color: 'var(--text-muted)', marginLeft: '0.375rem' }}>({sessionEmail})</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="btn btn-ghost btn-sm"
          style={{ fontSize: '0.75rem', gap: '0.35rem', color: 'var(--text-secondary)' }}
        >
          <LogOut size={13} />
          Switch Participant / Sign Out
        </button>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div className="tab-group" style={{ margin: 0 }}>
          {(['all', 'unread'] as const).map(val => (
            <button
              key={val}
              type="button"
              className={`tab-btn${filter === val ? ' active' : ''}`}
              onClick={() => setFilter(val)}
            >
              {val === 'all' ? 'All Updates' : 'Unread'}
              {val === 'unread' && unread > 0 && (
                <span className="nav-badge" style={{ marginLeft: '0.375rem', display: 'inline-flex' }}>{unread}</span>
              )}
            </button>
          ))}
        </div>

        {unread > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={markAllRead} style={{ fontSize: '0.8125rem', gap: '0.375rem' }}>
            <Check size={14} /> Mark all read
          </button>
        )}
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
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: NOTIF_BG[notif.type],
                    border: `1px solid ${NOTIF_COLOR[notif.type]}33`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={18} color={NOTIF_COLOR[notif.type]} />
                  </div>

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
