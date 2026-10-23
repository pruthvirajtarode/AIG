import React, { useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Search, Plus, Eye, X, Send, ShieldCheck } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/contexts/ToastContext';
import { useAppData, type AppParticipant as Participant } from '@/contexts/AppDataContext';


function ParticipantModal({ participant, onClose, onSave, onSendInvite }: {
  participant?: Participant;
  onClose: () => void;
  onSave: (data: Omit<Participant, 'id' | 'participant_ref' | 'orders_count' | 'total_spent' | 'is_active' | 'portal_access' | 'created_at'>) => void;
  onSendInvite?: (id: string) => void;
}) {
  const { toast } = useToast();
  const isNew = !participant;

  const [firstName, setFirstName]   = useState(participant?.first_name  ?? '');
  const [lastName,  setLastName]    = useState(participant?.last_name   ?? '');
  const [email,     setEmail]       = useState(participant?.email       ?? '');
  const [phone,     setPhone]       = useState(participant?.phone       ?? '');
  const [icNumber,  setIcNumber]    = useState(participant?.ic_number   ?? '');
  const [country,   setCountry]     = useState(participant?.country     ?? 'Singapore');

  const handleSave = () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast('error', 'Missing fields', 'First name, last name and email are required');
      return;
    }
    onSave({ first_name: firstName.trim(), last_name: lastName.trim(), email: email.trim(), phone: phone.trim(), ic_number: icNumber.trim(), country: country.trim() });
    toast('success', isNew ? 'Participant added!' : 'Changes saved', isNew ? 'New participant registered in the system' : `${firstName}'s profile updated`);
    onClose();
  };

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
              <div className="avatar avatar-lg">{firstName[0] || '?'}{lastName[0] || '?'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '1.0625rem', color: 'var(--text-primary)' }}>{firstName} {lastName}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--aig-green-400)', fontFamily: 'monospace' }}>{participant.participant_ref}</div>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.375rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{participant.orders_count} orders</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SGD {participant.total_spent.toLocaleString()} total</span>
                  <span className={`badge ${participant.is_active ? 'badge-green' : 'badge-gray'}`} style={{ fontSize: '0.65rem' }}>
                    {participant.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <span className={`badge ${participant.portal_access ? 'badge-blue' : 'badge-gray'}`} style={{ fontSize: '0.65rem' }}>
                    {participant.portal_access ? '🔓 Portal Access' : '🔒 No Portal Access'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="settings-grid-2">
            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input className="form-input" value={firstName} onChange={e => setFirstName(e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name *</label>
              <input className="form-input" value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">IC / Passport Number</label>
              <input className="form-input" value={icNumber} onChange={e => setIcNumber(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Country</label>
              <input className="form-input" value={country} onChange={e => setCountry(e.target.value)} />
            </div>
          </div>

          {/* Portal Access Info */}
          {!isNew && participant && !participant.portal_access && (
            <div style={{
              marginTop: '1.25rem', padding: '1rem',
              background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: 10, display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
            }}>
              <ShieldCheck size={18} color="var(--info)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--info)', marginBottom: '0.25rem' }}>
                  Portal Access Not Yet Granted
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  This participant cannot log into the participant portal yet. Click <strong>"Send Portal Invite"</strong> to send them an email with their login credentials so they can track their orders and download their certificate.
                </div>
              </div>
            </div>
          )}

          {!isNew && participant && participant.portal_access && (
            <div style={{
              marginTop: '1.25rem', padding: '0.875rem 1rem',
              background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: 10, display: 'flex', gap: '0.75rem', alignItems: 'center',
            }}>
              <ShieldCheck size={16} color="var(--success)" />
              <span style={{ fontSize: '0.8125rem', color: 'var(--success)', fontWeight: 500 }}>
                Portal access active — participant can log in at aigsuite.com/login?mode=participant
              </span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          {!isNew && participant && !participant.portal_access && onSendInvite && (
            <button className="btn btn-secondary" style={{ gap: '0.5rem', color: 'var(--info)', borderColor: 'rgba(59,130,246,0.4)' }}
              onClick={() => { onSendInvite(participant.id); onClose(); }}>
              <Send size={14} /> Send Portal Invite
            </button>
          )}
          {!isNew && participant && participant.portal_access && onSendInvite && (
            <button className="btn btn-secondary" style={{ gap: '0.5rem' }}
              onClick={() => { toast('info', 'Invite resent', `Login credentials resent to ${participant.email}`); onClose(); }}>
              <Send size={14} /> Resend Invite
            </button>
          )}
          <button className="btn btn-primary" onClick={handleSave}>
            {isNew ? 'Add Participant' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ParticipantsPage() {
  usePageTitle('Participants');
  const { toast } = useToast();
  const { participants, addParticipant } = useAppData();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editP, setEditP] = useState<Participant | undefined>();

  const handleSave = (data: Omit<Participant, 'id' | 'participant_ref' | 'orders_count' | 'total_spent' | 'is_active' | 'portal_access' | 'created_at'>) => {
    if (editP) {
      // Local edit only (no global update fn needed for now)
    } else {
      const seq = participants.length + 1;
      const padded = String(seq).padStart(3, '0');
      const newP: Participant = {
        id: `pp-${Date.now()}`,
        participant_ref: `PRT-${new Date().getFullYear()}-${padded}`,
        ...data,
        orders_count: 0,
        total_spent: 0,
        is_active: true,
        portal_access: false,
        created_at: new Date().toISOString(),
      };
      addParticipant(newP);
    }
  };

  const sendPortalInvite = (id: string) => {
    const p = participants.find(x => x.id === id);
    toast('success', 'Portal invite sent! 📧',
      `Login credentials sent to ${p?.email}. They can now access aigsuite.com/login?mode=participant`
    );
  };

  const filtered = participants.filter(p =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    p.email.toLowerCase().includes(search.toLowerCase()) ||
    p.participant_ref.toLowerCase().includes(search.toLowerCase()) ||
    (p.ic_number && p.ic_number.includes(search))
  );

  return (
    <div className="page-content animate-fadeInUp">
      {showModal && (
        <ParticipantModal
          participant={editP}
          onClose={() => { setShowModal(false); setEditP(undefined); }}
          onSave={handleSave}
          onSendInvite={sendPortalInvite}
        />
      )}

      <div className="page-header page-header-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
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
      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        {[
          { label: 'Total Participants', value: String(participants.length),                                     color: 'var(--aig-green-400)' },
          { label: 'Active',             value: String(participants.filter(p => p.is_active).length),            color: 'var(--success)' },
          { label: 'Portal Access',      value: String(participants.filter(p => p.portal_access).length),       color: 'var(--info)' },
          { label: 'Invite Pending',     value: String(participants.filter(p => !p.portal_access).length),      color: 'var(--warning)' },
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
          <input id="participants-search" type="search" className="form-input"
            placeholder="Search by name, email, IC or ref..."
            value={search} onChange={e => setSearch(e.target.value)} style={{ height: 38 }} />
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
                <th>Portal</th>
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
                  <td><span style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--aig-green-300)' }}>{p.participant_ref}</span></td>
                  <td>
                    <div style={{ fontSize: '0.8125rem' }}>
                      <div style={{ color: 'var(--text-secondary)' }}>{p.email}</div>
                      <div style={{ color: 'var(--text-muted)' }}>{p.phone}</div>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontFamily: 'monospace' }}>{p.ic_number || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>{p.orders_count}</td>
                  <td style={{ fontWeight: 600 }}>SGD {p.total_spent.toLocaleString()}</td>
                  <td>
                    {p.portal_access ? (
                      <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>🔓 Invited</span>
                    ) : (
                      <button className="btn btn-sm btn-secondary"
                        style={{ fontSize: '0.7rem', gap: '0.3rem', color: 'var(--warning)', borderColor: 'rgba(234,179,8,0.3)', padding: '0.25rem 0.625rem' }}
                        onClick={() => sendPortalInvite(p.id)}>
                        <Send size={11} /> Invite
                      </button>
                    )}
                  </td>
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
          Showing {filtered.length} of {participants.length} participants ·{' '}
          <span style={{ color: 'var(--info)' }}>{participants.filter(p => p.portal_access).length} with portal access</span>
        </div>
      </div>
    </div>
  );
}
