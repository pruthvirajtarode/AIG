import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ShoppingCart, Clock, CheckCircle2, ChevronDown, ChevronUp, Download, Eye } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { OrderStatus } from '@/lib/database.types';
import { AnimalPhoto } from '@/components/ui/AnimalPhoto';
import { useAuth } from '@/contexts/AuthContext';
import { useAppData } from '@/contexts/AppDataContext';
import {
  formatDeliveryPortion,
  formatPaymentMethod,
  formatServiceType,
  normaliseEmail,
  normaliseName,
  participantFullName,
} from '@/lib/orderRules';

interface PortalOrderView {
  id: string;
  order_ref: string;
  programme: string;
  service_type: string;
  payment_method?: string;
  delivery_portion?: string | null;
  animal_type: string;
  quantity: number;
  total_amount: number;
  currency: string;
  status: OrderStatus;
  created_at: string;
  qurban_date: string;
  animals: { code: string; holder: string; status: string }[];
  steps: { label: string; done: boolean; date: string | null }[];
}

const DEMO_PARTICIPANT_ORDERS: PortalOrderView[] = [
  {
    id: 'o1',
    order_ref: 'AIG-2025-000158',
    programme: 'Cow Share — Somalia',
    service_type: 'Qurban',
    animal_type: 'cow',
    quantity: 1,
    total_amount: 850,
    currency: 'SGD',
    status: 'payment_verified' as OrderStatus,
    created_at: '2025-05-14T08:22:00Z',
    qurban_date: '28 Jun 2025',
    animals: [],
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
    service_type: 'Qurban',
    animal_type: 'goat',
    quantity: 2,
    total_amount: 840,
    currency: 'SGD',
    status: 'completed' as OrderStatus,
    created_at: '2024-06-10T09:00:00Z',
    qurban_date: '30 Jun 2024',
    animals: [],
    steps: [
      { label: 'Order Placed', done: true, date: '10 Jun 2024' },
      { label: 'Payment Verified', done: true, date: '11 Jun 2024' },
      { label: 'Animal Allocated', done: true, date: '15 Jun 2024' },
      { label: 'Qurban Performed', done: true, date: '30 Jun 2024' },
      { label: 'Certificate Issued', done: true, date: '01 Jul 2024' },
    ],
  },
];

