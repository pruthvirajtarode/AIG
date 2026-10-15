import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/lib/database.types';

export interface AuditParams {
  tenantId?: string | null;
  agencyId?: string | null;
  actorId: string;
  actorEmail?: string;
  actorRole?: UserRole;
  action: string;
  entity: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  description?: string;
}

export async function createAuditLog(params: AuditParams): Promise<void> {
  try {
    await (supabase.from('audit_logs') as any).insert({
      tenant_id: params.tenantId,
      agency_id: params.agencyId,
      actor_id: params.actorId,
      actor_email: params.actorEmail,
      actor_role: params.actorRole,
      action: params.action,
      entity: params.entity,
      entity_id: params.entityId,
      old_values: params.oldValues ? JSON.parse(JSON.stringify(params.oldValues)) : null,
      new_values: params.newValues ? JSON.parse(JSON.stringify(params.newValues)) : null,
      description: params.description,
    });
  } catch (err) {
    // Audit log failure should never block the main operation
    console.error('[AuditLog] Failed to write audit log:', err);
  }
}

export async function recordStatusChange(params: {
  tenantId: string;
  entity: string;
  entityId: string;
  fromStatus: string | null;
  toStatus: string;
  reason?: string;
  transitionedBy?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await (supabase.from('status_history') as any).insert({
      tenant_id: params.tenantId,
      entity: params.entity,
      entity_id: params.entityId,
      from_status: params.fromStatus,
      to_status: params.toStatus,
      reason: params.reason,
      transitioned_by: params.transitionedBy,
      metadata: params.metadata ?? {},
    });
  } catch (err) {
    console.error('[StatusHistory] Failed to record status change:', err);
  }
}

// Common audit action constants
export const AUDIT_ACTIONS = {
  // Auth
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_CREATED: 'user.created',
  USER_ROLE_CHANGED: 'user.role_changed',
  // Orders
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_STATUS_CHANGED: 'order.status_changed',
  // Payments
  PAYMENT_SUBMITTED: 'payment.submitted',
  PAYMENT_VERIFIED: 'payment.verified',
  PAYMENT_REJECTED: 'payment.rejected',
  PAYMENT_REFUNDED: 'payment.refunded',
  // Animals
  ANIMAL_CREATED: 'animal.created',
  ANIMAL_UPDATED: 'animal.updated',
  ANIMAL_ALLOCATED: 'animal.allocated',
  ANIMAL_STATUS_CHANGED: 'animal.status_changed',
  // Deliveries
  DELIVERY_CREATED: 'delivery.created',
  DELIVERY_STATUS_CHANGED: 'delivery.status_changed',
  DELIVERY_CONFIRMED: 'delivery.confirmed',
  // Certificates
  CERTIFICATE_GENERATED: 'certificate.generated',
  CERTIFICATE_SENT: 'certificate.sent',
  // Admin
  CONFIG_CHANGED: 'config.changed',
  D3_ACCESS: 'd3.access',
} as const;
