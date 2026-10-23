import React, { useState } from 'react';
import { Search, Plus, MapPin, Phone, Mail, Package, X } from 'lucide-react';
import type { AnimalType } from '@/lib/database.types';
import { AnimalPhoto } from '@/components/ui/AnimalPhoto';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/contexts/ToastContext';
import { useAppData, nextRef, uid, type AppSupplier } from '@/contexts/AppDataContext';

const TYPE_EMOJI: Record<AnimalType, string> = {
  cow: '🐄', goat: '🐐', sheep: '🐑', lamb: '🐑', camel: '🐪', buffalo: '🐃',
};

function SupplierModal({ supplier, onClose }: { supplier?: AppSupplier; onClose: () => void }) {
  const isNew = !supplier;
  const { toast } = useToast();
  const { suppliers, addSupplier, updateSupplier } = useAppData();
  const [name, setName] = useState(supplier?.name ?? '');
  const [contactName, setContactName] = useState(supplier?.contact_name ?? '');
  const [phone, setPhone] = useState(supplier?.phone ?? '');
  const [email, setEmail] = useState(supplier?.email ?? '');
  const [country, setCountry] = useState(supplier?.country ?? '');
  const [region, setRegion] = useState(supplier?.region ?? '');
  const [types, setTypes] = useState<AnimalType[]>(supplier?.animal_types ?? []);
  const [isActive, setIsActive] = useState(supplier?.is_active ?? true);

  const toggleType = (t: AnimalType) => setTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const handleSave = () => {
    if (!name.trim() || !country.trim()) {
      toast('error', 'Missing fields', 'Supplier name and country are required');
      return;
    }
    if (suppliers.some(s => s.id !== supplier?.id && s.name.trim().toLowerCase() === name.trim().toLowerCase())) {
      toast('error', 'Duplicate supplier', 'A supplier with this name already exists');
      return;
    }
    const data: AppSupplier = {
      id: supplier?.id ?? uid(),
      supplier_ref: supplier?.supplier_ref ?? nextRef('SUP', suppliers.map(s => s.supplier_ref), 3),
      name: name.trim(),
      contact_name: contactName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      country: country.trim(),
      region: region.trim() || null,
      animal_types: types,
      is_active: isActive,
      animals_count: supplier?.animals_count ?? 0,
    };
    if (isNew) addSupplier(data); else updateSupplier(data);
    toast('success', isNew ? 'Supplier added' : 'Supplier updated', data.name);
    onClose();
  };

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
              <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Full company name" autoFocus />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Contact Name</label>
                <input className="form-input" value={contactName} onChange={e => setContactName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Country *</label>
                <input className="form-input" value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. Malaysia" />
              </div>
              <div className="form-group">
                <label className="form-label">Region / State</label>
                <input className="form-input" value={region} onChange={e => setRegion(e.target.value)} placeholder="e.g. Kelantan" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Animal Types</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                {(['cow', 'goat', 'sheep', 'lamb', 'camel', 'buffalo'] as AnimalType[]).map(t => (
                  <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={types.includes(t)} onChange={() => toggleType(t)} />
                    {TYPE_EMOJI[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
                  </label>
                ))}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              Active supplier
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>{isNew ? 'Add Supplier' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}

export function SuppliersPage() {
  usePageTitle('Suppliers');
  const { suppliers } = useAppData();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editSupplier, setEditSupplier] = useState<AppSupplier | undefined>();

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.country.toLowerCase().includes(search.toLowerCase()) ||
    s.contact_name?.toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (s: AppSupplier) => { setEditSupplier(s); setShowModal(true); };
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
          { label: 'Active Suppliers', value: String(suppliers.filter(s => s.is_active).length), color: 'var(--aig-green-400)' },
          { label: 'Countries', value: String(new Set(suppliers.map(s => s.country)).size), color: 'var(--info)' },
          { label: 'Total Animals', value: String(suppliers.reduce((a, s) => a + s.animals_count, 0)), color: 'var(--purple)' },
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
      {filtered.length === 0 && (
        <div className="empty-state" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
          <h3>{suppliers.length ? 'No suppliers match your search' : 'No suppliers yet'}</h3>
          <p>{suppliers.length ? 'Try a different search term' : 'Click "Add Supplier" to register your first livestock supplier'}</p>
        </div>
      )}
    </div>
  );
}
