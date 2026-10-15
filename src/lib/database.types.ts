// ============================================================
// AIGMS — Supabase Database Types
// Auto-generated type scaffold — update after schema changes
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole =
  | 'super_admin'
  | 'operations_admin'
  | 'supplier_manager'
  | 'field_team'
  | 'driver'
  | 'participant'
  | 'd3_technical_admin';

export type OrderStatus =
  | 'draft'
  | 'pending_payment'
  | 'payment_submitted'
  | 'payment_under_review'
  | 'payment_verified'
  | 'payment_rejected'
  | 'confirmed'
  | 'animal_allocated'
  | 'animal_growing'
  | 'final_inspection'
  | 'qurban_complete'
  | 'processing'
  | 'shipped'
  | 'arrived'
  | 'delivery_scheduled'
  | 'out_for_delivery'
  | 'delivered'
  | 'certificate_generated'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export type PaymentStatus = 'pending' | 'submitted' | 'under_review' | 'verified' | 'rejected' | 'refunded' | 'cancelled';
export type PaymentMethod = 'bank_transfer' | 'credit_card' | 'debit_card' | 'online_gateway' | 'cash' | 'manual';
export type AnimalStatus = 'available' | 'reserved' | 'allocated' | 'growing' | 'inspection_pending' | 'inspection_passed' | 'qurban_ready' | 'slaughtered' | 'processed' | 'completed' | 'rejected';
export type AnimalType = 'cow' | 'goat' | 'sheep' | 'camel' | 'buffalo';
export type DeliveryStatus = 'pending' | 'scheduled' | 'out_for_delivery' | 'delivered' | 'failed' | 'returned' | 'cancelled';
export type CertificateStatus = 'not_generated' | 'generating' | 'generated' | 'sent' | 'regenerated' | 'failed';
export type NotificationChannel = 'email' | 'whatsapp' | 'sms' | 'in_app';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'cancelled';
export type ExceptionSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ExceptionStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed' | 'escalated';
export type MediaEntityType = 'animal' | 'inspection' | 'delivery' | 'payment_proof' | 'certificate' | 'supplier' | 'document';
export type DistributionMethod = 'local_distribution' | 'air_freight' | 'sea_freight' | 'direct_delivery' | 'pickup';

