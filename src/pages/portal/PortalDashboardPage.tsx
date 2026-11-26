import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  ShoppingCart, Award, Bell, CheckCircle2, Clock,
  ArrowRight, Calendar, MapPin, Download, Star, Heart,
  ShieldCheck, LogOut,
} from 'lucide-react';
import { AnimalPhoto } from '@/components/ui/AnimalPhoto';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { OrderStatus } from '@/lib/database.types';
import { useAppData } from '@/contexts/AppDataContext';
import { usePortalSession } from '@/hooks/usePortalSession';
import { ParticipantSignInCard } from '@/components/portal/ParticipantSignInCard';
import { normaliseName } from '@/lib/orderRules';

const UPCOMING = [
  { date: 'June 2026 (1447H)', label: 'Eid al-Adha 2026 Qurban Season', type: 'qurban' },
  { date: 'Post-Sacrifice 2026', label: 'Digital Certificates & Meat Distribution', type: 'cert' },
];

const COUNTRIES: Record<string, string> = {
  Australia: '🇦🇺',
  Singapore: '🇸🇬',
  Indonesia: '🇮🇩',
  Yemen: '🇾🇪',
  Uganda: '🇺🇬',
  Somalia: '🇸🇴',
  Malaysia: '🇲🇾',
  Turkey: '🇹🇷',
  Palestine: '🇵🇸',
  Bangladesh: '🇧🇩',
};

const STATUS_PROGRESS: Partial<Record<OrderStatus, number>> = {
  draft: 1,
  pending_payment: 1,
  payment_submitted: 1,
  payment_under_review: 1,
  payment_rejected: 1,
  payment_verified: 2,
  confirmed: 2,
  animal_allocated: 3,
  animal_growing: 3,
  final_inspection: 3,
  qurban_complete: 4,
  processing: 4,
  shipped: 4,
  arrived: 4,
  delivery_scheduled: 4,
  out_for_delivery: 4,
  delivered: 4,
  certificate_generated: 5,
  completed: 5,
};

