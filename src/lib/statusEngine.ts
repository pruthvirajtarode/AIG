// ============================================================
// Status Engine — centralized status definitions and transitions
// ============================================================

import type { OrderStatus } from '@/lib/database.types';

export interface StatusConfig {
  label: string;
  color: 'gray' | 'yellow' | 'orange' | 'blue' | 'green' | 'red' | 'purple' | 'teal' | 'emerald';
  description: string;
  allowedTransitions: OrderStatus[];
  requiresApproval: boolean;
  notificationEvent?: string;
}

export const ORDER_STATUS_CONFIG: Record<OrderStatus, StatusConfig> = {
  draft: {
    label: 'Draft',
    color: 'gray',
    description: 'Order is being prepared',
    allowedTransitions: ['pending_payment', 'cancelled'],
    requiresApproval: false,
  },
  pending_payment: {
    label: 'Pending Payment',
    color: 'yellow',
    description: 'Awaiting payment from participant',
    allowedTransitions: ['payment_submitted', 'cancelled'],
    requiresApproval: false,
    notificationEvent: 'order.created',
  },
  payment_submitted: {
    label: 'Payment Submitted',
    color: 'orange',
    description: 'Payment proof has been submitted, awaiting review',
    allowedTransitions: ['payment_under_review', 'payment_verified', 'payment_rejected'],
    requiresApproval: true,
    notificationEvent: 'payment.submitted',
  },
  payment_under_review: {
    label: 'Under Review',
    color: 'orange',
    description: 'Payment is being reviewed by the team',
    allowedTransitions: ['payment_verified', 'payment_rejected'],
    requiresApproval: true,
  },
  payment_verified: {
    label: 'Payment Verified',
    color: 'blue',
    description: 'Payment has been verified',
    allowedTransitions: ['confirmed'],
    requiresApproval: false,
    notificationEvent: 'payment.verified',
  },
  payment_rejected: {
    label: 'Payment Rejected',
    color: 'red',
    description: 'Payment was rejected. Participant needs to resubmit.',
    allowedTransitions: ['pending_payment', 'refunded', 'cancelled'],
    requiresApproval: true,
    notificationEvent: 'payment.rejected',
  },
  confirmed: {
    label: 'Confirmed',
    color: 'blue',
    description: 'Qurban order is confirmed. Animal allocation in progress.',
    allowedTransitions: ['animal_allocated'],
    requiresApproval: false,
    notificationEvent: 'order.confirmed',
  },
  animal_allocated: {
    label: 'Animal Allocated',
    color: 'purple',
    description: 'Animal has been assigned to this order',
    allowedTransitions: ['animal_growing', 'qurban_complete'],
    requiresApproval: false,
    notificationEvent: 'animal.allocated',
  },
  animal_growing: {
    label: 'Animal Growing',
    color: 'teal',
    description: 'Animal is in the growing/fattening phase',
    allowedTransitions: ['final_inspection'],
    requiresApproval: false,
  },
  final_inspection: {
    label: 'Final Inspection',
    color: 'orange',
    description: 'Animal is undergoing final pre-Qurban inspection',
    allowedTransitions: ['qurban_complete'],
    requiresApproval: true,
  },
  qurban_complete: {
    label: 'Qurban Complete',
    color: 'green',
    description: 'Qurban has been performed',
    allowedTransitions: ['processing', 'delivery_scheduled', 'certificate_generated', 'completed'],
    requiresApproval: true,
    notificationEvent: 'qurban.complete',
  },
  processing: {
    label: 'Processing',
    color: 'blue',
    description: 'Meat is being processed',
    allowedTransitions: ['shipped'],
    requiresApproval: false,
  },
  shipped: {
    label: 'Shipped',
    color: 'blue',
    description: 'Shipment is in transit',
    allowedTransitions: ['arrived'],
    requiresApproval: false,
    notificationEvent: 'shipment.shipped',
  },
  arrived: {
    label: 'Arrived',
    color: 'teal',
    description: 'Shipment has arrived at destination',
    allowedTransitions: ['delivery_scheduled'],
    requiresApproval: false,
    notificationEvent: 'shipment.arrived',
  },
  delivery_scheduled: {
    label: 'Delivery Scheduled',
    color: 'blue',
    description: 'Delivery has been scheduled',
    allowedTransitions: ['out_for_delivery'],
    requiresApproval: false,
    notificationEvent: 'delivery.scheduled',
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    color: 'orange',
    description: 'Driver is delivering the order',
    allowedTransitions: ['delivered'],
    requiresApproval: false,
    notificationEvent: 'delivery.out',
  },
  delivered: {
    label: 'Delivered',
    color: 'green',
    description: 'Order has been delivered',
    allowedTransitions: ['certificate_generated', 'completed'],
    requiresApproval: true,
    notificationEvent: 'delivery.delivered',
  },
  certificate_generated: {
    label: 'Certificate Generated',
    color: 'emerald',
    description: 'Certificate has been generated and is ready for download',
    allowedTransitions: ['completed'],
    requiresApproval: false,
    notificationEvent: 'certificate.ready',
  },
  completed: {
    label: 'Completed',
    color: 'green',
    description: 'Order is fully completed',
    allowedTransitions: [],
    requiresApproval: false,
    notificationEvent: 'order.completed',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'red',
    description: 'Order has been cancelled',
    allowedTransitions: [],
    requiresApproval: false,
  },
  refunded: {
    label: 'Refunded',
    color: 'gray',
    description: 'Payment has been refunded',
    allowedTransitions: [],
    requiresApproval: false,
  },
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_CONFIG[from]?.allowedTransitions?.includes(to) ?? false;
}

export function getStatusConfig(status: OrderStatus): StatusConfig {
  return ORDER_STATUS_CONFIG[status] ?? {
    label: status,
    color: 'gray',
    description: '',
    allowedTransitions: [],
    requiresApproval: false,
  };
}

export function getStatusLabel(status: string): string {
  return ORDER_STATUS_CONFIG[status as OrderStatus]?.label ?? status;
}

export function getStatusColor(status: string): StatusConfig['color'] {
  return ORDER_STATUS_CONFIG[status as OrderStatus]?.color ?? 'gray';
}
