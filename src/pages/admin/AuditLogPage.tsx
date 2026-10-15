import React, { useState } from 'react';
import { Search, FileText, Filter } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import type { UserRole } from '@/lib/database.types';

const MOCK_AUDIT_LOGS = [
  { id: 'al1', actor_email: 'admin@aigms.com', actor_role: 'super_admin' as UserRole, action: 'payment.verified', entity: 'payment', entity_id: 'PAY-2025-000042', description: 'Payment verified for order AIG-2025-000158', created_at: '2025-05-14T10:05:00Z' },
  { id: 'al2', actor_email: 'ops@aigms.com', actor_role: 'operations_admin' as UserRole, action: 'order.status_changed', entity: 'order', entity_id: 'AIG-2025-000158', description: 'Order status changed from payment_verified to confirmed', created_at: '2025-05-14T10:08:00Z' },
  { id: 'al3', actor_email: 'field@aigms.com', actor_role: 'field_team' as UserRole, action: 'animal.allocated', entity: 'animal', entity_id: 'A-2025-001', description: 'Animal A-2025-001 allocated to order AIG-2025-000156', created_at: '2025-05-13T11:30:00Z' },
  { id: 'al4', actor_email: 'admin@aigms.com', actor_role: 'super_admin' as UserRole, action: 'payment.rejected', entity: 'payment', entity_id: 'PAY-2025-000038', description: 'Payment rejected — bank slip unclear, requested resubmission', created_at: '2025-05-11T16:45:00Z' },
  { id: 'al5', actor_email: 'driver@aigms.com', actor_role: 'driver' as UserRole, action: 'delivery.status_changed', entity: 'delivery', entity_id: 'DEL-2025-001', description: 'Delivery DEL-2025-001 marked as delivered', created_at: '2025-05-10T14:32:00Z' },
  { id: 'al6', actor_email: 'admin@aigms.com', actor_role: 'super_admin' as UserRole, action: 'certificate.generated', entity: 'certificate', entity_id: 'CERT-2025-00001', description: 'Certificate generated for Siti Norzahra binti Md Zain', created_at: '2025-07-01T09:00:00Z' },
  { id: 'al7', actor_email: 'admin@aigms.com', actor_role: 'super_admin' as UserRole, action: 'certificate.sent', entity: 'certificate', entity_id: 'CERT-2025-00001', description: 'Certificate sent to siti.norzahra@email.com', created_at: '2025-07-01T09:05:00Z' },
  { id: 'al8', actor_email: 'ops@aigms.com', actor_role: 'operations_admin' as UserRole, action: 'order.created', entity: 'order', entity_id: 'AIG-2025-000158', description: 'New Qurban order created for Ahmad Rizal bin Yusof', created_at: '2025-05-14T08:22:00Z' },
  { id: 'al9', actor_email: 'd3@aigms.com', actor_role: 'd3_technical_admin' as UserRole, action: 'd3.access', entity: 'system', entity_id: null, description: 'D3 Technical Admin accessed system configuration', created_at: '2025-05-10T09:00:00Z' },
  { id: 'al10', actor_email: 'supplier@aigms.com', actor_role: 'supplier_manager' as UserRole, action: 'animal.status_changed', entity: 'animal', entity_id: 'A-2025-003', description: 'Animal A-2025-003 status changed from growing to inspection_pending', created_at: '2025-05-09T14:15:00Z' },
];

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
  const [search, setSearch] = useState('');

  const filtered = MOCK_AUDIT_LOGS.filter(l =>
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
