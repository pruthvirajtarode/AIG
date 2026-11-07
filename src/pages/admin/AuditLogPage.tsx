import React, { useState, useCallback } from 'react';
import { Search, FileText } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import type { UserRole } from '@/lib/database.types';
import { useAppData } from '@/contexts/AppDataContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/contexts/ToastContext';

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
  usePageTitle('Audit Log');
  const { toast } = useToast();
  const { auditLogs } = useAppData();
  const [search, setSearch] = useState('');

  const filtered = auditLogs.filter(l =>
    l.description.toLowerCase().includes(search.toLowerCase()) ||
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.actor_email.toLowerCase().includes(search.toLowerCase()) ||
    (l.entity_id && l.entity_id.toLowerCase().includes(search.toLowerCase()))
  );

  const handleExportCsv = useCallback(() => {
    const rows = [
      ['Timestamp', 'Actor', 'Role', 'Action', 'Entity', 'Entity ID', 'Description'],
      ...filtered.map(l => [
        l.created_at,
        l.actor_email,
        l.actor_role ?? '',
        l.action,
        l.entity,
        l.entity_id ?? '',
        l.description,
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AIGMS-Audit-Log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('success', 'Audit log exported!', `Downloaded ${filtered.length} audit log entries as CSV.`);
  }, [filtered, toast]);

  return (
    <div className="page-content animate-fadeInUp">
      <div className="page-header page-header-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">Full activity trail across the system</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportCsv}>
          <FileText size={14} />
          Export CSV
        </button>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-bar" style={{ maxWidth: 480 }}>
          <Search className="search-icon" size={15} />
          <input
            id="audit-search"
            type="search"
            className="form-input"
            placeholder="Search by action, actor, entity, or description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ height: 38 }}
          />
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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state" style={{ padding: '3rem 2rem' }}>
                      <div className="empty-icon"><FileText size={22} color="var(--text-muted)" /></div>
                      <h3>{auditLogs.length ? 'No matching audit entries' : 'No audit activity yet'}</h3>
                      <p>
                        {auditLogs.length
                          ? 'Try clearing or adjusting your search query.'
                          : 'System actions (order creation, payment verification, status updates, certificates) are recorded here automatically.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(log => (
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
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0.875rem 1.25rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Showing {filtered.length} of {auditLogs.length} entries
        </div>
      </div>
    </div>
  );
}
