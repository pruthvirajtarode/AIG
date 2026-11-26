import React, { useMemo, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ShoppingCart, Clock, CheckCircle2, ChevronDown, ChevronUp, Download, Eye, Weight, ShieldCheck } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { OrderStatus } from '@/lib/database.types';
import { AnimalPhoto } from '@/components/ui/AnimalPhoto';
import { useAuth } from '@/contexts/AuthContext';
import { useAppData, type AnimalWeightEntry } from '@/contexts/AppDataContext';
import {
  defaultApproxWeight,
  formatDeliveryPortion,
  formatPaymentMethod,
  formatServiceType,
  isBreedingProgramme,
  normaliseEmail,
  normaliseName,
  participantFullName,
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
  const { user, profile, isStaff } = useAuth();
  const { orders, animals, programmes, participants, certificates } = useAppData();
  const [searchParams, setSearchParams] = useSearchParams();

  const isStaffUser = Boolean(isStaff() || (profile?.role && profile.role !== 'participant'));
  const orderParam = (searchParams.get('order') || searchParams.get('ref') || '').trim().toUpperCase();

  const participantOrders = useMemo<PortalOrderView[]>(() => {
    const authEmail = normaliseEmail(profile?.email ?? user?.email);
    const authName = normaliseName(profile ? `${profile.first_name} ${profile.last_name}` : '');
    const matchedParticipant = authEmail
      ? participants.find(p => normaliseEmail(p.email) === authEmail)
      : undefined;

    const queriedOrder = orderParam
      ? orders.find(o => o.order_ref.trim().toUpperCase() === orderParam)
      : undefined;

    let realOrders = orders.filter(o => {
      if (queriedOrder && o.id === queriedOrder.id) return true;
      if (queriedOrder && queriedOrder.participant_id && o.participant_id === queriedOrder.participant_id) return true;
      if (matchedParticipant && o.participant_id === matchedParticipant.id) return true;
      if (authEmail && o.email && normaliseEmail(o.email) === authEmail) return true;
      if (matchedParticipant && normaliseName(o.participant) === normaliseName(participantFullName(matchedParticipant))) return true;
      if (!isStaffUser && authName && authName !== 'demo admin' && normaliseName(o.participant) === authName) return true;
      return false;
    });

    if (realOrders.length === 0 && queriedOrder) {
      realOrders = [queriedOrder];
    } else if (realOrders.length === 0 && isStaffUser && orders.length > 0) {
      realOrders = orders.filter(o => o.status !== 'cancelled');
    }

    // If an order was specifically queried, ensure it is first in the list
    if (queriedOrder && realOrders.length > 1) {
      realOrders = [queriedOrder, ...realOrders.filter(o => o.id !== queriedOrder.id)];
    }

    return realOrders.map(o => {
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
      const stepRank = STATUS_STEP_RANK[o.status] ?? 1;
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
        created_at: o.created_at,
        qurban_date: prog?.qurban_date ? formatDate(prog.qurban_date) : '2026 Season (1447H)',
        animals: linkedAnimals.map(a => ({
          code: a.animal_code || a.animal_ref,
          holder: a.qurban_name_holder || o.participant,
          status: a.status,
          portion: a.delivery_portion ? formatDeliveryPortion(a.delivery_portion) : null,
          approx_weight: a.approx_weight || prog?.approx_weight_label || defaultApproxWeight(a.programme || o.programme, a.animal_type),
          current_weight_kg: a.current_weight_kg,
          weight_history: a.weight_history ?? [],
        })),
        steps: [
          { label: 'Order Placed', done: stepRank >= 1, date: createdDate },
          { label: 'Payment Verified', done: stepRank >= 2, date: stepRank >= 2 ? createdDate : null },
          { label: 'Animal Allocated', done: stepRank >= 3, date: null },
          { label: 'Qurban Performed', done: stepRank >= 4, date: null },
          { label: 'Certificate Issued', done: stepRank >= 5 || hasReadyCert, date: null },
        ],
      };
    });
  }, [user, profile, orders, animals, programmes, participants, certificates, orderParam, isStaffUser]);

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

  return (
    <div className="page-content animate-fadeInUp">
      <div className="page-header">
        <h1 className="page-title">My Orders</h1>
        <p className="page-subtitle">Track your Qurban orders and progress</p>
      </div>

      {/* Staff Preview notice */}
      {isStaffUser && orderParam && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.65rem',
          background: 'rgba(34,197,94,0.1)',
          border: '1px solid rgba(34,197,94,0.3)',
          padding: '0.75rem 1rem',
          borderRadius: 10,
          marginBottom: '1.5rem',
          fontSize: '0.8125rem',
          color: 'var(--success)',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={17} style={{ flexShrink: 0 }} />
            <span>
              <strong>Staff Preview:</strong> Showing order details for Order <code>{orderParam}</code>.
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={() => setSearchParams({})}
            >
              All Orders
            </button>
            <Link to="/admin/orders" className="btn btn-xs btn-outline-green" style={{ textDecoration: 'none' }}>
              Back to Admin Orders
            </Link>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        {(() => {
          const isCompleted = (status: OrderStatus) => status === 'completed' || status === 'certificate_generated';
          return [
            { label: 'Total Orders', value: String(participantOrders.length), icon: ShoppingCart, color: 'var(--aig-green-400)' },
            { label: 'In Progress', value: String(participantOrders.filter(o => !isCompleted(o.status) && o.status !== 'cancelled').length), icon: Clock, color: 'var(--warning)' },
            { label: 'Completed', value: String(participantOrders.filter(o => isCompleted(o.status)).length), icon: CheckCircle2, color: 'var(--success)' },
          ];
        })().map(s => {
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
      {participantOrders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', background: 'var(--surface-700)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem',
          }}>
            <ShoppingCart size={24} color="var(--text-muted)" />
          </div>
          <div className="heading-md" style={{ marginBottom: '0.5rem' }}>No Orders Placed Yet</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: 420, margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
            Your 2026 Qurban and Aqiqah orders will appear here once submitted. You will be able to track livestock fulfillment, animal weights, and certificate status.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {participantOrders.map(order => (
          <div key={order.id} className="card">
            {/* Header */}
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', cursor: 'pointer' }}
              onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0, flex: '1 1 220px' }}>
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
                  <div style={{ marginBottom: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: '0.625rem' }}>
                    {order.animals.map((a, idx) => (
                      <div key={a.code} style={{ padding: '0.75rem 0.875rem', background: 'var(--surface-700)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Qurban {idx + 1}</span>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--aig-green-300)' }}>{a.code}</span>
                        </div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>{a.holder}</div>
                        {a.portion && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--aig-green-300)', marginBottom: '0.25rem' }}>
                            Portion: <strong>{a.portion}</strong>
                          </div>
                        )}
                        {order.supports_weight_timeline ? (
                          <div style={{ marginTop: '0.375rem', paddingTop: '0.375rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--aig-green-300)', fontWeight: 600, marginBottom: '0.25rem' }}>
                              <Weight size={11} />
                              <span>
                                Weight Updates: {a.current_weight_kg > 0 ? `${a.current_weight_kg} kg` : a.approx_weight}
                              </span>
                            </div>
                            {a.weight_history.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', color: 'var(--text-muted)' }}>
                                {a.weight_history.map((w, wi) => (
                                  <div key={wi} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{w.weight_kg} kg{w.notes ? ` · ${w.notes}` : ''}</span>
                                    <span>{formatDate(w.recorded_at)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ color: 'var(--text-muted)' }}>Monthly breeding weight updates will appear here.</div>
                            )}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Weight size={11} />
                            <span>{a.approx_weight}</span>
                          </div>
                        )}
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

                {order.certificate_ready && (
                  <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <Link to={`/portal/certificates?order=${order.order_ref}`} className="btn btn-outline-green btn-sm">
                      <Download size={14} />
                      Download Certificate (PDF)
                    </Link>
                    <Link to={`/portal/certificates?order=${order.order_ref}`} className="btn btn-ghost btn-sm">
                      <Eye size={14} />
                      View Certificate
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
