import React, { useState, useCallback } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Search, MapPin, Truck, CheckCircle2, X, XCircle, Calendar } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { DeliveryStatus } from '@/lib/database.types';
import { useToast } from '@/contexts/ToastContext';
import { useAppData, type AppDelivery as Delivery, type AppOrder, type AppAnimal } from '@/contexts/AppDataContext';
import {
  formatDeliveryPortion,
  isAustraliaToSingaporeProgramme,
  isAustraliaToPalestineProgramme,
  isAustraliaOriginProgramme,
} from '@/lib/orderRules';

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


function DeliveryModal({ delivery, onClose, onUpdateStatus, onUpdate, orders, animals }: {
  delivery: Delivery;
  onClose: () => void;
  onUpdateStatus: (id: string, status: DeliveryStatus) => void;
  onUpdate: (id: string, patch: Partial<Delivery>) => void;
  orders: AppOrder[];
  animals: AppAnimal[];
}) {
  const { toast } = useToast();
  const editable = !['delivered', 'cancelled'].includes(delivery.status);
  const [scheduledDate, setScheduledDate] = useState(delivery.scheduled_date ?? '');
  const [slot, setSlot] = useState(delivery.delivery_slot ?? '');
  const [driver, setDriver] = useState(delivery.driver ?? '');
  const [phone, setPhone] = useState(delivery.contact_phone ?? '');
  const [address, setAddress] = useState(delivery.address.startsWith('Address not provided') ? '' : delivery.address);

  const linkedOrder = orders.find(o => o.order_ref === delivery.order_ref);
  const isAuSg = linkedOrder ? isAustraliaToSingaporeProgramme(linkedOrder.programme, linkedOrder.programme_country) : false;
  const isAuPs = linkedOrder ? isAustraliaToPalestineProgramme(linkedOrder.programme, linkedOrder.programme_country) : false;
  const isOtherAu = linkedOrder
    ? isAustraliaOriginProgramme(linkedOrder.programme, linkedOrder.programme_country) && !isAuSg && !isAuPs
    : false;
  const isAuOrigin = isAuSg || isAuPs || isOtherAu;
  const isNonAu = linkedOrder ? !isAuOrigin : false;

  const orderAnimals = animals.filter(a => a.order_ref === delivery.order_ref && a.delivery_portion);
  const portionLabel = (() => {
    if (orderAnimals.length > 0) {
      return orderAnimals
        .map((a, idx) => {
          const formatted = formatDeliveryPortion(a.delivery_portion);
          const pLabel = (formatted === 'NIL' && isAuPs) ? 'NIL (Palestine)' : formatted;
          return `${orderAnimals.length > 1 ? `Q${idx + 1}: ` : ''}${pLabel}`;
        })
        .join(' · ');
    }
    if (linkedOrder?.delivery_portion) {
      const formatted = formatDeliveryPortion(linkedOrder.delivery_portion);
      return (formatted === 'NIL' && isAuPs) ? 'NIL (Palestine)' : formatted;
    }
    if (isAuPs) {
      return 'NIL (Palestine)';
    }
    return isAuOrigin ? 'Full' : '—';
  })();

  const saveDetails = (thenSchedule: boolean) => {
    if (thenSchedule && (!scheduledDate || !address.trim())) {
      toast('error', 'Missing details', 'Scheduled date and delivery address are required');
      return;
    }
    onUpdate(delivery.id, {
      scheduled_date: scheduledDate || null,
      delivery_slot: slot.trim() || null,
      driver: driver.trim() || null,
      contact_phone: phone.trim(),
      address: address.trim() || delivery.address,
    });
    if (thenSchedule && delivery.status !== 'scheduled') {
      onUpdateStatus(delivery.id, 'scheduled');
      toast('success', 'Delivery scheduled', `${delivery.delivery_ref} scheduled for ${formatDate(scheduledDate)}`);
    } else {
      toast('success', 'Delivery updated', `${delivery.delivery_ref} details saved`);
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="heading-md">Delivery Details</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span>{delivery.delivery_ref} · Order {delivery.order_ref}</span>
              {isAuSg && (
                <span className="badge badge-green" style={{ fontSize: '0.62rem', padding: '0.1rem 0.4rem' }}>
                  AU → SG
                </span>
              )}
              {isAuPs && (
                <span className="badge" style={{ fontSize: '0.62rem', padding: '0.1rem 0.4rem', background: 'rgba(167, 139, 250, 0.15)', color: '#c4b5fd', border: '1px solid rgba(167, 139, 250, 0.3)' }}>
                  AU → Palestine
                </span>
              )}
              {isOtherAu && (
                <span className="badge" style={{ fontSize: '0.62rem', padding: '0.1rem 0.4rem', background: 'rgba(56, 189, 248, 0.15)', color: '#7dd3fc', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                  AU → {linkedOrder?.programme_country || 'Regional'}
                </span>
              )}
              {isNonAu && (
                <span className="badge badge-blue" style={{ fontSize: '0.62rem', padding: '0.1rem 0.4rem' }}>
                  {linkedOrder?.programme_country || 'Non-AU'}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className={`badge ${DELIVERY_STATUS_BADGE[delivery.status]}`}>{DELIVERY_STATUS_LABEL[delivery.status]}</span>
            <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
          </div>
        </div>
        <div className="modal-body">
          {editable ? (
            <div>
              <div style={{ padding: '0.625rem 0.875rem', background: 'var(--surface-700)', borderRadius: 8, marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8125rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Programme: </span>
                  <span style={{ fontWeight: 500 }}>{linkedOrder?.programme || '—'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>{isAuOrigin ? 'AU Factored Portion: ' : 'Distribution: '}</span>
                  <span style={{ fontWeight: 600, color: isAuOrigin ? (isAuPs ? '#c4b5fd' : 'var(--gold-400)') : 'var(--text-secondary)' }}>
                    {isAuOrigin ? portionLabel : 'Non-AU (Local Distribution · No portion required)'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="settings-grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="delivery-date">Scheduled Date *</label>
                  <input id="delivery-date" className="form-input" type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="delivery-slot">Time Slot</label>
                  <input id="delivery-slot" className="form-input" placeholder="e.g. 9am – 12pm" value={slot} onChange={e => setSlot(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="delivery-driver">Driver</label>
                  <input id="delivery-driver" className="form-input" placeholder="Driver name" value={driver} onChange={e => setDriver(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="delivery-phone">Recipient Phone</label>
                  <input id="delivery-phone" className="form-input" placeholder="+65 …" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label" htmlFor="delivery-address">Delivery Address *</label>
                  <textarea id="delivery-address" className="form-input" rows={2} style={{ resize: 'vertical' }} placeholder="Full delivery address" value={address} onChange={e => setAddress(e.target.value)} />
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} className="settings-grid-2">
              <div className="detail-list">
                {([
                  ['Recipient', delivery.participant],
                  ['Phone', delivery.contact_phone || '—'],
                  ['Order Ref', delivery.order_ref],
                  ['Programme', linkedOrder?.programme || '—'],
                  [
                    'Route & Region',
                    isAuSg
                      ? 'AU → SG (Australia to Singapore)'
                      : isAuPs
                        ? 'AU → Palestine (Australia origin)'
                        : isOtherAu
                          ? `AU → ${linkedOrder?.programme_country || 'Regional'} (Australia origin)`
                          : `${linkedOrder?.programme_country || 'International'} (Non-AU)`,
                  ],
                  [
                    'Portion to Deliver',
                    isAuOrigin
                      ? portionLabel
                      : 'Non-AU (Local Distribution · No portion required)',
                  ],
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
              <div style={{ padding: '0.875rem', background: 'var(--surface-700)', borderRadius: 8, fontSize: '0.8125rem', alignSelf: 'start' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <MapPin size={14} color="var(--aig-green-400)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ color: 'var(--text-secondary)' }}>{delivery.address}</div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          {editable && (
            <button className="btn btn-secondary" onClick={() => saveDetails(false)}>Save Details</button>
          )}
          {(delivery.status === 'pending' || delivery.status === 'failed' || delivery.status === 'returned') && (
            <button className="btn btn-primary" style={{ gap: '0.5rem' }} onClick={() => saveDetails(true)}>
              <Calendar size={15} /> {delivery.status === 'pending' ? 'Schedule Delivery' : 'Reschedule Delivery'}
            </button>
          )}
          {delivery.status === 'scheduled' && (
            <button className="btn btn-secondary" style={{ gap: '0.5rem', color: 'var(--aig-green-300)', borderColor: 'var(--aig-green-700)' }}
              onClick={() => { onUpdateStatus(delivery.id, 'out_for_delivery'); toast('info', 'Out for Delivery', `${delivery.delivery_ref} is now out for delivery`); onClose(); }}>
              <Truck size={15} /> Mark Out for Delivery
            </button>
          )}
          {delivery.status === 'out_for_delivery' && (
            <>
              <button className="btn btn-danger" style={{ gap: '0.5rem' }}
                onClick={() => { onUpdateStatus(delivery.id, 'failed'); toast('warning', 'Delivery failed', `${delivery.delivery_ref} marked as failed — exception raised`); onClose(); }}>
                <XCircle size={15} /> Mark Failed
              </button>
              <button className="btn btn-primary" style={{ gap: '0.5rem' }}
                onClick={() => { onUpdateStatus(delivery.id, 'delivered'); toast('success', 'Delivery Confirmed! ✓', `${delivery.delivery_ref} marked as delivered`); onClose(); }}>
                <CheckCircle2 size={15} /> Confirm Delivered
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export type DeliveryRegionFilter = 'all' | 'au_sg' | 'au_ps' | 'other_au' | 'other';

export function DeliveriesPage() {
  usePageTitle('Deliveries');
  const { toast } = useToast();
  const { deliveries, orders, animals, updateDeliveryStatus: ctxUpdateStatus, updateDelivery } = useAppData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Delivery | null>(null);

  const getDeliveryOrder = useCallback((d: Delivery) => {
    return orders.find(ord => ord.order_ref === d.order_ref);
  }, [orders]);

  const isAuSgDelivery = useCallback((d: Delivery) => {
    const o = getDeliveryOrder(d);
    return o ? isAustraliaToSingaporeProgramme(o.programme, o.programme_country) : false;
  }, [getDeliveryOrder]);

  const isAuPsDelivery = useCallback((d: Delivery) => {
    const o = getDeliveryOrder(d);
    return o ? isAustraliaToPalestineProgramme(o.programme, o.programme_country) : false;
  }, [getDeliveryOrder]);

  const isOtherAuDelivery = useCallback((d: Delivery) => {
    const o = getDeliveryOrder(d);
    if (!o) return false;
    return (
      isAustraliaOriginProgramme(o.programme, o.programme_country) &&
      !isAustraliaToSingaporeProgramme(o.programme, o.programme_country) &&
      !isAustraliaToPalestineProgramme(o.programme, o.programme_country)
    );
  }, [getDeliveryOrder]);

  const isNonAuDelivery = useCallback((d: Delivery) => {
    const o = getDeliveryOrder(d);
    if (!o) return false;
    return !isAustraliaOriginProgramme(o.programme, o.programme_country);
  }, [getDeliveryOrder]);

  const portionsForOrder = (orderRef: string): string => {
    const order = orders.find(o => o.order_ref === orderRef);
    const isPal = order ? isAustraliaToPalestineProgramme(order.programme, order.programme_country) : false;
    const orderAnimals = animals.filter(a => a.order_ref === orderRef && a.delivery_portion);
    if (orderAnimals.length > 0) {
      return orderAnimals
        .map((a, idx) => {
          const formatted = formatDeliveryPortion(a.delivery_portion);
          const pLabel = (formatted === 'NIL' && isPal) ? 'NIL (Palestine)' : formatted;
          return `${orderAnimals.length > 1 ? `Q${idx + 1}: ` : ''}${pLabel}`;
        })
        .join(' · ');
    }
    if (order?.delivery_portion) {
      const formatted = formatDeliveryPortion(order.delivery_portion);
      return (formatted === 'NIL' && isPal) ? 'NIL (Palestine)' : formatted;
    }
    if (isPal) {
      return 'NIL (Palestine)';
    }
    return '—';
  };

  const updateStatus = (id: string, status: DeliveryStatus) => {
    ctxUpdateStatus(id, status);
  };

  const [showCancelled, setShowCancelled] = useState(false);
  const [regionFilter, setRegionFilter] = useState<DeliveryRegionFilter>('all');

  const isDeliveryCancelled = useCallback((d: Delivery) => {
    if (d.status === 'cancelled') return true;
    const linkedOrder = orders.find(o => o.order_ref === d.order_ref);
    if (linkedOrder && linkedOrder.status === 'cancelled') return true;
    return false;
  }, [orders]);

  const cancelledCount = deliveries.filter(isDeliveryCancelled).length;
  const liveDeliveries = deliveries.filter(d => !isDeliveryCancelled(d));
  const auSgDeliveries = liveDeliveries.filter(isAuSgDelivery);
  const auPsDeliveries = liveDeliveries.filter(isAuPsDelivery);
  const otherAuDeliveries = liveDeliveries.filter(isOtherAuDelivery);
  const otherRegionDeliveries = liveDeliveries.filter(isNonAuDelivery);

  const filtered = deliveries.filter(d => {
    const isCancelled = isDeliveryCancelled(d);
    if (statusFilter === 'cancelled') {
      if (!isCancelled) return false;
    } else {
      if (!showCancelled && isCancelled) return false;
      if (statusFilter && d.status !== statusFilter) return false;
    }
    if (regionFilter === 'au_sg' && !isAuSgDelivery(d)) return false;
    if (regionFilter === 'au_ps' && !isAuPsDelivery(d)) return false;
    if (regionFilter === 'other_au' && !isOtherAuDelivery(d)) return false;
    if (regionFilter === 'other' && !isNonAuDelivery(d)) return false;

    const matchSearch = d.delivery_ref.toLowerCase().includes(search.toLowerCase())
      || d.participant.toLowerCase().includes(search.toLowerCase())
      || d.order_ref.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  return (
    <div className="page-content animate-fadeInUp">
      {selected && (
        <DeliveryModal
          delivery={selected}
          onClose={() => setSelected(null)}
          onUpdateStatus={updateStatus}
          onUpdate={updateDelivery}
          orders={orders}
          animals={animals}
        />
      )}

      <div className="page-header page-header-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Deliveries</h1>
          <p className="page-subtitle">Track Australia origin meat deliveries (Singapore, Palestine &amp; regional) and international distributions</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary btn-sm"
            onClick={() => {
              setStatusFilter('pending');
              const n = liveDeliveries.filter(d => d.status === 'pending').length;
              toast('info', 'Schedule Delivery', n ? `${n} deliver${n === 1 ? 'y needs' : 'ies need'} scheduling — click one to set date, driver and address` : 'No pending deliveries. Deliveries are created automatically when an order reaches "Delivery Scheduled".');
            }}>
            <Calendar size={14} />
            Schedule Delivery
          </button>
        </div>
      </div>

      {/* Stats - Segmented per Sir's requirement */}
      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        {[
          {
            label: 'AU – SG Deliveries',
            value: String(auSgDeliveries.length),
            sub: 'Australia to Singapore meat delivery',
            color: 'var(--aig-green-400)',
            onClick: () => setRegionFilter(prev => prev === 'au_sg' ? 'all' : 'au_sg'),
            isActive: regionFilter === 'au_sg',
          },
          {
            label: 'AU – Palestine Deliveries',
            value: String(auPsDeliveries.length),
            sub: 'Australia origin · Palestine & SG portion',
            color: '#c4b5fd',
            onClick: () => setRegionFilter(prev => prev === 'au_ps' ? 'all' : 'au_ps'),
            isActive: regionFilter === 'au_ps',
          },
          ...(otherAuDeliveries.length > 0 ? [{
            label: 'Other AU Regions',
            value: String(otherAuDeliveries.length),
            sub: 'Australia origin elsewhere · portion factored',
            color: '#7dd3fc',
            onClick: () => setRegionFilter(prev => prev === 'other_au' ? 'all' : 'other_au'),
            isActive: regionFilter === 'other_au',
          }] : []),
          {
            label: 'All Other Regions',
            value: String(otherRegionDeliveries.length),
            sub: 'Non-AU local distributions (No portion required)',
            color: '#60a5fa',
            onClick: () => setRegionFilter(prev => prev === 'other' ? 'all' : 'other'),
            isActive: regionFilter === 'other',
          },
          {
            label: 'Active / Scheduled',
            value: String(liveDeliveries.filter(d => d.status === 'out_for_delivery' || d.status === 'scheduled').length),
            sub: 'In transit / pending slot',
            color: 'var(--orange)',
            onClick: () => setStatusFilter(prev => prev === 'out_for_delivery' ? '' : 'out_for_delivery'),
            isActive: statusFilter === 'out_for_delivery',
          },
          {
            label: 'Total Deliveries',
            value: String(liveDeliveries.length),
            sub: cancelledCount > 0 ? `+ ${cancelledCount} cancelled` : 'All programmes & regions',
            color: 'var(--gold-400)',
            onClick: () => { setRegionFilter('all'); setStatusFilter(''); },
            isActive: regionFilter === 'all' && !statusFilter,
          },
        ].map(s => (
          <div
            key={s.label}
            className="stat-card"
            style={{
              padding: '1rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              border: s.isActive ? '1.5px solid var(--aig-green-400)' : '1px solid var(--border-subtle)',
              background: s.isActive ? 'rgba(47,168,118,0.08)' : undefined,
            }}
            onClick={s.onClick}
            title={`Click to filter by ${s.label}`}
          >
            <div className="stat-value" style={{ fontSize: '1.375rem', color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
            {s.sub && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                {s.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Region Segmentation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn btn-sm ${regionFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setRegionFilter('all')}
        >
          All Deliveries ({liveDeliveries.length})
        </button>
        <button
          type="button"
          className={`btn btn-sm ${regionFilter === 'au_sg' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setRegionFilter('au_sg')}
        >
          AU – SG Deliveries ({auSgDeliveries.length})
        </button>
        <button
          type="button"
          className={`btn btn-sm ${regionFilter === 'au_ps' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setRegionFilter('au_ps')}
        >
          AU – Palestine Deliveries ({auPsDeliveries.length})
        </button>
        <button
          type="button"
          className={`btn btn-sm ${regionFilter === 'other_au' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setRegionFilter('other_au')}
        >
          Other AU Regions ({otherAuDeliveries.length})
        </button>
        <button
          type="button"
          className={`btn btn-sm ${regionFilter === 'other' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setRegionFilter('other')}
        >
          All Other Regions ({otherRegionDeliveries.length})
        </button>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-bar">
          <Search className="search-icon" size={15} />
          <input id="deliveries-search" type="search" className="form-input" placeholder="Search deliveries..."
            value={search} onChange={e => setSearch(e.target.value)} style={{ height: 38 }} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {(['', 'pending', 'scheduled', 'out_for_delivery', 'delivered', 'failed', 'cancelled'] as const).map(s => {
            if (s === 'cancelled' && cancelledCount === 0) return null;
            return (
              <button key={s} className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter(s)}>
                {s === '' ? (!showCancelled ? 'Live Statuses' : 'All Statuses') : s === 'cancelled' ? `Cancelled (${cancelledCount})` : DELIVERY_STATUS_LABEL[s as DeliveryStatus]}
              </button>
            );
          })}
          {statusFilter !== 'cancelled' && cancelledCount > 0 && (
            <button
              type="button"
              className={`btn btn-sm ${showCancelled ? 'btn-outline-green' : 'btn-ghost'}`}
              onClick={() => setShowCancelled(s => !s)}
              data-testid="toggle-show-cancelled-deliveries-btn"
              title="Toggle whether cancelled deliveries appear in Live Deliveries"
            >
              {showCancelled ? 'Hiding Cancelled' : `+ Show ${cancelledCount} Cancelled`}
            </button>
          )}
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
                <th>Order &amp; Portion</th>
                <th>Driver</th>
                <th>Scheduled</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state" style={{ padding: '3rem 2rem' }}>
                      <div className="empty-icon"><Truck size={22} color="var(--text-muted)" /></div>
                      <h3>{deliveries.length ? 'No deliveries match your filter' : 'No deliveries yet'}</h3>
                      <p>{deliveries.length ? 'Try adjusting your search or status filter.' : 'Deliveries are generated automatically when orders reach Delivery Scheduled.'}</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(d => {
                const linkedOrder = orders.find(o => o.order_ref === d.order_ref);
                const isAuSg = isAuSgDelivery(d);
                const isAuPs = isAuPsDelivery(d);
                const isOtherAu = isOtherAuDelivery(d);
                const isNonAu = isNonAuDelivery(d);
                const isAuOrigin = isAuSg || isAuPs || isOtherAu;
                const portionStr = portionsForOrder(d.order_ref);
                return (
                  <tr key={d.id}>
                    <td><span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--aig-green-300)' }}>{d.delivery_ref}</span></td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{d.participant}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{d.contact_phone}</div>
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'monospace', color: 'var(--aig-green-300)', fontWeight: 600 }}>{d.order_ref}</span>
                        {isAuSg && (
                          <span className="badge badge-green" style={{ fontSize: '0.62rem', padding: '0.1rem 0.4rem' }}>
                            AU → SG
                          </span>
                        )}
                        {isAuPs && (
                          <span className="badge" style={{ fontSize: '0.62rem', padding: '0.1rem 0.4rem', background: 'rgba(167, 139, 250, 0.15)', color: '#c4b5fd', border: '1px solid rgba(167, 139, 250, 0.3)' }}>
                            AU → Palestine
                          </span>
                        )}
                        {isOtherAu && (
                          <span className="badge" style={{ fontSize: '0.62rem', padding: '0.1rem 0.4rem', background: 'rgba(56, 189, 248, 0.15)', color: '#7dd3fc', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                            AU → {linkedOrder?.programme_country || 'Regional'}
                          </span>
                        )}
                        {isNonAu && (
                          <span className="badge badge-blue" style={{ fontSize: '0.62rem', padding: '0.1rem 0.4rem' }}>
                            {linkedOrder?.programme_country || 'Other Region'}
                          </span>
                        )}
                      </div>
                      {isAuOrigin ? (
                        portionStr !== '—' && (
                          <div style={{ fontSize: '0.72rem', color: isAuPs ? '#c4b5fd' : 'var(--gold-400)', marginTop: 2, fontWeight: 500 }}>
                            Portion: {portionStr}
                          </div>
                        )
                      ) : (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          Non-AU (Local Distribution · No portion required)
                        </div>
                      )}
                    </td>
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
                );
              })}
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
