import React, { useState } from 'react';
import { Search, Plus, UserCheck, Phone, Mail, MapPin, Eye, X } from 'lucide-react';
import { formatDate } from '@/lib/utils';

const MOCK_PARTICIPANTS = [
  { id: 'pp1', participant_ref: 'PRT-2025-001', first_name: 'Ahmad Rizal', last_name: 'bin Yusof', email: 'ahmad.rizal@email.com', phone: '+60 12-3456789', country: 'Malaysia', ic_number: '810405-14-5678', orders_count: 3, total_spent: 2550, is_active: true, created_at: '2024-11-15T00:00:00Z' },
  { id: 'pp2', participant_ref: 'PRT-2025-002', first_name: 'Nurul Ain', last_name: 'binti Hassan', email: 'nurul.ain@email.com', phone: '+60 16-5554321', country: 'Malaysia', ic_number: '890215-03-7890', orders_count: 2, total_spent: 840, is_active: true, created_at: '2024-12-01T00:00:00Z' },
  { id: 'pp3', participant_ref: 'PRT-2025-003', first_name: 'Mohamad Faiz', last_name: 'bin Ali', email: 'faiz.ali@email.com', phone: '+60 11-9876543', country: 'Malaysia', ic_number: '760812-07-3456', orders_count: 1, total_spent: 950, is_active: true, created_at: '2025-01-10T00:00:00Z' },
  { id: 'pp4', participant_ref: 'PRT-2025-004', first_name: 'Siti Norzahra', last_name: 'binti Md Zain', email: 'norzahra@email.com', phone: '+60 13-7771234', country: 'Malaysia', ic_number: '920530-10-2345', orders_count: 2, total_spent: 760, is_active: true, created_at: '2025-01-22T00:00:00Z' },
  { id: 'pp5', participant_ref: 'PRT-2025-005', first_name: 'Zulkifli', last_name: 'bin Othman', email: 'zulkifli.othman@email.com', phone: '+60 17-3214567', country: 'Malaysia', ic_number: '730619-08-9012', orders_count: 1, total_spent: 390, is_active: false, created_at: '2025-02-05T00:00:00Z' },
  { id: 'pp6', participant_ref: 'PRT-2025-006', first_name: 'Nur Izzati', last_name: 'binti Kamal', email: 'izzati.kamal@email.com', phone: '+60 14-7774444', country: 'Malaysia', ic_number: '950720-14-6789', orders_count: 1, total_spent: 850, is_active: true, created_at: '2025-02-18T00:00:00Z' },
  { id: 'pp7', participant_ref: 'PRT-2025-007', first_name: 'Hafizuddin', last_name: 'bin Ramli', email: 'hafiz.ramli@email.com', phone: '+60 13-2223333', country: 'Malaysia', ic_number: '850325-05-4321', orders_count: 1, total_spent: 1260, is_active: true, created_at: '2025-03-01T00:00:00Z' },
];

function ParticipantModal({ participant, onClose }: { participant?: typeof MOCK_PARTICIPANTS[0]; onClose: () => void }) {
  const isNew = !participant;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="heading-md">{isNew ? 'Add Participant' : 'Participant Details'}</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {!isNew && participant && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', padding: '1rem', background: 'var(--surface-700)', borderRadius: 10 }}>
              <div className="avatar avatar-lg">{participant.first_name[0]}{participant.last_name[0]}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.0625rem', color: 'var(--text-primary)' }}>{participant.first_name} {participant.last_name}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--aig-green-400)', fontFamily: 'monospace' }}>{participant.participant_ref}</div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.375rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{participant.orders_count} orders</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SGD {participant.total_spent.toLocaleString()} total</span>
                  <span className={`badge ${participant.is_active ? 'badge-green' : 'badge-gray'}`} style={{ fontSize: '0.65rem' }}>
                    {participant.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input className="form-input" defaultValue={participant?.first_name} />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name *</label>
              <input className="form-input" defaultValue={participant?.last_name} />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className="form-input" type="email" defaultValue={participant?.email} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" defaultValue={participant?.phone} />
            </div>
            <div className="form-group">
              <label className="form-label">IC / Passport Number</label>
              <input className="form-input" defaultValue={participant?.ic_number || ''} />
            </div>
            <div className="form-group">
              <label className="form-label">Country</label>
              <input className="form-input" defaultValue={participant?.country || 'Malaysia'} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary">{isNew ? 'Add Participant' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}

export function ParticipantsPage() {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editP, setEditP] = useState<typeof MOCK_PARTICIPANTS[0] | undefined>();

  const filtered = MOCK_PARTICIPANTS.filter(p =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    p.email.toLowerCase().includes(search.toLowerCase()) ||
    p.participant_ref.toLowerCase().includes(search.toLowerCase()) ||
    (p.ic_number && p.ic_number.includes(search))
  );

  return (
    <div className="page-content animate-fadeInUp">
      {showModal && <ParticipantModal participant={editP} onClose={() => setShowModal(false)} />}

      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Participants</h1>
          <p className="page-subtitle">Registered Qurban participants across all programmes</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditP(undefined); setShowModal(true); }}>
          <Plus size={16} />
          Add Participant
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '1.25rem' }}>
        {[
          { label: 'Total Participants', value: String(MOCK_PARTICIPANTS.length), color: 'var(--aig-green-400)' },
          { label: 'Active', value: String(MOCK_PARTICIPANTS.filter(p => p.is_active).length), color: 'var(--success)' },
          { label: 'Inactive', value: String(MOCK_PARTICIPANTS.filter(p => !p.is_active).length), color: 'var(--text-muted)' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ padding: '1rem' }}>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-bar" style={{ maxWidth: 400 }}>
          <Search className="search-icon" size={15} />
          <input id="participants-search" type="search" className="form-input" placeholder="Search by name, email, IC or ref..." value={search} onChange={e => setSearch(e.target.value)} style={{ height: 38 }} />
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Participant</th>
                <th>Reference</th>
                <th>Contact</th>
                <th>IC Number</th>
                <th>Orders</th>
                <th>Total Spent</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div className="avatar avatar-sm">{p.first_name[0]}{p.last_name[0]}</div>
                      <div>
                        <div style={{ fontWeight: 500 }}>{p.first_name} {p.last_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(p.created_at)}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--aig-green-300)' }}>{p.participant_ref}</span>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.8125rem' }}>
                      <div style={{ color: 'var(--text-secondary)' }}>{p.email}</div>
                      <div style={{ color: 'var(--text-muted)' }}>{p.phone}</div>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontFamily: 'monospace' }}>{p.ic_number || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>{p.orders_count}</td>
                  <td style={{ fontWeight: 600 }}>SGD {p.total_spent.toLocaleString()}</td>
                  <td><span className={`badge ${p.is_active ? 'badge-green' : 'badge-gray'}`}>{p.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditP(p); setShowModal(true); }}>
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0.875rem 1.25rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Showing {filtered.length} of {MOCK_PARTICIPANTS.length} participants
        </div>
      </div>
    </div>
  );
}
