import React, { useState } from 'react';
import { Search, Plus, BookOpen, Globe, Eye, X } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { AnimalType, DistributionMethod } from '@/lib/database.types';

const DISTRIBUTION_LABEL: Record<DistributionMethod, string> = {
  local_distribution: 'Local Distribution',
  air_freight: 'Air Freight',
  sea_freight: 'Sea Freight',
  direct_delivery: 'Direct Delivery',
  pickup: 'Pickup',
};

const ANIMAL_EMOJI: Record<AnimalType, string> = { cow: '🐄', goat: '🐐', sheep: '🐑', camel: '🐪', buffalo: '🐃' };

const MOCK_PROGRAMMES = [
  { id: 'pr1', name: 'Cow Share — Somalia', slug: 'cow-somalia-2025', country: 'Somalia', animal_type: 'cow' as AnimalType, animals_per_share: 7, price_per_share: 850, currency: 'SGD', shares_available: 28, min_quantity: 1, distribution_method: 'air_freight' as DistributionMethod, is_active: true, qurban_date: '2025-06-28', orders_count: 42 },
  { id: 'pr2', name: 'Goat — Malaysia', slug: 'goat-malaysia-2025', country: 'Malaysia', animal_type: 'goat' as AnimalType, animals_per_share: 1, price_per_share: 420, currency: 'SGD', shares_available: 50, min_quantity: 1, distribution_method: 'local_distribution' as DistributionMethod, is_active: true, qurban_date: '2025-06-29', orders_count: 31 },
  { id: 'pr3', name: 'Sheep — Turkey', slug: 'sheep-turkey-2025', country: 'Turkey', animal_type: 'sheep' as AnimalType, animals_per_share: 1, price_per_share: 380, currency: 'SGD', shares_available: 35, min_quantity: 1, distribution_method: 'air_freight' as DistributionMethod, is_active: true, qurban_date: '2025-06-28', orders_count: 28 },
  { id: 'pr4', name: 'Cow Share — Palestine', slug: 'cow-palestine-2025', country: 'Palestine', animal_type: 'cow' as AnimalType, animals_per_share: 7, price_per_share: 950, currency: 'SGD', shares_available: 14, min_quantity: 1, distribution_method: 'sea_freight' as DistributionMethod, is_active: true, qurban_date: '2025-06-29', orders_count: 18 },
  { id: 'pr5', name: 'Goat — Bangladesh', slug: 'goat-bangladesh-2025', country: 'Bangladesh', animal_type: 'goat' as AnimalType, animals_per_share: 1, price_per_share: 390, currency: 'SGD', shares_available: 0, min_quantity: 1, distribution_method: 'air_freight' as DistributionMethod, is_active: false, qurban_date: '2025-06-28', orders_count: 24 },
];

function ProgrammeModal({ programme, onClose }: { programme?: typeof MOCK_PROGRAMMES[0]; onClose: () => void }) {
  const isNew = !programme;
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
              <input className="form-input" defaultValue={programme?.name} placeholder="e.g. Cow Share — Somalia 2025" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Country *</label>
                <input className="form-input" defaultValue={programme?.country} />
              </div>
              <div className="form-group">
                <label className="form-label">Animal Type *</label>
                <select className="form-input form-select" defaultValue={programme?.animal_type}>
                  {(['cow', 'goat', 'sheep', 'camel', 'buffalo'] as AnimalType[]).map(t => (
                    <option key={t} value={t}>{ANIMAL_EMOJI[t]} {t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Price per Share (SGD)</label>
                <input className="form-input" type="number" defaultValue={programme?.price_per_share} />
              </div>
              <div className="form-group">
                <label className="form-label">Shares Available</label>
                <input className="form-input" type="number" defaultValue={programme?.shares_available ?? ''} placeholder="Leave blank for unlimited" />
              </div>
              <div className="form-group">
                <label className="form-label">Animals per Share</label>
                <input className="form-input" type="number" defaultValue={programme?.animals_per_share} min="1" />
              </div>
              <div className="form-group">
                <label className="form-label">Qurban Date</label>
                <input className="form-input" type="date" defaultValue={programme?.qurban_date || ''} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Distribution Method</label>
              <select className="form-input form-select" defaultValue={programme?.distribution_method}>
                {(Object.keys(DISTRIBUTION_LABEL) as DistributionMethod[]).map(m => (
                  <option key={m} value={m}>{DISTRIBUTION_LABEL[m]}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary">{isNew ? 'Create Programme' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}

export function ProgrammesPage() {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editProgramme, setEditProgramme] = useState<typeof MOCK_PROGRAMMES[0] | undefined>();

  const filtered = MOCK_PROGRAMMES.filter(p =>
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
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1.25rem' }}>
        {[
          { label: 'Total Programmes', value: String(MOCK_PROGRAMMES.length), color: 'var(--aig-green-400)' },
          { label: 'Active', value: String(MOCK_PROGRAMMES.filter(p => p.is_active).length), color: 'var(--success)' },
          { label: 'Countries', value: String(new Set(MOCK_PROGRAMMES.map(p => p.country)).size), color: 'var(--info)' },
          { label: 'Total Orders', value: String(MOCK_PROGRAMMES.reduce((a, p) => a + p.orders_count, 0)), color: 'var(--purple)' },
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
          const capacityUsed = p.shares_available ? Math.round((p.orders_count / (p.orders_count + p.shares_available)) * 100) : 100;
          return (
            <div key={p.id} className="card card-hover" style={{ cursor: 'pointer' }} onClick={() => { setEditProgramme(p); setShowModal(true); }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <span style={{ fontSize: '1.875rem' }}>{ANIMAL_EMOJI[p.animal_type]}</span>
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

              {p.shares_available !== null && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                    <span>Capacity</span>
                    <span>{p.orders_count} / {p.orders_count + p.shares_available} shares</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${capacityUsed}%` }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
