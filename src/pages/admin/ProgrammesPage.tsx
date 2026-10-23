import React, { useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Search, Plus, Globe, X } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { AnimalType, DistributionMethod } from '@/lib/database.types';
import { AnimalPhoto } from '@/components/ui/AnimalPhoto';
import { useToast } from '@/contexts/ToastContext';
import { useAppData, uid, type AppProgramme } from '@/contexts/AppDataContext';

const DISTRIBUTION_LABEL: Record<DistributionMethod, string> = {
  local_distribution: 'Local Distribution',
  air_freight: 'Air Freight',
  sea_freight: 'Sea Freight',
  direct_delivery: 'Direct Delivery',
  pickup: 'Pickup',
};

const ANIMAL_EMOJI: Record<AnimalType, string> = { cow: '🐄', goat: '🐐', sheep: '🐑', lamb: '🐑', camel: '🐪', buffalo: '🐃' };

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function ProgrammeModal({ programme, onClose }: { programme?: AppProgramme; onClose: () => void }) {
  const isNew = !programme;
  const { toast } = useToast();
  const { programmes, addProgramme, updateProgramme } = useAppData();
  const [name, setName] = useState(programme?.name ?? '');
  const [country, setCountry] = useState(programme?.country ?? '');
  const [animalType, setAnimalType] = useState<AnimalType>(programme?.animal_type ?? 'cow');
  const [price, setPrice] = useState(programme ? String(programme.price_per_share) : '');
  const [shares, setShares] = useState(programme?.shares_available ? String(programme.shares_available) : '');
  const [perShare, setPerShare] = useState(String(programme?.animals_per_share ?? 1));
  const [minQty, setMinQty] = useState(String(programme?.min_quantity ?? 1));
  const [qurbanDate, setQurbanDate] = useState(programme?.qurban_date ?? '');
  const [distribution, setDistribution] = useState<DistributionMethod>(programme?.distribution_method ?? 'local_distribution');
  const [isActive, setIsActive] = useState(programme?.is_active ?? true);

  const handleSave = () => {
    if (!name.trim() || !country.trim() || !(Number(price) > 0)) {
      toast('error', 'Missing fields', 'Name, country and a price greater than 0 are required');
      return;
    }
    if (programmes.some(p => p.id !== programme?.id && p.name.trim().toLowerCase() === name.trim().toLowerCase())) {
      toast('error', 'Duplicate programme', 'A programme with this name already exists');
      return;
    }
    const data: AppProgramme = {
      id: programme?.id ?? uid(),
      name: name.trim(),
      slug: slugify(name),
      country: country.trim(),
      animal_type: animalType,
      animals_per_share: Math.max(1, Number(perShare) || 1),
      price_per_share: Number(price),
      currency: programme?.currency ?? 'SGD',
      shares_available: Math.max(0, Math.floor(Number(shares) || 0)),
      min_quantity: Math.max(1, Math.floor(Number(minQty) || 1)),
      distribution_method: distribution,
      is_active: isActive,
      qurban_date: qurbanDate,
      orders_count: programme?.orders_count ?? 0,
    };
    if (isNew) addProgramme(data); else updateProgramme(data);
    toast('success', isNew ? 'Programme created' : 'Programme updated', data.name);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="heading-md">{isNew ? 'New Programme' : 'Edit Programme'}</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Programme Name *</label>
              <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cow Share — Somalia" autoFocus />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="settings-grid-2">
              <div className="form-group">
                <label className="form-label">Country *</label>
                <input className="form-input" value={country} onChange={e => setCountry(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Animal Type *</label>
                <select className="form-input form-select" value={animalType} onChange={e => setAnimalType(e.target.value as AnimalType)}>
                  {(['cow', 'goat', 'sheep', 'lamb', 'camel', 'buffalo'] as AnimalType[]).map(t => (
                    <option key={t} value={t}>{ANIMAL_EMOJI[t]} {t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Price per Share (SGD) *</label>
                <input className="form-input" type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Total Shares Available</label>
                <input className="form-input" type="number" min="0" value={shares} onChange={e => setShares(e.target.value)} placeholder="Leave blank for unlimited" />
              </div>
              <div className="form-group">
                <label className="form-label">Animals per Share</label>
                <input className="form-input" type="number" min="1" value={perShare} onChange={e => setPerShare(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Minimum Quantity</label>
                <input className="form-input" type="number" min="1" value={minQty} onChange={e => setMinQty(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Qurban Date</label>
                <input className="form-input" type="date" value={qurbanDate} onChange={e => setQurbanDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Distribution Method</label>
                <select className="form-input form-select" value={distribution} onChange={e => setDistribution(e.target.value as DistributionMethod)}>
                  {(Object.keys(DISTRIBUTION_LABEL) as DistributionMethod[]).map(m => (
                    <option key={m} value={m}>{DISTRIBUTION_LABEL[m]}</option>
                  ))}
                </select>
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              Active (available for new orders)
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>{isNew ? 'Create Programme' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}

export function ProgrammesPage() {
  usePageTitle('Programmes');
  const { programmes } = useAppData();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editProgramme, setEditProgramme] = useState<AppProgramme | undefined>();

  const filtered = programmes.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.country.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-content animate-fadeInUp">
      {showModal && <ProgrammeModal programme={editProgramme} onClose={() => setShowModal(false)} />}

      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Programmes</h1>
          <p className="page-subtitle">Manage Qurban programmes across countries</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditProgramme(undefined); setShowModal(true); }}>
          <Plus size={16} />
          New Programme
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        {[
          { label: 'Total Programmes', value: String(programmes.length), color: 'var(--aig-green-400)' },
          { label: 'Active', value: String(programmes.filter(p => p.is_active).length), color: 'var(--success)' },
          { label: 'Countries', value: String(new Set(programmes.map(p => p.country)).size), color: 'var(--info)' },
          { label: 'Shares Ordered', value: String(programmes.reduce((a, p) => a + p.orders_count, 0)), color: 'var(--purple)' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ padding: '1rem' }}>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="filter-bar">
        <div className="search-bar">
          <Search className="search-icon" size={15} />
          <input id="programmes-search" type="search" className="form-input" placeholder="Search programmes..." value={search} onChange={e => setSearch(e.target.value)} style={{ height: 38 }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
        {filtered.map(p => {
          const capacityUsed = p.shares_available ? Math.min(100, Math.round((p.orders_count / p.shares_available) * 100)) : 0;
          return (
            <div key={p.id} className="card card-hover" style={{ cursor: 'pointer' }} onClick={() => { setEditProgramme(p); setShowModal(true); }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                  <AnimalPhoto type={p.animal_type} size={60} radius={12} />
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>{p.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                      <Globe size={11} /> {p.country}
                    </div>
                  </div>
                </div>
                <span className={`badge ${p.is_active ? 'badge-green' : 'badge-gray'}`}>
                  {p.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.8125rem' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Price</div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{formatCurrency(p.price_per_share, p.currency)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Qurban Date</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{p.qurban_date ? formatDate(p.qurban_date) : '—'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Distribution</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{DISTRIBUTION_LABEL[p.distribution_method]}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Orders</div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{p.orders_count}</div>
                </div>
              </div>

              {p.shares_available > 0 ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                    <span>Capacity</span>
                    <span>{p.orders_count} / {p.shares_available} shares</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${capacityUsed}%` }} />
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Unlimited capacity</div>
              )}
            </div>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <div className="empty-state" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
          <h3>{programmes.length ? 'No programmes match your search' : 'No programmes yet'}</h3>
          <p>{programmes.length ? 'Try a different search term' : 'Create a programme so it can be selected (with its price) when creating orders'}</p>
        </div>
      )}
    </div>
  );
}
