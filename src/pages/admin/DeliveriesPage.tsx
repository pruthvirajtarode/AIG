import React, { useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Search, MapPin, Truck, CheckCircle2, Clock, X, Calendar } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { DeliveryStatus } from '@/lib/database.types';
import { useToast } from '@/contexts/ToastContext';
import { useAppData, type AppDelivery as Delivery } from '@/contexts/AppDataContext';

const DELIVERY_STATUS_BADGE: Record<DeliveryStatus, string> = {
  pending:         'badge-gray',
  scheduled:       'badge-blue',
  out_for_delivery:'badge-orange',
  delivered:       'badge-green',
  failed:          'badge-red',
  returned:        'badge-red',
  cancelled:       'badge-gray',
};

const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  pending:         'Pending',
  scheduled:       'Scheduled',
  out_for_delivery:'Out for Delivery',
  delivered:       'Delivered',
  failed:          'Failed',
  returned:        'Returned',
  cancelled:       'Cancelled',
};


function DeliveryModal({ delivery, onClose, onUpdateStatus }: {
  delivery: Delivery;
  onClose: () => void;
  onUpdateStatus: (id: string, status: DeliveryStatus) => void;
}) {
  const { toast } = useToast();
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="heading-md">Delivery Details</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{delivery.delivery_ref}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} className="settings-grid-2">
            <div className="detail-list">
              {([
                ['Delivery Ref', delivery.delivery_ref],
                ['Order', delivery.order_ref],
                ['Recipient', delivery.participant],
                ['Phone', delivery.contact_phone],
                ['Driver', delivery.driver || '—'],
                ['Slot', delivery.delivery_slot || '—'],
                ['Scheduled', delivery.scheduled_date ? formatDate(delivery.scheduled_date) : '—'],
                ['Delivered', delivery.delivered_at ? formatDate(delivery.delivered_at) : '—'],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="detail-row">
                  <div className="detail-key">{k}</div>
                  <div className="detail-val">{v}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Status</div>
                <span className={`badge ${DELIVERY_STATUS_BADGE[delivery.status]}`}>{DELIVERY_STATUS_LABEL[delivery.status]}</span>
              </div>
              <div style={{ padding: '0.875rem', background: 'var(--surface-700)', borderRadius: 8, fontSize: '0.8125rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <MapPin size={14} color="var(--aig-green-400)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ color: 'var(--text-secondary)' }}>{delivery.address}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          {delivery.status === 'scheduled' && (
            <button className="btn btn-secondary" style={{ gap: '0.5rem', color: 'var(--aig-green-300)', borderColor: 'var(--aig-green-700)' }}
              onClick={() => { onUpdateStatus(delivery.id, 'out_for_delivery'); toast('info', 'Out for Delivery', `${delivery.delivery_ref} is now out for delivery`); onClose(); }}>
              <Truck size={15} /> Mark Out for Delivery
            </button>
          )}
          {delivery.status === 'out_for_delivery' && (
            <button className="btn btn-primary" style={{ gap: '0.5rem' }}
              onClick={() => { onUpdateStatus(delivery.id, 'delivered'); toast('success', 'Delivery Confirmed! ✓', `${delivery.delivery_ref} marked as delivered`); onClose(); }}>
              <CheckCircle2 size={15} /> Confirm Delivered
            </button>
          )}
          {delivery.status === 'failed' && (
            <button className="btn btn-secondary" style={{ gap: '0.5rem' }}
              onClick={() => { onUpdateStatus(delivery.id, 'scheduled'); toast('info', 'Rescheduled', `${delivery.delivery_ref} rescheduled for re-delivery`); onClose(); }}>
              <Calendar size={15} /> Reschedule Delivery
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function DeliveriesPage() {
  usePageTitle('Deliveries');
  const { toast } = useToast();
  const { deliveries, updateDeliveryStatus: ctxUpdateStatus } = useAppData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Delivery | null>(null);

  const updateStatus = (id: string, status: DeliveryStatus) => {
    ctxUpdateStatus(id, status);
  };

  const filtered = deliveries.filter(d => {
    const matchSearch = d.delivery_ref.toLowerCase().includes(search.toLowerCase())
      || d.participant.toLowerCase().includes(search.toLowerCase())
      || d.order_ref.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="page-content animate-fadeInUp">
      {selected && (
        <DeliveryModal
          delivery={selected}
          onClose={() => setSelected(null)}
          onUpdateStatus={updateStatus}
        />
      )}

      <div className="page-header page-header-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Deliveries</h1>
          <p className="page-subtitle">Track all Qurban meat deliveries</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary btn-sm"
            onClick={() => toast('info', 'Schedule Delivery', 'Open a pending order and use the scheduling form to assign a driver and time slot')}>
            <Calendar size={14} />
            Schedule Delivery
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        {[
          { label: 'Total Deliveries',  value: String(deliveries.length), color: 'var(--aig-green-400)' },
          { label: 'Active Today',      value: String(deliveries.filter(d => d.status === 'out_for_delivery' || d.status === 'scheduled').length), color: 'var(--orange)' },
          { label: 'Delivered',         value: String(deliveries.filter(d => d.status === 'delivered').length), color: 'var(--success)' },
          { label: 'Failed',            value: String(deliveries.filter(d => d.status === 'failed').length), color: 'var(--danger)' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ padding: '1rem' }}>
            <div className="stat-value" style={{ fontSize: '1.375rem', color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-bar">
          <Search className="search-icon" size={15} />
          <input id="deliveries-search" type="search" className="form-input" placeholder="Search deliveries..."
            value={search} onChange={e => setSearch(e.target.value)} style={{ height: 38 }} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(['', 'pending', 'scheduled', 'out_for_delivery', 'delivered', 'failed'] as const).map(s => (
            <button key={s} className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter(s)}>
              {s === '' ? 'All' : DELIVERY_STATUS_LABEL[s as DeliveryStatus]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Delivery Ref</th>
                <th>Recipient</th>
                <th>Order</th>
                <th>Driver</th>
                <th>Scheduled</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id}>
                  <td><span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--aig-green-300)' }}>{d.delivery_ref}</span></td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{d.participant}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{d.contact_phone}</div>
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{d.order_ref}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{d.driver || '—'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    {d.scheduled_date ? formatDate(d.scheduled_date) : '—'}
                    {d.delivery_slot && <div style={{ fontSize: '0.7rem' }}>{d.delivery_slot}</div>}
                  </td>
                  <td><span className={`badge ${DELIVERY_STATUS_BADGE[d.status]}`}>{DELIVERY_STATUS_LABEL[d.status]}</span></td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => setSelected(d)}>
                      <Truck size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0.875rem 1.25rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Showing {filtered.length} of {deliveries.length} deliveries
        </div>
      </div>
    </div>
  );
}
