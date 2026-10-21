import React, { useState } from 'react';
import { ShoppingCart, Clock, CheckCircle2, ChevronDown, ChevronUp, Download, Eye } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { OrderStatus } from '@/lib/database.types';

const PARTICIPANT_ORDERS = [
  {
    id: 'o1',
    order_ref: 'AIG-2025-000158',
    programme: 'Cow Share — Somalia',
    animal_type: '🐄',
    quantity: 1,
    total_amount: 850,
    currency: 'SGD',
    status: 'payment_verified' as OrderStatus,
    created_at: '2025-05-14T08:22:00Z',
    qurban_date: '28 Jun 2025',
    steps: [
      { label: 'Order Placed', done: true, date: '14 May 2025' },
      { label: 'Payment Verified', done: true, date: '14 May 2025' },
      { label: 'Animal Allocated', done: false, date: null },
      { label: 'Qurban Performed', done: false, date: null },
      { label: 'Certificate Issued', done: false, date: null },
    ],
  },
  {
    id: 'o2',
    order_ref: 'AIG-2025-000110',
    programme: 'Goat — Malaysia',
    animal_type: '🐐',
    quantity: 2,
    total_amount: 840,
    currency: 'SGD',
    status: 'completed' as OrderStatus,
    created_at: '2024-06-10T09:00:00Z',
    qurban_date: '30 Jun 2024',
    steps: [
      { label: 'Order Placed', done: true, date: '10 Jun 2024' },
      { label: 'Payment Verified', done: true, date: '11 Jun 2024' },
      { label: 'Animal Allocated', done: true, date: '15 Jun 2024' },
      { label: 'Qurban Performed', done: true, date: '30 Jun 2024' },
      { label: 'Certificate Issued', done: true, date: '01 Jul 2024' },
    ],
  },
];

export function PortalOrdersPage() {
  const [expandedId, setExpandedId] = useState<string | null>('o1');

  return (
    <div className="page-content animate-fadeInUp">
      <div className="page-header">
        <h1 className="page-title">My Orders</h1>
        <p className="page-subtitle">Track your Qurban orders and progress</p>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Orders', value: String(PARTICIPANT_ORDERS.length), icon: ShoppingCart, color: 'var(--aig-green-400)' },
          { label: 'In Progress', value: String(PARTICIPANT_ORDERS.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length), icon: Clock, color: 'var(--warning)' },
          { label: 'Completed', value: String(PARTICIPANT_ORDERS.filter(o => o.status === 'completed').length), icon: CheckCircle2, color: 'var(--success)' },
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

      {/* Order Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {PARTICIPANT_ORDERS.map(order => (
          <div key={order.id} className="card">
            {/* Header */}
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '2rem' }}>{order.animal_type}</span>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{order.programme}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    <span style={{ fontFamily: 'monospace', color: 'var(--aig-green-300)' }}>{order.order_ref}</span>
                    <span>·</span>
                    <span>{formatDate(order.created_at)}</span>
                    <span>·</span>
                    <span>{formatCurrency(order.total_amount, order.currency)}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <StatusBadge status={order.status} size="sm" />
                {expandedId === order.id ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
              </div>
            </div>

            {/* Expanded Progress */}
            {expandedId === order.id && (
              <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ marginBottom: '1.25rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Qurban Date: <strong style={{ color: 'var(--aig-green-300)' }}>{order.qurban_date}</strong>
                </div>

                {/* Progress Steps */}
                <div style={{ position: 'relative', paddingLeft: '2rem' }}>
                  {order.steps.map((step, i) => (
                    <div key={i} style={{ position: 'relative', paddingBottom: i < order.steps.length - 1 ? '1.5rem' : 0 }}>
                      {/* Connector line */}
                      {i < order.steps.length - 1 && (
                        <div style={{
                          position: 'absolute',
                          left: -22,
                          top: 24,
                          bottom: 0,
                          width: 2,
                          background: step.done ? 'var(--aig-green-600)' : 'var(--border-subtle)',
                        }} />
                      )}
                      {/* Dot */}
                      <div style={{
                        position: 'absolute',
                        left: -30,
                        top: 2,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: step.done ? 'var(--aig-green-500)' : 'var(--surface-600)',
                        border: `2px solid ${step.done ? 'var(--aig-green-400)' : 'var(--border-default)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {step.done && <CheckCircle2 size={10} color="#fff" />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '0.875rem', color: step.done ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {step.label}
                        </div>
                        {step.date && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{step.date}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {order.status === 'completed' && (
                  <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
                    <button className="btn btn-outline-green btn-sm">
                      <Download size={14} />
                      Download Certificate
                    </button>
                    <button className="btn btn-ghost btn-sm">
                      <Eye size={14} />
                      View Details
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
