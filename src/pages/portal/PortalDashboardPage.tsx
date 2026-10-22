import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  ShoppingCart, Award, Bell, CheckCircle2, Clock,
  ArrowRight, Calendar, MapPin, Download, Star, Heart,
} from 'lucide-react';
import { AnimalPhoto } from '@/components/ui/AnimalPhoto';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatCurrency } from '@/lib/utils';
import type { OrderStatus } from '@/lib/database.types';

// ── Mock data (matches PortalOrdersPage data) ─────────────────
const PARTICIPANT_NAME = 'Ahmad Rizal';

const ORDERS = [
  {
    id: 'o1',
    order_ref: 'AIG-2025-000158',
    programme: 'Cow Share — Somalia',
    animal_type: 'cow',
    total_amount: 850,
    currency: 'SGD',
    status: 'payment_verified' as OrderStatus,
    qurban_date: '28 Jun 2025',
    country: 'Somalia',
    progress: 2,   // of 5 steps
  },
  {
    id: 'o2',
    order_ref: 'AIG-2025-000110',
    programme: 'Goat — Malaysia',
    animal_type: 'goat',
    total_amount: 840,
    currency: 'SGD',
    status: 'completed' as OrderStatus,
    qurban_date: '30 Jun 2024',
    country: 'Malaysia',
    progress: 5,
  },
];

const NOTIFICATIONS_UNREAD = 2;

const UPCOMING = [
  { date: '28 Jun 2025', label: 'Qurban Day — Somalia Programme', type: 'qurban' },
  { date: '01 Jul 2025', label: 'Certificate Distribution', type: 'cert' },
];

const COUNTRIES: Record<string, string> = {
  Somalia: '🇸🇴',
  Malaysia: '🇲🇾',
  Turkey: '🇹🇷',
  Palestine: '🇵🇸',
  Bangladesh: '🇧🇩',
};

export function PortalDashboardPage() {
  usePageTitle('My Portal');
  const [greeting] = useState(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  });

  const totalOrders   = ORDERS.length;
  const completedOrders = ORDERS.filter(o => o.status === 'completed').length;
  const inProgressOrders = ORDERS.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length;
  const totalSpent = ORDERS.reduce((a, o) => a + o.total_amount, 0);

  return (
    <div className="page-content animate-fadeInUp">

      {/* ── Hero Welcome Banner ─────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #0a1a0e 0%, #12260f 40%, #0a1206 100%)',
        border: '1px solid rgba(212,168,50,0.18)',
        borderRadius: 16,
        padding: '2rem 2rem 1.75rem',
        marginBottom: '1.5rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Ambient glow decoration */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,168,50,0.12), transparent)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, left: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(47,168,118,0.1), transparent)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative' }}>
          {/* Greeting */}
          <div style={{ fontSize: '0.8125rem', color: 'var(--aig-green-400)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.375rem' }}>
            {greeting} 👋
          </div>
          <h1 style={{
            fontSize: '1.75rem', fontWeight: 800,
            color: '#fff', margin: '0 0 0.5rem',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>
            {PARTICIPANT_NAME}
          </h1>
          <p style={{ fontSize: '0.9375rem', color: 'rgba(255,255,255,0.55)', margin: '0 0 1.5rem', maxWidth: 480 }}>
            Welcome to your Qurban portal. Track your orders, download certificates, and stay updated on your contributions.
          </p>

          {/* Quick action buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link to="/portal/orders" className="btn btn-primary" style={{ gap: '0.5rem' }}>
              <ShoppingCart size={15} /> My Orders
            </Link>
            <Link to="/portal/certificates" className="btn btn-secondary" style={{ gap: '0.5rem' }}>
              <Award size={15} /> Certificates
            </Link>
            <Link to="/portal/notifications" className="btn btn-ghost" style={{ gap: '0.5rem', position: 'relative' }}>
              <Bell size={15} />
              Notifications
              {NOTIFICATIONS_UNREAD > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -4,
                  width: 16, height: 16, borderRadius: '50%',
                  background: 'var(--danger)', color: '#fff',
                  fontSize: '0.65rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {NOTIFICATIONS_UNREAD}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.25rem' }} className="settings-grid-2">

        {/* Left: Recent Orders */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>My Orders</div>
            <Link to="/portal/orders" className="btn btn-ghost btn-sm" style={{ gap: '0.375rem' }}>
              View All <ArrowRight size={13} />
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {ORDERS.map(order => (
              <Link
                key={order.id}
                to="/portal/orders"
                style={{ textDecoration: 'none', display: 'block' }}
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
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
                            background: order.status === 'completed'
                              ? 'linear-gradient(90deg, var(--aig-green-600), var(--aig-green-400))'
                              : 'linear-gradient(90deg, #d4a832, #f5c842)',
                          }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Certificate download for completed orders */}
                  {order.status === 'completed' && (
                    <div style={{ marginTop: '1rem', paddingTop: '0.875rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '0.75rem' }}>
                      <Link to="/portal/certificates" className="btn btn-outline-green btn-sm" style={{ gap: '0.375rem' }} onClick={e => e.stopPropagation()}>
                        <Download size={13} /> Download Certificate
                      </Link>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <CheckCircle2 size={13} /> Completed {order.qurban_date}
                      </div>
                    </div>
                  )}

                  {/* Next milestone for in-progress */}
                  {order.status !== 'completed' && (
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
              {ORDERS.map(order => (
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