export interface Agency {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  address: Json;
  settings: Json;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Tenant {
  id: string;
  agency_id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  timezone: string;
  currency: string;
  address: Json;
  settings: Json;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  tenant_id: string | null;
  agency_id: string | null;
  role: UserRole;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  country: string | null;
  is_active: boolean;
  last_login_at: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface Programme {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  country: string;
  region: string | null;
  animal_type: AnimalType;
  animals_per_share: number;
  shares_available: number | null;
  min_quantity: number;
  max_quantity: number | null;
  price_per_share: number;
  currency: string;
  distribution_method: DistributionMethod;
  delivery_required: boolean;
  certificate_required: boolean;
  evidence_required: boolean;
  workflow_config: Json;
  status_flow: string[];
  notification_config: Json;
  starts_at: string | null;
  ends_at: string | null;
  qurban_date: string | null;
  is_active: boolean;
  sort_order: number;
  metadata: Json;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Participant {
  id: string;
  tenant_id: string;
  profile_id: string | null;
  participant_ref: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  ic_number: string | null;
  country: string;
  nationality: string | null;
  metadata: Json;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ParticipantAddress {
  id: string;
  participant_id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  tenant_id: string;
  order_ref: string;
  participant_id: string;
  programme_id: string;
  status: OrderStatus;
  quantity: number;
  unit_price: number;
  total_amount: number;
  currency: string;
  recipient_name: string | null;
  recipient_notes: string | null;
  delivery_address: Json | null;
  special_requests: string | null;
  internal_notes: string | null;
  metadata: Json;
  confirmed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Joined fields
  participants?: Participant;
  programmes?: Programme;
}

export interface Payment {
  id: string;
  tenant_id: string;
  order_id: string;
  participant_id: string;
  payment_ref: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  gateway: string | null;
  gateway_transaction_ref: string | null;
  gateway_response: Json | null;
  status: PaymentStatus;
  submitted_at: string | null;
  verified_at: string | null;
  verified_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  refunded_at: string | null;
  refund_reference: string | null;
  notes: string | null;
  metadata: Json;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentProof {
  id: string;
  payment_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_key: string;
  bank_name: string | null;
  account_last4: string | null;
  transfer_date: string | null;
  transfer_ref: string | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface Supplier {
  id: string;
  tenant_id: string;
  supplier_ref: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  country: string;
  region: string | null;
  address: Json;
  animal_types: AnimalType[];
  is_active: boolean;
  notes: string | null;
  metadata: Json;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Animal {
  id: string;
  tenant_id: string;
  animal_ref: string;
  supplier_id: string | null;
  animal_type: AnimalType;
  breed: string | null;
  gender: 'male' | 'female' | 'unknown' | null;
  estimated_age_months: number | null;
  country: string | null;
  location: string | null;
  farm_name: string | null;
  tag_number: string | null;
  status: AnimalStatus;
  initial_weight_kg: number | null;
  current_weight_kg: number | null;
  min_weight_kg: number | null;
  notes: string | null;
  metadata: Json;
  slaughtered_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Joined
  suppliers?: Supplier;
  animal_allocations?: AnimalAllocation[];
}

export interface AnimalAllocation {
  id: string;
  tenant_id: string;
  animal_id: string;
  order_id: string;
  participant_id: string;
  programme_id: string;
  allocated_at: string;
  allocated_by: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AnimalUpdate {
  id: string;
  animal_id: string;
  tenant_id: string;
  update_type: 'growth' | 'health' | 'weight' | 'inspection' | 'note' | 'photo' | 'video' | 'status';
  title: string;
  description: string | null;
  is_public: boolean;
  recorded_by: string | null;
  recorded_at: string;
  metadata: Json;
  created_at: string;
}

export interface AnimalWeight {
  id: string;
  animal_id: string;
  weight_kg: number;
  weighed_at: string;
  recorded_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface AnimalHealthRecord {
  id: string;
  animal_id: string;
  health_status: 'healthy' | 'sick' | 'recovering' | 'rejected' | 'deceased';
  condition: string | null;
  treatment: string | null;
  vet_name: string | null;
  examined_at: string;
  next_check_at: string | null;
  recorded_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface AnimalInspection {
  id: string;
  animal_id: string;
  tenant_id: string;
  inspection_type: 'pre_allocation' | 'routine' | 'final' | 'post_qurban';
  result: 'passed' | 'failed' | 'conditional' | 'pending';
  inspector_name: string | null;
  inspector_id: string | null;
  weight_kg: number | null;
  findings: string | null;
  conditions: string | null;
  inspected_at: string;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  metadata: Json;
  created_at: string;
}

export interface QurbanExecution {
  id: string;
  tenant_id: string;
  animal_id: string;
  order_id: string | null;
  programme_id: string | null;
  executed_at: string | null;
  location: string | null;
  officiant_name: string | null;
  method: string | null;
  slaughter_ref: string | null;
  verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
  metadata: Json;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Distribution {
  id: string;
  tenant_id: string;
  order_id: string;
  programme_id: string;
  method: DistributionMethod;
  origin_country: string | null;
  destination_country: string | null;
  shipment_ref: string | null;
  carrier: string | null;
  processing_started_at: string | null;
  shipped_at: string | null;
  arrived_at: string | null;
  estimated_arrival: string | null;
  notes: string | null;
  metadata: Json;
  status: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Delivery {
  id: string;
  tenant_id: string;
  order_id: string;
  distribution_id: string | null;
  participant_id: string;
  delivery_ref: string;
  status: DeliveryStatus;
  delivery_address: Json;
  contact_name: string;
  contact_phone: string;
  scheduled_date: string | null;
  delivery_slot: string | null;
  driver_id: string | null;
  driver_notes: string | null;
  delivered_at: string | null;
  delivery_notes: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  metadata: Json;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaAsset {
  id: string;
  tenant_id: string;
  entity_type: MediaEntityType;
  entity_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  mime_type: string | null;
  storage_key: string;
  storage_provider: string;
  public_url: string | null;
  thumbnail_key: string | null;
  caption: string | null;
  is_public: boolean;
  sort_order: number;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Certificate {
  id: string;
  tenant_id: string;
  order_id: string;
  participant_id: string;
  certificate_ref: string;
  status: CertificateStatus;
  programme_name: string;
  participant_name: string;
  qurban_date: string | null;
  animal_ref: string | null;
  animal_type: string | null;
  storage_key: string | null;
  public_url: string | null;
  verification_code: string;
  generated_at: string | null;
  generated_by: string | null;
  sent_at: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface Exception {
  id: string;
  tenant_id: string;
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  category: string;
  title: string;
  description: string;
  related_entity: string | null;
  related_entity_id: string | null;
  assigned_to: string | null;
  resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  auto_generated: boolean;
  metadata: Json;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  tenant_id: string | null;
  agency_id: string | null;
  actor_id: string | null;
  actor_email: string | null;
  actor_role: UserRole | null;
  action: string;
  entity: string;
  entity_id: string | null;
  old_values: Json | null;
  new_values: Json | null;
  description: string | null;
  ip_address: string | null;
  user_agent: string | null;
  session_id: string | null;
  created_at: string;
}

export interface StatusHistory {
  id: string;
  tenant_id: string;
  entity: string;
  entity_id: string;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  transitioned_by: string | null;
  transitioned_at: string;
  metadata: Json;
  created_at: string;
}

export interface Notification {
  id: string;
  tenant_id: string;
  template_id: string | null;
  channel: NotificationChannel;
  recipient_id: string | null;
  recipient_email: string | null;
  recipient_phone: string | null;
  subject: string | null;
  body: string;
  trigger_event: string | null;
  related_entity: string | null;
  related_entity_id: string | null;
  status: NotificationStatus;
  sent_at: string | null;
  delivered_at: string | null;
  failure_reason: string | null;
  retry_count: number;
  provider_ref: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

// ── Database convenience type ─────────────────────────────────
export interface Database {
  public: {
    Tables: {
      agencies: { Row: Agency; Insert: Partial<Agency>; Update: Partial<Agency> };
      tenants: { Row: Tenant; Insert: Partial<Tenant>; Update: Partial<Tenant> };
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      programmes: { Row: Programme; Insert: Partial<Programme>; Update: Partial<Programme> };
      participants: { Row: Participant; Insert: Partial<Participant>; Update: Partial<Participant> };
      participant_addresses: { Row: ParticipantAddress; Insert: Partial<ParticipantAddress>; Update: Partial<ParticipantAddress> };
      orders: { Row: Order; Insert: Partial<Order>; Update: Partial<Order> };
      payments: { Row: Payment; Insert: Partial<Payment>; Update: Partial<Payment> };
      payment_proofs: { Row: PaymentProof; Insert: Partial<PaymentProof>; Update: Partial<PaymentProof> };
      suppliers: { Row: Supplier; Insert: Partial<Supplier>; Update: Partial<Supplier> };
      animals: { Row: Animal; Insert: Partial<Animal>; Update: Partial<Animal> };
      animal_allocations: { Row: AnimalAllocation; Insert: Partial<AnimalAllocation>; Update: Partial<AnimalAllocation> };
      animal_updates: { Row: AnimalUpdate; Insert: Partial<AnimalUpdate>; Update: Partial<AnimalUpdate> };
      animal_weights: { Row: AnimalWeight; Insert: Partial<AnimalWeight>; Update: Partial<AnimalWeight> };
      animal_health_records: { Row: AnimalHealthRecord; Insert: Partial<AnimalHealthRecord>; Update: Partial<AnimalHealthRecord> };
      animal_inspections: { Row: AnimalInspection; Insert: Partial<AnimalInspection>; Update: Partial<AnimalInspection> };
      qurban_executions: { Row: QurbanExecution; Insert: Partial<QurbanExecution>; Update: Partial<QurbanExecution> };
      distributions: { Row: Distribution; Insert: Partial<Distribution>; Update: Partial<Distribution> };
      deliveries: { Row: Delivery; Insert: Partial<Delivery>; Update: Partial<Delivery> };
      delivery_events: { Row: { id: string; delivery_id: string; event_type: string; description: string; location: string | null; recorded_by: string | null; recorded_at: string; metadata: Json; created_at: string }; Insert: Record<string, unknown>; Update: Record<string, unknown> };
      media_assets: { Row: MediaAsset; Insert: Partial<MediaAsset>; Update: Partial<MediaAsset> };
      certificates: { Row: Certificate; Insert: Partial<Certificate>; Update: Partial<Certificate> };
      exceptions: { Row: Exception; Insert: Partial<Exception>; Update: Partial<Exception> };
      audit_logs: { Row: AuditLog; Insert: Partial<AuditLog>; Update: Partial<AuditLog> };
      status_history: { Row: StatusHistory; Insert: Partial<StatusHistory>; Update: Partial<StatusHistory> };
      notifications: { Row: Notification; Insert: Partial<Notification>; Update: Partial<Notification> };
      system_settings: { Row: { id: string; tenant_id: string | null; key: string; value: Json; description: string | null; is_public: boolean; updated_by: string | null; created_at: string; updated_at: string }; Insert: Record<string, unknown>; Update: Record<string, unknown> };
    };
    Enums: {
      user_role: UserRole;
      order_status: OrderStatus;
      payment_status: PaymentStatus;
      animal_status: AnimalStatus;
      animal_type: AnimalType;
      delivery_status: DeliveryStatus;
    };
  };
}
