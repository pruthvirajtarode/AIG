import React, { useState } from 'react';
import { Search, FileText, Filter } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import type { UserRole } from '@/lib/database.types';
import { useAppData } from '@/contexts/AppDataContext';

const MOCK_AUDIT_LOGS: {
  id: string; actor_email: string; actor_role: UserRole;
  action: string; entity: string; entity_id: string | null;
  description: string; created_at: string;
}[] = [];

const ACTION_COLOR: Record<string, string> = {
  'payment.verified': 'var(--success)',
  'payment.rejected': 'var(--danger)',
  'order.created': 'var(--info)',
  'order.status_changed': 'var(--aig-green-400)',
  'animal.allocated': 'var(--purple)',
  'animal.status_changed': 'var(--teal)',
  'delivery.status_changed': 'var(--orange)',
  'certificate.generated': 'var(--gold-400)',
  'certificate.sent': 'var(--emerald)',
  'd3.access': 'var(--text-muted)',
};

const ROLE_BADGE: Record<UserRole, string> = {
  super_admin: 'badge-red',
  operations_admin: 'badge-blue',
  supplier_manager: 'badge-purple',
  field_team: 'badge-teal',
  driver: 'badge-orange',
  participant: 'badge-gray',
  d3_technical_admin: 'badge-yellow',
};

export function AuditLogPage() {
  const { auditLogs } = useAppData();
  const [search, setSearch] = useState('');

  const filtered = auditLogs.filter(l =>
    l.description.toLowerCase().includes(search.toLowerCase()) ||
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.actor_email.toLowerCase().includes(search.toLowerCase()) ||
    (l.entity_id && l.entity_id.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="page-content animate-fadeInUp">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">Full activity trail across the system</p>
        </div>
        <button className="btn btn-secondary btn-sm">
          <FileText size={14} />
          Export CSV
        </button>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-bar" style={{ maxWidth: 480 }}>
          <Search className="search-icon" size={15} />
          <input id="audit-search" type="search" className="form-input" placeholder="Search by action, actor, entity, or description..." value={search} onChange={e => setSearch(e.target.value)} style={{ height: 38 }} />
        </div>
      </div>

      {/* Timeline */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Role</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {formatDateTime(log.created_at)}
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{log.actor_email}</td>
                  <td>
                    {log.actor_role && (
                      <span className={`badge ${ROLE_BADGE[log.actor_role]}`} style={{ fontSize: '0.65rem' }}>
                        {log.actor_role.replace(/_/g, ' ')}
                      </span>
                    )}
                  </td>
                  <td>
                    <span style={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      color: ACTION_COLOR[log.action] || 'var(--text-muted)',
                      fontWeight: 600,
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.8125rem' }}>
                      <div style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{log.entity}</div>
                      {log.entity_id && (
                        <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--aig-green-300)' }}>{log.entity_id}</div>
                      )}
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', maxWidth: 320 }}>
                    {log.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0.875rem 1.25rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Showing {filtered.length} of {MOCK_AUDIT_LOGS.length} entries
        </div>
      </div>
    </div>
  );
}
