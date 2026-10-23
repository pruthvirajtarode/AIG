import React, { useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { AlertTriangle, Search, CheckCircle2, Clock, X, User } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import type { ExceptionSeverity, ExceptionStatus } from '@/lib/database.types';
import { useToast } from '@/contexts/ToastContext';

const SEVERITY_BADGE: Record<ExceptionSeverity, string> = {
  low:      'badge-blue',
  medium:   'badge-yellow',
  high:     'badge-orange',
  critical: 'badge-red',
};

const STATUS_BADGE: Record<ExceptionStatus, string> = {
  open:        'badge-red',
  in_progress: 'badge-orange',
  resolved:    'badge-green',
  dismissed:   'badge-gray',
  escalated:   'badge-purple',
};

const STATUS_LABEL: Record<ExceptionStatus, string> = {
  open:        'Open',
  in_progress: 'In Progress',
  resolved:    'Resolved',
  dismissed:   'Dismissed',
  escalated:   'Escalated',
};

type ExceptionItem = {
  id: string;
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  category: string;
  title: string;
  description: string;
  related_entity: string;
  related_entity_id: string;
  assigned_to: string | null;
  created_at: string;
};

const INITIAL_EXCEPTIONS: ExceptionItem[] = [];

function ExceptionModal({ exception: ex, onClose, onResolve, onAssign }: {
  exception: ExceptionItem;
  onClose: () => void;
  onResolve: (id: string) => void;
  onAssign: (id: string, person: string) => void;
}) {
  const { toast } = useToast();
  const [assignee, setAssignee] = useState(ex.assigned_to || '');
  const [resolutionNotes, setResolutionNotes] = useState('');
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: ex.severity === 'critical' ? 'var(--danger)' : ex.severity === 'high' ? 'var(--orange)' : ex.severity === 'medium' ? 'var(--warning)' : 'var(--info)', flexShrink: 0 }} />
            <div className="heading-md">{ex.title}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <span className={`badge ${SEVERITY_BADGE[ex.severity]}`}>{ex.severity.toUpperCase()}</span>
            <span className={`badge ${STATUS_BADGE[ex.status]}`}>{STATUS_LABEL[ex.status]}</span>
            <span className="badge badge-gray">{ex.category}</span>
          </div>

          <div style={{ padding: '1rem', background: 'var(--surface-700)', borderRadius: 8, marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            {ex.description}
          </div>

          <div className="detail-list">
            {([
              ['Related Entity', `${ex.related_entity} · ${ex.related_entity_id}`],
              ['Assigned To', ex.assigned_to || 'Unassigned'],
              ['Reported', formatRelativeTime(ex.created_at)],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="detail-row">
                <div className="detail-key">{k}</div>
                <div className="detail-val">{v}</div>
              </div>
            ))}
          </div>

          {(ex.status === 'open' || ex.status === 'in_progress') ? (
            <div style={{ marginTop: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label">Resolution Notes</label>
                <textarea className="form-input" rows={3} placeholder="Describe how this exception was resolved..." style={{ resize: 'none' }}
                  value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Assign To</label>
                <select className="form-input form-select" value={assignee} onChange={e => setAssignee(e.target.value)}>
                  <option value="">Select staff member</option>
                  <option>Ahmad Salihin</option>
                  <option>Operations Admin</option>
                  <option>D3 Technical Admin</option>
                </select>
              </div>
            </div>
          ) : null}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          {(ex.status === 'open' || ex.status === 'in_progress') && (
            <>
              <button className="btn btn-secondary" style={{ gap: '0.5rem' }}
                onClick={() => {
                  if (!assignee) { toast('warning', 'Select a staff member', 'Please select who to assign this exception to'); return; }
                  onAssign(ex.id, assignee);
                  toast('info', 'Exception assigned', `${ex.title.slice(0, 30)}... assigned to ${assignee}`);
                  onClose();
                }}>
                <User size={14} /> Assign
              </button>
              <button className="btn btn-primary" style={{ gap: '0.5rem' }}
                onClick={() => {
                  onResolve(ex.id);
                  toast('success', 'Exception resolved ✓', `${ex.title.slice(0, 40)}... marked as resolved`);
                  onClose();
                }}>
                <CheckCircle2 size={14} /> Mark Resolved
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function ExceptionsPage() {
  usePageTitle('Exceptions');
  const [exceptions, setExceptions] = useState<ExceptionItem[]>(INITIAL_EXCEPTIONS);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [selected, setSelected] = useState<ExceptionItem | null>(null);

  const resolveException = (id: string) => {
    setExceptions(prev => prev.map(e => e.id === id ? { ...e, status: 'resolved' as ExceptionStatus } : e));
  };

  const assignException = (id: string, person: string) => {
    setExceptions(prev => prev.map(e => e.id === id ? { ...e, assigned_to: person, status: 'in_progress' as ExceptionStatus } : e));
  };

  const filtered = exceptions.filter(e => {
    const matchSearch = e.title.toLowerCase().includes(search.toLowerCase()) || e.category.toLowerCase().includes(search.toLowerCase());
    const matchSeverity = !severityFilter || e.severity === severityFilter;
    const matchStatus = !statusFilter || e.status === statusFilter;
    return matchSearch && matchSeverity && matchStatus;
  });

  return (
    <div className="page-content animate-fadeInUp">
      {selected && (
        <ExceptionModal
          exception={selected}
          onClose={() => setSelected(null)}
          onResolve={resolveException}
          onAssign={assignException}
        />
      )}

      <div className="page-header">
        <h1 className="page-title">Exceptions</h1>
        <p className="page-subtitle">Track and resolve operational exceptions</p>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        {[
          { label: 'Total',    value: String(exceptions.length), color: 'var(--text-secondary)' },
          { label: 'Critical', value: String(exceptions.filter(e => e.severity === 'critical').length), color: 'var(--danger)' },
          { label: 'High',     value: String(exceptions.filter(e => e.severity === 'high').length), color: 'var(--orange)' },
          { label: 'Open',     value: String(exceptions.filter(e => e.status === 'open').length), color: 'var(--warning)' },
          { label: 'Resolved', value: String(exceptions.filter(e => e.status === 'resolved').length), color: 'var(--success)' },
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
          <input id="exceptions-search" type="search" className="form-input" placeholder="Search exceptions..." value={search} onChange={e => setSearch(e.target.value)} style={{ height: 38 }} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['', 'open', 'in_progress', 'resolved', 'escalated'] as const).map(s => (
            <button key={s} className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter(s)}>
              {s === '' ? 'All' : STATUS_LABEL[s as ExceptionStatus]}
            </button>
          ))}
        </div>
      </div>

      {/* Exception Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {filtered.map(ex => (
          <div
            key={ex.id}
            className="card card-hover"
            style={{ cursor: 'pointer', borderLeft: `3px solid ${ex.severity === 'critical' ? 'var(--danger)' : ex.severity === 'high' ? 'var(--orange)' : ex.severity === 'medium' ? 'var(--warning)' : 'var(--info)'}` }}
            onClick={() => setSelected(ex)}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                  <span className={`badge ${SEVERITY_BADGE[ex.severity]}`}>{ex.severity.toUpperCase()}</span>
                  <span className="badge badge-gray" style={{ fontSize: '0.7rem' }}>{ex.category}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={11} /> {formatRelativeTime(ex.created_at)}
                  </span>
                </div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>{ex.title}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ex.description}
                </div>
                {ex.assigned_to && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--aig-green-400)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <User size={11} /> Assigned to {ex.assigned_to}
                  </div>
                )}
              </div>
              <div style={{ flexShrink: 0 }}>
                <span className={`badge ${STATUS_BADGE[ex.status]}`}>{STATUS_LABEL[ex.status]}</span>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon"><CheckCircle2 size={24} color="var(--success)" /></div>
            <h3>No exceptions found</h3>
            <p>All clear! No exceptions match your current filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
