import React, { useState } from 'react';
import { Search, Plus, Eye, Weight, Activity, X } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { AnimalStatus, AnimalType } from '@/lib/database.types';

const ANIMAL_STATUS_BADGE: Record<AnimalStatus, string> = {
  available:           'badge-green',
  reserved:            'badge-blue',
  allocated:           'badge-purple',
  growing:             'badge-teal',
  inspection_pending:  'badge-yellow',
  inspection_passed:   'badge-green',
  qurban_ready:        'badge-emerald',
  slaughtered:         'badge-gray',
  processed:           'badge-gray',
  completed:           'badge-gray',
  rejected:            'badge-red',
};

const ANIMAL_STATUS_LABEL: Record<AnimalStatus, string> = {
  available:           'Available',
  reserved:            'Reserved',
  allocated:           'Allocated',
  growing:             'Growing',
  inspection_pending:  'Inspection Pending',
  inspection_passed:   'Inspection Passed',
  qurban_ready:        'Qurban Ready',
  slaughtered:         'Slaughtered',
  processed:           'Processed',
  completed:           'Completed',
  rejected:            'Rejected',
};

const TYPE_EMOJI: Record<AnimalType, string> = {
  cow: '🐄', goat: '🐐', sheep: '🐑', camel: '🐪', buffalo: '🐃',
};

const MOCK_ANIMALS = [
  { id: 'a1', animal_ref: 'A-2025-001', animal_type: 'cow' as AnimalType, breed: 'Brangus', gender: 'male', status: 'allocated' as AnimalStatus, current_weight_kg: 380, min_weight_kg: 350, location: 'Farm Maju, Kelantan', supplier: 'Ternakan Maju Sdn Bhd', created_at: '2025-03-10T00:00:00Z', tag_number: 'TG-001' },
  { id: 'a2', animal_ref: 'A-2025-002', animal_type: 'goat' as AnimalType, breed: 'Boer', gender: 'male', status: 'growing' as AnimalStatus, current_weight_kg: 28, min_weight_kg: 25, location: 'Farm Maju, Kelantan', supplier: 'Ternakan Maju Sdn Bhd', created_at: '2025-03-10T00:00:00Z', tag_number: 'TG-002' },
  { id: 'a3', animal_ref: 'A-2025-003', animal_type: 'sheep' as AnimalType, breed: 'Merino', gender: 'male', status: 'inspection_pending' as AnimalStatus, current_weight_kg: 42, min_weight_kg: 40, location: 'Serasi Farm, Pahang', supplier: 'Serasi Livestock', created_at: '2025-03-15T00:00:00Z', tag_number: 'TG-003' },
  { id: 'a4', animal_ref: 'A-2025-004', animal_type: 'cow' as AnimalType, breed: 'Brahman', gender: 'male', status: 'qurban_ready' as AnimalStatus, current_weight_kg: 420, min_weight_kg: 350, location: 'Somalia Cooperative', supplier: 'Horn Africa Livestock', created_at: '2025-02-20T00:00:00Z', tag_number: 'TG-004' },
  { id: 'a5', animal_ref: 'A-2025-005', animal_type: 'goat' as AnimalType, breed: 'Kacang', gender: 'male', status: 'available' as AnimalStatus, current_weight_kg: 31, min_weight_kg: 25, location: 'Farm Maju, Kelantan', supplier: 'Ternakan Maju Sdn Bhd', created_at: '2025-04-01T00:00:00Z', tag_number: 'TG-005' },
  { id: 'a6', animal_ref: 'A-2025-006', animal_type: 'cow' as AnimalType, breed: 'Friesian', gender: 'male', status: 'growing' as AnimalStatus, current_weight_kg: 290, min_weight_kg: 350, location: 'Johor Bahru Livestock', supplier: 'JB Livestock Hub', created_at: '2025-04-05T00:00:00Z', tag_number: 'TG-006' },
  { id: 'a7', animal_ref: 'A-2025-007', animal_type: 'sheep' as AnimalType, breed: 'Suffolk', gender: 'male', status: 'inspection_passed' as AnimalStatus, current_weight_kg: 48, min_weight_kg: 40, location: 'Turkey Partner Farm', supplier: 'Anatolia Livestock', created_at: '2025-03-25T00:00:00Z', tag_number: 'TG-007' },
  { id: 'a8', animal_ref: 'A-2025-008', animal_type: 'cow' as AnimalType, breed: 'Limousin', gender: 'male', status: 'growing' as AnimalStatus, current_weight_kg: 280, min_weight_kg: 350, location: 'Bangladesh Cooperative', supplier: 'Dhaka Livestock', created_at: '2025-04-10T00:00:00Z', tag_number: 'TG-008' },
];