const STATUS_STEP_RANK: Partial<Record<OrderStatus, number>> = {
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

export function PortalOrdersPage() {
  usePageTitle('My Orders');
  const { user, profile } = useAuth();
  const { orders, animals, programmes, participants } = useAppData();

  const participantOrders = useMemo<PortalOrderView[]>(() => {
    const authEmail = normaliseEmail(profile?.email ?? user?.email);
    const authName = normaliseName(profile ? `${profile.first_name} ${profile.last_name}` : '');
    const matchedParticipant = authEmail
      ? participants.find(p => normaliseEmail(p.email) === authEmail)
      : undefined;

    const realOrders = orders.filter(o => {
      if (matchedParticipant && o.participant_id === matchedParticipant.id) return true;
      if (authEmail && o.email && normaliseEmail(o.email) === authEmail) return true;
      if (matchedParticipant && normaliseName(o.participant) === normaliseName(participantFullName(matchedParticipant))) return true;
      if (authName && authName !== 'demo admin' && normaliseName(o.participant) === authName) return true;
      return false;
    });

    if (realOrders.length === 0) return DEMO_PARTICIPANT_ORDERS;

    return realOrders.map(o => {
      const linkedAnimals = animals
        .filter(a => a.order_ref === o.order_ref)
        .sort((a, b) => (a.animal_code ?? a.animal_ref).localeCompare(b.animal_code ?? b.animal_ref));
      const prog = programmes.find(p => (o.programme_id && p.id === o.programme_id) || normaliseName(p.name) === normaliseName(o.programme));
      const animalType = linkedAnimals[0]?.animal_type ?? prog?.animal_type ?? 'goat';
      const stepRank = STATUS_STEP_RANK[o.status] ?? 1;
      const createdDate = formatDate(o.created_at);
      return {
        id: o.id,
        order_ref: o.order_ref,
        programme: o.programme,
        service_type: formatServiceType(o.service_type ?? 'qurban'),
        payment_method: formatPaymentMethod(o.payment_method ?? 'paynow'),
        delivery_portion: o.delivery_portion ? formatDeliveryPortion(o.delivery_portion) : null,
        animal_type: animalType,
        quantity: o.quantity,
        total_amount: o.total_amount,
        currency: o.currency,
        status: o.status,
        created_at: o.created_at,
        qurban_date: prog?.qurban_date ? formatDate(prog.qurban_date) : '2026 Season (1447H)',
        animals: linkedAnimals.map(a => ({
          code: a.animal_code || a.animal_ref,
          holder: a.qurban_name_holder || o.participant,
          status: a.status,
        })),
        steps: [
          { label: 'Order Placed', done: stepRank >= 1, date: createdDate },
          { label: 'Payment Verified', done: stepRank >= 2, date: stepRank >= 2 ? createdDate : null },
          { label: 'Animal Allocated', done: stepRank >= 3, date: null },
          { label: 'Qurban Performed', done: stepRank >= 4, date: null },
          { label: 'Certificate Issued', done: stepRank >= 5, date: null },
        ],
      };
    });
  }, [user, profile, orders, animals, programmes, participants]);

  const [expandedId, setExpandedId] = useState<string | null>(() => participantOrders[0]?.id ?? null);

  return (
    <div className="page-content animate-fadeInUp">
      <div className="page-header">
        <h1 className="page-title">My Orders</h1>
        <p className="page-subtitle">Track your Qurban orders and progress</p>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Orders', value: String(participantOrders.length), icon: ShoppingCart, color: 'var(--aig-green-400)' },
          { label: 'In Progress', value: String(participantOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length), icon: Clock, color: 'var(--warning)' },
          { label: 'Completed', value: String(participantOrders.filter(o => o.status === 'completed').length), icon: CheckCircle2, color: 'var(--success)' },
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
        {participantOrders.map(order => (
          <div key={order.id} className="card">
            {/* Header */}
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <AnimalPhoto type={order.animal_type} size={56} radius={12} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{order.programme}</span>
                    <span className={`badge ${order.service_type === 'Aqiqah' ? 'badge-blue' : 'badge-green'}`} style={{ fontSize: '0.6875rem' }}>
                      {order.service_type}
                    </span>
                    <span className="badge badge-gray" style={{ fontSize: '0.6875rem' }}>
                      {order.quantity} {order.quantity === 1 ? 'Qurban' : 'Qurbans'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', fontSize: '0.8125rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'monospace', color: 'var(--aig-green-300)' }}>{order.order_ref}</span>
                    <span>·</span>
                    <span>{formatDate(order.created_at)}</span>
                    <span>·</span>
                    <span>{formatCurrency(order.total_amount, order.currency)}</span>
                    {order.delivery_portion && (
                      <>
                        <span>·</span>
                        <span>Portion: {order.delivery_portion}</span>
                      </>
                    )}
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
                  {order.payment_method && (
                    <span style={{ marginLeft: '1rem' }}>
                      Payment: <strong style={{ color: 'var(--text-secondary)' }}>{order.payment_method}</strong>
                    </span>
                  )}
                </div>

                {order.animals.length > 0 && (
                  <div style={{ marginBottom: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.625rem' }}>
                    {order.animals.map((a, idx) => (
                      <div key={a.code} style={{ padding: '0.625rem 0.875rem', background: 'var(--surface-700)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Qurban {idx + 1}</span>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--aig-green-300)' }}>{a.code}</span>
                        </div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{a.holder}</div>
                      </div>
                    ))}
                  </div>
                )}

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
                    <Link to="/portal/certificates" className="btn btn-outline-green btn-sm">
                      <Download size={14} />
                      Download Certificate
                    </Link>
                    <Link to="/portal/certificates" className="btn btn-ghost btn-sm">
                      <Eye size={14} />
                      View Details
                    </Link>
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