export function PortalDashboardPage() {
  usePageTitle('My Portal');
  const { animals, programmes, orders: allOrders } = useAppData();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    sessionEmail,
    sessionOrderRef,
    participantName,
    matchedOrders,
    matchedCertificates,
    isSignedIn,
    isStaffUser,
    isStaffPreview,
    signIn,
    signOut,
  } = usePortalSession();

  const [greeting] = useState(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  });

  const portalOrders = useMemo(() => {
    return matchedOrders.map(o => {
      const prog = programmes.find(p => (o.programme_id && p.id === o.programme_id) || normaliseName(p.name) === normaliseName(o.programme));
      const linkedAnimal = animals.find(a => a.order_ref === o.order_ref);
      return {
        id: o.id,
        order_ref: o.order_ref,
        programme: o.programme,
        animal_type: linkedAnimal?.animal_type ?? prog?.animal_type ?? 'goat',
        total_amount: o.total_amount,
        currency: o.currency,
        status: o.status,
        qurban_date: prog?.qurban_date ? formatDate(prog.qurban_date) : '2026 Season (1447H)',
        country: o.programme_country || prog?.country || 'Singapore',
        progress: STATUS_PROGRESS[o.status as OrderStatus] ?? 1,
      };
    });
  }, [matchedOrders, programmes, animals]);

  const unreadCount = useMemo(() => {
    return portalOrders.reduce((acc, o) => {
      let count = 0;
      if (o.status !== 'draft') count += 1;
      if (o.status === 'completed' || o.status === 'certificate_generated') count += 3;
      else if (o.status !== 'pending_payment') count += 1;
      return acc + count;
    }, 0);
  }, [portalOrders]);

  const totalOrders = portalOrders.length;
  const isOrderCompleted = (status: OrderStatus) => status === 'completed' || status === 'certificate_generated';
  const completedOrders = portalOrders.filter(o => isOrderCompleted(o.status)).length;
  const inProgressOrders = portalOrders.filter(o => !isOrderCompleted(o.status) && o.status !== 'cancelled').length;
  const totalSpent = portalOrders.reduce((a, o) => a + o.total_amount, 0);

  const activeQueryOrder = sessionOrderRef || (portalOrders[0]?.order_ref ?? '');
  const navParamSuffix = activeQueryOrder ? `?order=${encodeURIComponent(activeQueryOrder)}` : '';

  // If not signed in to a participant session, show Participant Sign In Card
  if (!isSignedIn) {
    return (
      <div className="page-content animate-fadeInUp">
        <div className="page-header">
          <h1 className="page-title">Participant Portal</h1>
          <p className="page-subtitle">Track your Qurban &amp; Aqiqah orders, ritual status, and digital certificates</p>
        </div>
        <ParticipantSignInCard
          title="Participant Portal Sign In"
          subtitle="Enter your registered email address or Order Reference to view your My Orders status, ritual updates, and digital certificates."
          actionLabel="Access My Orders & Certificates"
          signIn={signIn}
          isStaffUser={isStaffUser}
        />
      </div>
    );
  }

  return (
    <div className="page-content animate-fadeInUp">
      {/* ── Hero Welcome Banner ─────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #0a1a0e 0%, #12260f 40%, #0a1206 100%)',
        border: '1px solid rgba(212,168,50,0.22)',
        borderRadius: 16,
        padding: 'clamp(1.25rem, 4vw, 2rem)',
        marginBottom: '1.5rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Ambient glow decoration */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,168,50,0.12), transparent)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, left: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(47,168,118,0.1), transparent)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--aig-green-400)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {greeting} 👋
            </div>
            <button
              type="button"
              onClick={signOut}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '0.75rem', gap: '0.35rem', color: 'rgba(255,255,255,0.7)' }}
            >
              <LogOut size={13} />
              Switch Participant / Sign Out
            </button>
          </div>

          <h1 style={{
            fontSize: '1.75rem', fontWeight: 800,
            color: '#fff', margin: '0 0 0.5rem',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>
            {participantName || sessionEmail || 'Participant'}
          </h1>
          <p style={{ fontSize: '0.9375rem', color: 'rgba(255,255,255,0.65)', margin: '0 0 1.5rem', maxWidth: 520 }}>
            Welcome to your Al Ihsan Group Participant Portal. Track your registered livestock, follow ritual completion, and download your official digital certificates.
          </p>

          {/* Quick action buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link to={`/portal/orders${navParamSuffix}`} className="btn btn-primary" style={{ gap: '0.5rem' }}>
              <ShoppingCart size={15} /> My Orders ({totalOrders})
            </Link>
            <Link to={`/portal/certificates${navParamSuffix}`} className="btn btn-secondary" style={{ gap: '0.5rem' }}>
              <Award size={15} /> Certificates ({matchedCertificates.length})
            </Link>
            <Link to={`/portal/notifications${navParamSuffix}`} className="btn btn-ghost" style={{ gap: '0.5rem', position: 'relative' }}>
              <Bell size={15} />
              Notifications
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -4,
                  width: 16, height: 16, borderRadius: '50%',
                  background: 'var(--danger)', color: '#fff',
                  fontSize: '0.65rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {unreadCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* ── Staff Preview Notice (only when staff is previewing a participant's portal) ── */}
      {isStaffPreview && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.65rem',
          background: 'rgba(212,168,50,0.1)',
          border: '1px solid rgba(212,168,50,0.3)',
          padding: '0.75rem 1rem',
          borderRadius: 10,
          marginBottom: '1.5rem',
          fontSize: '0.8125rem',
          color: '#f5f0e8',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={17} color="#d4a832" style={{ flexShrink: 0 }} />
            <span>
              <strong>Staff Preview:</strong> Previewing portal for participant <strong>{participantName}</strong>{sessionEmail ? ` (${sessionEmail})` : ''}.
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={signOut}
            >
              Clear Preview
            </button>
            <Link to="/admin" className="btn btn-xs btn-outline-green" style={{ textDecoration: 'none' }}>
              Return to Admin Panel
            </Link>
          </div>
        </div>
      )}

      {/* ── Summary Stats ───────────────────────────────────── */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Orders',    value: String(totalOrders),    icon: ShoppingCart, color: 'var(--aig-green-400)' },
          { label: 'Completed',       value: String(completedOrders),  icon: CheckCircle2, color: 'var(--success)' },
          { label: 'In Progress',     value: String(inProgressOrders), icon: Clock,        color: 'var(--warning)' },
          { label: 'Total Invested',  value: `SGD ${totalSpent.toLocaleString()}`, icon: Heart, color: 'var(--gold-400, #d4a832)' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="stat-card">
              <div className="stat-icon" style={{ background: `${s.color}22`, border: `1px solid ${s.color}33` }}>
                <Icon size={18} color={s.color} />
              </div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* ── Two-column layout ───────────────────────────────── */}
      <div className="settings-grid-2" style={{ gap: '1.25rem' }}>
        {/* Left: Recent Orders */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
              Active Qurban Registrations
            </div>
            <Link to={`/portal/orders${navParamSuffix}`} style={{ fontSize: '0.8125rem', color: 'var(--aig-green-400)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {portalOrders.length === 0 ? (
            <div className="card" style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
              <ShoppingCart size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem' }} />
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                No active orders found
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', maxWidth: 420, margin: '0 auto 1.25rem' }}>
                No active bookings match this participant account. Please verify your registered email address or contact support.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {portalOrders.map(order => (
                <Link
                  key={order.id}
                  to={`/portal/orders?order=${encodeURIComponent(order.order_ref)}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div className="card card-hover" style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <AnimalPhoto type={order.animal_type} size={52} radius={12} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {order.programme}
                          </div>
                          <StatusBadge status={order.status} size="sm" />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem 0.75rem', flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                          <span style={{ fontFamily: 'monospace', color: 'var(--aig-green-300)', fontSize: '0.75rem' }}>{order.order_ref}</span>
                          <span>·</span>
                          <span>{COUNTRIES[order.country] ?? ''} {order.country}</span>
                          <span>·</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{formatCurrency(order.total_amount, order.currency)}</span>
                        </div>

                        {/* Progress bar */}
                        <div style={{ marginTop: '0.625rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                            <span>Progress</span>
                            <span>{order.progress}/5 steps</span>
                          </div>
                          <div className="progress-bar" style={{ height: 4 }}>
                            <div className="progress-fill" style={{
                              width: `${(order.progress / 5) * 100}%`,
                              background: isOrderCompleted(order.status)
                                ? 'linear-gradient(90deg, var(--aig-green-600), var(--aig-green-400))'
                                : 'linear-gradient(90deg, #d4a832, #f5c842)',
                            }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Certificate download for completed orders */}
                    {isOrderCompleted(order.status) && (
                      <div style={{ marginTop: '1rem', paddingTop: '0.875rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <Link to={`/portal/certificates?order=${encodeURIComponent(order.order_ref)}`} className="btn btn-outline-green btn-sm" style={{ gap: '0.375rem' }} onClick={e => e.stopPropagation()}>
                          <Download size={13} /> Download Certificate
                        </Link>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <CheckCircle2 size={13} /> Completed · {order.qurban_date}
                        </div>
                      </div>
                    )}

                    {/* Next milestone for in-progress */}
                    {!isOrderCompleted(order.status) && (
                      <div style={{ marginTop: '0.875rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
                        <Calendar size={13} color="var(--aig-green-400)" />
                        <span style={{ color: 'var(--text-muted)' }}>Qurban Date:</span>
                        <span style={{ fontWeight: 600, color: 'var(--aig-green-300)' }}>{order.qurban_date}</span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right: Sidebar content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Upcoming Events */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <Calendar size={16} color="var(--aig-green-400)" />
              <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>Upcoming</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {UPCOMING.map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                    background: ev.type === 'qurban' ? 'rgba(212,168,50,0.12)' : 'rgba(47,168,118,0.12)',
                    border: `1px solid ${ev.type === 'qurban' ? 'rgba(212,168,50,0.25)' : 'rgba(47,168,118,0.25)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {ev.type === 'qurban' ? <Star size={15} color="#d4a832" /> : <Award size={15} color="var(--aig-green-400)" />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-primary)', marginBottom: '0.125rem' }}>
                      {ev.label}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--aig-green-400)', fontWeight: 500 }}>
                      {ev.date}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Countries / Programmes */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <MapPin size={16} color="var(--aig-green-400)" />
              <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>Your Contributions</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {portalOrders.map(order => (
                <div key={order.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.75rem', background: 'var(--surface-700)', borderRadius: 8 }}>
                  <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{COUNTRIES[order.country] ?? '🌍'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{order.country}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{order.programme}</div>
                  </div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--aig-green-300)' }}>
                    {formatCurrency(order.total_amount, order.currency)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Motivation card */}
          <div style={{
            padding: '1.25rem',
            background: 'linear-gradient(135deg, #0d1a0e, #12260f)',
            border: '1px solid rgba(212,168,50,0.2)',
            borderRadius: 12,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🤲</div>
            <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1rem', color: '#d4a832', fontStyle: 'italic', lineHeight: 1.6, marginBottom: '0.5rem' }}>
              "Whoever offers a sacrifice after the prayer has completed the ritual and is following the way of the Muslims."
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>— Sahih al-Bukhari</div>
          </div>
        </div>
      </div>
    </div>
  );
}