function AnimalDetailModal({ animal, onClose }: { animal: typeof MOCK_ANIMALS[0]; onClose: () => void }) {
  const weightPct = Math.min(100, Math.round((animal.current_weight_kg / animal.min_weight_kg) * 100));
  const belowMin = animal.current_weight_kg < animal.min_weight_kg;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '2rem' }}>{TYPE_EMOJI[animal.animal_type]}</span>
            <div>
              <div className="heading-md">{animal.animal_ref}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{animal.breed} · {animal.animal_type}</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="detail-list">
              {[
                ['Tag Number', animal.tag_number],
                ['Breed', animal.breed],
                ['Gender', animal.gender || '—'],
                ['Location', animal.location],
                ['Supplier', animal.supplier],
                ['Registered', formatDate(animal.created_at)],
              ].map(([k, v]) => (
                <div key={k} className="detail-row">
                  <div className="detail-key">{k}</div>
                  <div className="detail-val">{v}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Weight Progress</span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: belowMin ? 'var(--danger)' : 'var(--success)' }}>
                    {animal.current_weight_kg}kg / {animal.min_weight_kg}kg min
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{
                    width: `${weightPct}%`,
                    background: belowMin
                      ? 'linear-gradient(90deg, var(--danger), #f97316)'
                      : 'linear-gradient(90deg, var(--aig-green-600), var(--aig-green-400))',
                  }} />
                </div>
                {belowMin && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.375rem' }}>
                    ⚠ Below minimum weight threshold
                  </div>
                )}
              </div>

              <div style={{ padding: '0.875rem', background: 'var(--surface-700)', borderRadius: 8 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Status</div>
                <span className={`badge ${ANIMAL_STATUS_BADGE[animal.status]}`}>{ANIMAL_STATUS_LABEL[animal.status]}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary">Log Weight Update</button>
          <button className="btn btn-outline-green">Record Inspection</button>
          <button className="btn btn-primary">Update Status</button>
        </div>
      </div>
    </div>
  );
}

export function AnimalsPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<typeof MOCK_ANIMALS[0] | null>(null);

  const filtered = MOCK_ANIMALS.filter(a => {
    const matchSearch = a.animal_ref.toLowerCase().includes(search.toLowerCase()) || a.breed.toLowerCase().includes(search.toLowerCase()) || a.location.toLowerCase().includes(search.toLowerCase());
    const matchType = !typeFilter || a.animal_type === typeFilter;
    const matchStatus = !statusFilter || a.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  return (
    <div className="page-content animate-fadeInUp">
      {selected && <AnimalDetailModal animal={selected} onClose={() => setSelected(null)} />}

      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Animals</h1>
          <p className="page-subtitle">Track livestock status, weights, and inspections</p>
        </div>
        <button className="btn btn-primary">
          <Plus size={16} />
          Register Animal
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: '1.25rem' }}>
        {[
          { label: 'Total Animals', value: '98', color: 'var(--aig-green-400)' },
          { label: 'Available', value: '12', color: 'var(--success)' },
          { label: 'Allocated', value: '45', color: 'var(--purple)' },
          { label: 'Qurban Ready', value: '18', color: 'var(--emerald)' },
          { label: 'Exceptions', value: '3', color: 'var(--danger)' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ padding: '1rem' }}>
            <div className="stat-value" style={{ fontSize: '1.375rem', color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-bar">
          <Search className="search-icon" size={15} />
          <input id="animals-search" type="search" className="form-input" placeholder="Search by ref, breed, location..." value={search} onChange={e => setSearch(e.target.value)} style={{ height: 38 }} />
        </div>
        <select className="form-input form-select" style={{ width: 'auto', height: 38, fontSize: '0.875rem' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {(['cow', 'goat', 'sheep', 'camel', 'buffalo'] as AnimalType[]).map(t => (
            <option key={t} value={t}>{TYPE_EMOJI[t]} {t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
        <select className="form-input form-select" style={{ width: 'auto', height: 38, fontSize: '0.875rem' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {(Object.keys(ANIMAL_STATUS_LABEL) as AnimalStatus[]).map(s => (
            <option key={s} value={s}>{ANIMAL_STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>

      {/* Animal Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {filtered.map(a => {
          const weightPct = Math.min(100, Math.round((a.current_weight_kg / a.min_weight_kg) * 100));
          const belowMin = a.current_weight_kg < a.min_weight_kg;
          return (
            <div
              key={a.id}
              className="card card-hover"
              style={{ cursor: 'pointer' }}
              onClick={() => setSelected(a)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>{TYPE_EMOJI[a.animal_type]}</span>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--aig-green-300)', fontSize: '0.875rem' }}>{a.animal_ref}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.breed}</div>
                  </div>
                </div>
                <span className={`badge ${ANIMAL_STATUS_BADGE[a.status]}`} style={{ fontSize: '0.7rem' }}>
                  {ANIMAL_STATUS_LABEL[a.status]}
                </span>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Weight size={11} /> Weight
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: belowMin ? 'var(--danger)' : 'var(--text-secondary)' }}>
                    {a.current_weight_kg}kg / {a.min_weight_kg}kg
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{
                    width: `${weightPct}%`,
                    background: belowMin
                      ? 'linear-gradient(90deg, var(--danger), #f97316)'
                      : 'linear-gradient(90deg, var(--aig-green-600), var(--aig-green-400))',
                  }} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>📍 {a.location}</span>
                <span>{a.tag_number}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
