import React, { useMemo, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ShoppingCart, Clock, CheckCircle2, ChevronDown, ChevronUp, Download, Eye, Weight, ShieldCheck, LogOut } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { OrderStatus } from '@/lib/database.types';
import { AnimalPhoto } from '@/components/ui/AnimalPhoto';
import { useAppData, type AnimalWeightEntry } from '@/contexts/AppDataContext';
import { usePortalSession } from '@/hooks/usePortalSession';
import { ParticipantSignInCard } from '@/components/portal/ParticipantSignInCard';
import {
  defaultApproxWeight,
  formatDeliveryPortion,
  formatPaymentMethod,
  formatServiceType,
  isBreedingProgramme,
  normaliseName,
  summarizeOrderPortions,
} from '@/lib/orderRules';

interface PortalOrderView {
  id: string;
  order_ref: string;
  programme: string;
  service_type: string;
  payment_method?: string;
  delivery_portion?: string | null;
  supports_weight_timeline: boolean;
  certificate_ready: boolean;
  animal_type: string;
  quantity: number;
  total_amount: number;
  currency: string;
  status: OrderStatus;
  created_at: string;
  qurban_date: string;
  animals: {
    code: string;
    holder: string;
    status: string;
    portion?: string | null;
    approx_weight: string;
    current_weight_kg: number;
    weight_history: AnimalWeightEntry[];
  }[];
  steps: { label: string; done: boolean; date: string | null }[];
}

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
  const { animals, programmes, certificates, payments } = useAppData();
  const [searchParams, setSearchParams] = useSearchParams();

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

  const orderParam = (searchParams.get('order') || searchParams.get('ref') || '').trim().toUpperCase();

  const participantOrders = useMemo<PortalOrderView[]>(() => {
    return matchedOrders.map(o => {
      const linkedAnimals = animals
        .filter(a => a.order_ref === o.order_ref)
        .sort((a, b) => (a.animal_code ?? a.animal_ref).localeCompare(b.animal_code ?? b.animal_ref));
      const prog = programmes.find(p => (o.programme_id && p.id === o.programme_id) || normaliseName(p.name) === normaliseName(o.programme));
      const supportsWeightTimeline = isBreedingProgramme(o.programme, prog?.supports_weight_timeline);
      const portionSummary = summarizeOrderPortions(linkedAnimals.map(a => a.delivery_portion), o.delivery_portion);
      const hasReadyCert = certificates.some(
        c => c.order_ref === o.order_ref && ['generated', 'sent', 'regenerated'].includes(c.status),
      );
      const animalType = linkedAnimals[0]?.animal_type ?? prog?.animal_type ?? 'goat';
      const stepRank = STATUS_STEP_RANK[o.status as OrderStatus] ?? 1;
      const createdDate = formatDate(o.created_at);

      return {
        id: o.id,
        order_ref: o.order_ref,
        programme: o.programme,
        service_type: formatServiceType(o.service_type ?? 'qurban'),
        payment_method: formatPaymentMethod(o.payment_method ?? 'paynow'),
        delivery_portion: portionSummary !== '—' ? portionSummary : null,
        supports_weight_timeline: supportsWeightTimeline,
        certificate_ready: hasReadyCert || o.status === 'certificate_generated' || o.status === 'completed',
        animal_type: animalType,
        quantity: o.quantity,
        total_amount: o.total_amount,
        currency: o.currency,
        status: o.status,
        created_at: createdDate,
        qurban_date: prog?.qurban_date ? formatDate(prog.qurban_date) : '2026 Season (1447H)',
        animals: linkedAnimals.map(a => ({
          code: a.animal_code || a.animal_ref,
          holder: a.qurban_name_holder || o.participant,
          status: a.status.replace(/_/g, ' '),
          portion: formatDeliveryPortion(a.delivery_portion),
          approx_weight: a.approx_weight || defaultApproxWeight(a.animal_type),
          current_weight_kg: a.current_weight_kg || 0,
          weight_history: a.weight_history || [],
        })),
        steps: [
          { label: 'Booking Placed', done: stepRank >= 1, date: createdDate },
          { label: 'Payment Verified', done: stepRank >= 2, date: payments.find(p => p.order_ref === o.order_ref)?.verified_at ? formatDate(payments.find(p => p.order_ref === o.order_ref)!.verified_at!) : null },
          { label: 'Animal Allocated', done: stepRank >= 3, date: null },
          { label: 'Ritual Performed', done: stepRank >= 4, date: null },
          { label: 'Certificate Issued', done: stepRank >= 5, date: null },
        ],
      };
    });
  }, [matchedOrders, animals, programmes, certificates, payments]);

  const [expandedId, setExpandedId] = useState<string | null>(() => {
    if (orderParam) {
      const match = participantOrders.find(o => o.order_ref.trim().toUpperCase() === orderParam);
      if (match) return match.id;
    }
    return participantOrders[0]?.id ?? null;
  });

  useEffect(() => {
    if (orderParam && participantOrders.length > 0) {
      const match = participantOrders.find(o => o.order_ref.trim().toUpperCase() === orderParam);
      if (match) setExpandedId(match.id);
    }
  }, [orderParam, participantOrders]);

  if (!isSignedIn) {
    return (
      <div className="page-content animate-fadeInUp">
        <div className="page-header">
          <h1 className="page-title">My Orders</h1>
          <p className="page-subtitle">Track your Qurban orders and progress</p>
        </div>
        <ParticipantSignInCard
          title="Track Your Orders"
          subtitle="Enter your registered email address or Order Reference to view your order status, livestock allocation, and digital certificates."
          actionLabel="View My Orders"
          signIn={signIn}
          isStaffUser={isStaffUser}
        />
      </div>
    );
  }

  return (
    <div className="page-content animate-fadeInUp">
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <h1 className="page-title">My Orders</h1>
        <p className="page-subtitle">Track your Qurban orders and progress</p>
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

      {/* Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        {(() => {
          const isCompleted = (status: OrderStatus) => status === 'completed' || status === 'certificate_generated';
          return [
            { label: 'Total Orders', value: String(participantOrders.length), icon: ShoppingCart, color: 'var(--aig-green-400)' },
            { label: 'In Progress', value: String(participantOrders.filter(o => !isCompleted(o.status) && o.status !== 'cancelled').length), icon: Clock, color: 'var(--warning)' },
            { label: 'Completed', value: String(participantOrders.filter(o => isCompleted(o.status)).length), icon: CheckCircle2, color: 'var(--success)' },
          ];
        })().map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="stat-card">
              <div className="stat-icon" style={{ background: `${stat.color}15`, color: stat.color }}>
                <Icon size={20} />
              </div>
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          );
        })}
      </div>

      {/* Orders List */}
      {participantOrders.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><ShoppingCart size={24} color="var(--text-muted)" /></div>
            <h3>No orders found</h3>
            <p>No orders were found matching your account. Please verify your registered email address.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {participantOrders.map(order => {
            const isExpanded = expandedId === order.id;
            return (
              <div key={order.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                  style={{
                    padding: '1.25rem 1.5rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    flexWrap: 'wrap',
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <AnimalPhoto type={order.animal_type} size={48} radius={10} />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                          {order.programme}
                        </span>
                        <StatusBadge status={order.status} />
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        <span style={{ fontFamily: 'monospace', color: 'var(--gold-400)' }}>{order.order_ref}</span>
                        {' · '}Qty: {order.quantity}
                        {order.delivery_portion && ` · Portion: ${order.delivery_portion}`}
                        {' · '}Date: {order.created_at}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                        {formatCurrency(order.total_amount, order.currency)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{order.payment_method}</div>
                    </div>
                    {isExpanded ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '0 1.5rem 1.5rem', borderTop: '1px solid var(--border-color)' }}>
                    {/* Stepper */}
                    <div style={{ margin: '1.5rem 0' }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        Ritual &amp; Order Progress
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                        {order.steps.map((step, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: '0.75rem',
                              borderRadius: 8,
                              background: step.done ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
                              border: `1px solid ${step.done ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.06)'}`,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
                              <CheckCircle2 size={13} color={step.done ? 'var(--success)' : 'var(--text-muted)'} />
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: step.done ? 'var(--success)' : 'var(--text-muted)' }}>
                                {step.label}
                              </span>
                            </div>
                            {step.date && (
                              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{step.date}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Allocated animals */}
                    {order.animals.length > 0 && (
                      <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                          Allocated Livestock ({order.animals.length})
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
                          {order.animals.map((anm, idx) => (
                            <div
                              key={idx}
                              style={{
                                padding: '0.875rem',
                                borderRadius: 8,
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.08)',
                              }}
                            >
                              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--gold-400)', marginBottom: '0.25rem' }}>
                                {anm.code}
                              </div>
                              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                                In the name of: <strong>{anm.holder}</strong>
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Weight: {anm.approx_weight}
                                {anm.current_weight_kg > 0 && ` (${anm.current_weight_kg} kg verified)`}
                                {anm.portion && ` · Portion: ${anm.portion}`}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Certificate Action */}
                    {order.certificate_ready && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                        <Link
                          to={`/portal/certificates?order=${encodeURIComponent(order.order_ref)}`}
                          className="btn btn-primary btn-sm"
                          style={{ gap: '0.5rem' }}
                        >
                          <Download size={14} /> View &amp; Download Certificate
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
