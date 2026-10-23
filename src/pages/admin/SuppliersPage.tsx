import React, { useState } from 'react';
import { Search, Plus, MapPin, Phone, Mail, Package, X } from 'lucide-react';
import type { AnimalType } from '@/lib/database.types';
import { AnimalPhoto } from '@/components/ui/AnimalPhoto';

const TYPE_EMOJI: Record<AnimalType, string> = {
  cow: '🐄', goat: '🐐', sheep: '🐑', lamb: '🐑', camel: '🐪', buffalo: '🐃',
};

const MOCK_SUPPLIERS: {
  id: string; supplier_ref: string; name: string; contact_name: string;
  email: string; phone: string; country: string; region: string | null;
  animal_types: AnimalType[]; is_active: boolean; animals_count: number;
}[] = [];

function SupplierModal({ supplier, onClose }: { supplier?: typeof MOCK_SUPPLIERS[0]; onClose: () => void }) {
  const isNew = !supplier;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="heading-md">{isNew ? 'Add Supplier' : 'Edit Supplier'}</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Supplier Name *</label>
              <input className="form-input" defaultValue={supplier?.name} placeholder="Full company name" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Contact Name</label>
                <input className="form-input" defaultValue={supplier?.contact_name || ''} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" defaultValue={supplier?.phone || ''} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" defaultValue={supplier?.email || ''} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Country *</label>
                <input className="form-input" defaultValue={supplier?.country} placeholder="e.g. Malaysia" />
              </div>
              <div className="form-group">
                <label className="form-label">Region / State</label>
                <input className="form-input" defaultValue={supplier?.region || ''} placeholder="e.g. Kelantan" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Animal Types</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                {(['cow', 'goat', 'sheep', 'lamb', 'camel', 'buffalo'] as AnimalType[]).map(t => (
                  <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked={supplier?.animal_types.includes(t)} />
                    {TYPE_EMOJI[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary">{isNew ? 'Add Supplier' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}

export function SuppliersPage() {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editSupplier, setEditSupplier] = useState<typeof MOCK_SUPPLIERS[0] | undefined>();

  const filtered = MOCK_SUPPLIERS.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.country.toLowerCase().includes(search.toLowerCase()) ||
    s.contact_name?.toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (s: typeof MOCK_SUPPLIERS[0]) => { setEditSupplier(s); setShowModal(true); };
  const openNew = () => { setEditSupplier(undefined); setShowModal(true); };

  return (
    <div className="page-content animate-fadeInUp">
      {showModal && <SupplierModal supplier={editSupplier} onClose={() => setShowModal(false)} />}

      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Suppliers</h1>
          <p className="page-subtitle">Manage livestock suppliers and their animal inventory</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <Plus size={16} />
          Add Supplier
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '1.25rem' }}>
        {[
          { label: 'Active Suppliers', value: String(MOCK_SUPPLIERS.filter(s => s.is_active).length), color: 'var(--aig-green-400)' },
          { label: 'Countries', value: String(new Set(MOCK_SUPPLIERS.map(s => s.country)).size), color: 'var(--info)' },
          { label: 'Total Animals', value: String(MOCK_SUPPLIERS.reduce((a, s) => a + s.animals_count, 0)), color: 'var(--purple)' },
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
          <input id="suppliers-search" type="search" className="form-input" placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} style={{ height: 38 }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
        {filtered.map(s => (
          <div key={s.id} className="card card-hover" style={{ cursor: 'pointer' }} onClick={() => openEdit(s)}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{s.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--aig-green-400)', fontFamily: 'monospace' }}>{s.supplier_ref}</div>
              </div>
              <span className={`badge ${s.is_active ? 'badge-green' : 'badge-gray'}`}>
                {s.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MapPin size={13} /> {s.country}{s.region ? `, ${s.region}` : ''}
              </div>
              {s.contact_name && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Phone size={13} /> {s.contact_name} · {s.phone}
                </div>
              )}
              {s.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Mail size={13} /> {s.email}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                {s.animal_types.map(t => (
                  <AnimalPhoto key={t} type={t} size={34} radius={8} />
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                <Package size={13} /> {s.animals_count} animals
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
