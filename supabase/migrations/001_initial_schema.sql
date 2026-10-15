-- ============================================================
-- AIGMS — Al Ihsan Group Qurban Management System
-- Migration: 001_initial_schema.sql
-- Created by: Daredevil Digital (D3)
-- Description: Full database schema with multi-tenant architecture,
--              RLS policies, indexes, constraints, and audit support.
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM (
  'super_admin',
  'operations_admin',
  'supplier_manager',
  'field_team',
  'driver',
  'participant',
  'd3_technical_admin'
);

CREATE TYPE order_status AS ENUM (
  'draft',
  'pending_payment',
  'payment_submitted',
  'payment_under_review',
  'payment_verified',
  'payment_rejected',
  'confirmed',
  'animal_allocated',
  'animal_growing',
  'final_inspection',
  'qurban_complete',
  'processing',
  'shipped',
  'arrived',
  'delivery_scheduled',
  'out_for_delivery',
  'delivered',
  'certificate_generated',
  'completed',
  'cancelled',
  'refunded'
);

CREATE TYPE payment_status AS ENUM (
  'pending',
  'submitted',
  'under_review',
  'verified',
  'rejected',
  'refunded',
  'cancelled'
);

CREATE TYPE payment_method AS ENUM (
  'bank_transfer',
  'credit_card',
  'debit_card',
  'online_gateway',
  'cash',
  'manual'
);

CREATE TYPE animal_status AS ENUM (
  'available',
  'reserved',
  'allocated',
  'growing',
  'inspection_pending',
  'inspection_passed',
  'qurban_ready',
  'slaughtered',
  'processed',
  'completed',
  'rejected'
);

CREATE TYPE animal_type AS ENUM (
  'cow',
  'goat',
  'sheep',
  'camel',
  'buffalo'
);

CREATE TYPE delivery_status AS ENUM (
  'pending',
  'scheduled',
  'out_for_delivery',
  'delivered',
  'failed',
  'returned',
  'cancelled'
);

CREATE TYPE certificate_status AS ENUM (
  'not_generated',
  'generating',
  'generated',
  'sent',
  'regenerated',
  'failed'
);

CREATE TYPE notification_channel AS ENUM (
  'email',
  'whatsapp',
  'sms',
  'in_app'
);

CREATE TYPE notification_status AS ENUM (
  'pending',
  'sent',
  'delivered',
  'failed',
  'cancelled'
);

CREATE TYPE exception_severity AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);

CREATE TYPE exception_status AS ENUM (
  'open',
  'in_progress',
  'resolved',
  'dismissed',
  'escalated'
);

CREATE TYPE media_entity_type AS ENUM (
  'animal',
  'inspection',
  'delivery',
  'payment_proof',
  'certificate',
  'supplier',
  'document'
);

CREATE TYPE distribution_method AS ENUM (
  'local_distribution',
  'air_freight',
  'sea_freight',
  'direct_delivery',
  'pickup'
);

-- ============================================================
-- 1. AGENCIES (Master agency — Daredevil Digital)
-- ============================================================

CREATE TABLE agencies (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  email             TEXT,
  phone             TEXT,
  website           TEXT,
  logo_url          TEXT,
  address           JSONB DEFAULT '{}',
  settings          JSONB DEFAULT '{}',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agencies_slug ON agencies(slug);

-- ============================================================
-- 2. TENANTS (Client sub-accounts, e.g. Al Ihsan Group)
-- ============================================================

CREATE TABLE tenants (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id         UUID NOT NULL REFERENCES agencies(id) ON DELETE RESTRICT,
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  email             TEXT,
  phone             TEXT,
  website           TEXT,
  logo_url          TEXT,
  timezone          TEXT NOT NULL DEFAULT 'Asia/Singapore',
  currency          TEXT NOT NULL DEFAULT 'SGD',
  address           JSONB DEFAULT '{}',
  settings          JSONB DEFAULT '{}',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_agency_id ON tenants(agency_id);
CREATE INDEX idx_tenants_slug ON tenants(slug);

-- ============================================================
-- 3. PROFILES (extends Supabase auth.users)
-- ============================================================

CREATE TABLE profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id         UUID REFERENCES tenants(id) ON DELETE SET NULL,
  agency_id         UUID REFERENCES agencies(id) ON DELETE SET NULL,
  role              user_role NOT NULL DEFAULT 'participant',
  first_name        TEXT NOT NULL DEFAULT '',
  last_name         TEXT NOT NULL DEFAULT '',
  email             TEXT NOT NULL,
  phone             TEXT,
  avatar_url        TEXT,
  country           TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at     TIMESTAMPTZ,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_tenant_id ON profiles(tenant_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);

-- ============================================================
-- 4. PROGRAMMES (7 Qurban programmes — configurable)
-- ============================================================

CREATE TABLE programmes (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  slug                  TEXT NOT NULL,
  description           TEXT,
  country               TEXT NOT NULL,
  region                TEXT,
  animal_type           animal_type NOT NULL DEFAULT 'cow',
  animals_per_share     INTEGER NOT NULL DEFAULT 1,
  shares_available      INTEGER,
  min_quantity          INTEGER NOT NULL DEFAULT 1,
  max_quantity          INTEGER,
  price_per_share       NUMERIC(12,2) NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'SGD',
  distribution_method   distribution_method NOT NULL DEFAULT 'local_distribution',
  delivery_required     BOOLEAN NOT NULL DEFAULT FALSE,
  certificate_required  BOOLEAN NOT NULL DEFAULT TRUE,
  evidence_required     BOOLEAN NOT NULL DEFAULT TRUE,
  workflow_config       JSONB NOT NULL DEFAULT '{}',
  status_flow           TEXT[] NOT NULL DEFAULT '{}',
  notification_config   JSONB NOT NULL DEFAULT '{}',
  starts_at             DATE,
  ends_at               DATE,
  qurban_date           DATE,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  metadata              JSONB DEFAULT '{}',
  created_by            UUID REFERENCES profiles(id),
  updated_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_programmes_tenant_id ON programmes(tenant_id);
CREATE INDEX idx_programmes_is_active ON programmes(is_active);

-- ============================================================
-- 5. PARTICIPANTS
-- ============================================================

CREATE TABLE participants (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  participant_ref   TEXT NOT NULL,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  email             TEXT NOT NULL,
  phone             TEXT NOT NULL,
  ic_number         TEXT,
  country           TEXT NOT NULL,
  nationality       TEXT,
  metadata          JSONB DEFAULT '{}',
  notes             TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_by        UUID REFERENCES profiles(id),
  updated_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE(tenant_id, participant_ref),
  UNIQUE(tenant_id, email)
);

CREATE INDEX idx_participants_tenant_id ON participants(tenant_id);
CREATE INDEX idx_participants_profile_id ON participants(profile_id);
CREATE INDEX idx_participants_email ON participants(email);
CREATE INDEX idx_participants_ref ON participants(participant_ref);

-- ============================================================
-- 6. PARTICIPANT ADDRESSES
-- ============================================================

CREATE TABLE participant_addresses (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_id    UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  label             TEXT NOT NULL DEFAULT 'Home',
  line1             TEXT NOT NULL,
  line2             TEXT,
  city              TEXT NOT NULL,
  state             TEXT,
  postal_code       TEXT,
  country           TEXT NOT NULL,
  is_default        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_participant_addresses_participant_id ON participant_addresses(participant_id);

-- ============================================================
-- 7. ORDERS
-- ============================================================

CREATE TABLE orders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_ref         TEXT NOT NULL,
  participant_id    UUID NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,
  programme_id      UUID NOT NULL REFERENCES programmes(id) ON DELETE RESTRICT,
  status            order_status NOT NULL DEFAULT 'pending_payment',
  quantity          INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price        NUMERIC(12,2) NOT NULL,
  total_amount      NUMERIC(12,2) NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'SGD',
  recipient_name    TEXT,
  recipient_notes   TEXT,
  delivery_address  JSONB,
  special_requests  TEXT,
  internal_notes    TEXT,
  metadata          JSONB DEFAULT '{}',
  confirmed_at      TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  cancel_reason     TEXT,
  created_by        UUID REFERENCES profiles(id),
  updated_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE(tenant_id, order_ref)
);

CREATE INDEX idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX idx_orders_participant_id ON orders(participant_id);
CREATE INDEX idx_orders_programme_id ON orders(programme_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_ref ON orders(order_ref);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- ============================================================
-- 8. ORDER ITEMS (for detailed line items)
-- ============================================================

CREATE TABLE order_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  description       TEXT NOT NULL,
  quantity          INTEGER NOT NULL DEFAULT 1,
  unit_price        NUMERIC(12,2) NOT NULL,
  total_price       NUMERIC(12,2) NOT NULL,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- ============================================================
-- 9. PAYMENTS
-- ============================================================

CREATE TABLE payments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id              UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  participant_id        UUID NOT NULL REFERENCES participants(id) ON DELETE RESTRICT,
  payment_ref           TEXT NOT NULL,
  amount                NUMERIC(12,2) NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'SGD',
  method                payment_method NOT NULL DEFAULT 'bank_transfer',
  gateway               TEXT,
  gateway_transaction_ref TEXT,
  gateway_response      JSONB,
  status                payment_status NOT NULL DEFAULT 'pending',
  submitted_at          TIMESTAMPTZ,
  verified_at           TIMESTAMPTZ,
  verified_by           UUID REFERENCES profiles(id),
  rejected_at           TIMESTAMPTZ,
  rejected_by           UUID REFERENCES profiles(id),
  rejection_reason      TEXT,
  refunded_at           TIMESTAMPTZ,
  refund_reference      TEXT,
  notes                 TEXT,
  metadata              JSONB DEFAULT '{}',
  created_by            UUID REFERENCES profiles(id),
  updated_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, payment_ref)
);

CREATE INDEX idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_participant_id ON payments(participant_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);

-- ============================================================
-- 10. PAYMENT PROOFS
-- ============================================================

CREATE TABLE payment_proofs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id        UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  file_name         TEXT NOT NULL,
  file_type         TEXT NOT NULL,
  file_size         INTEGER NOT NULL,
  storage_key       TEXT NOT NULL,
  bank_name         TEXT,
  account_last4     TEXT,
  transfer_date     DATE,
  transfer_ref      TEXT,
  notes             TEXT,
  uploaded_by       UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_proofs_payment_id ON payment_proofs(payment_id);

-- ============================================================
-- 11. SUPPLIERS
-- ============================================================

CREATE TABLE suppliers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_ref      TEXT NOT NULL,
  name              TEXT NOT NULL,
  contact_name      TEXT,
  email             TEXT,
  phone             TEXT,
  country           TEXT NOT NULL,
  region            TEXT,
  address           JSONB DEFAULT '{}',
  animal_types      animal_type[] DEFAULT '{}',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  notes             TEXT,
  metadata          JSONB DEFAULT '{}',
  created_by        UUID REFERENCES profiles(id),
  updated_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, supplier_ref)
);

CREATE INDEX idx_suppliers_tenant_id ON suppliers(tenant_id);

-- ============================================================
-- 12. ANIMALS
-- ============================================================

CREATE TABLE animals (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  animal_ref        TEXT NOT NULL,
  supplier_id       UUID REFERENCES suppliers(id),
  animal_type       animal_type NOT NULL,
  breed             TEXT,
  gender            TEXT CHECK (gender IN ('male', 'female', 'unknown')),
  estimated_age_months INTEGER,
  country           TEXT,
  location          TEXT,
  farm_name         TEXT,
  tag_number        TEXT,
  status            animal_status NOT NULL DEFAULT 'available',
  initial_weight_kg NUMERIC(8,2),
  current_weight_kg NUMERIC(8,2),
  min_weight_kg     NUMERIC(8,2),
  notes             TEXT,
  metadata          JSONB DEFAULT '{}',
  slaughtered_at    TIMESTAMPTZ,
  created_by        UUID REFERENCES profiles(id),
  updated_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE(tenant_id, animal_ref)
);

CREATE INDEX idx_animals_tenant_id ON animals(tenant_id);
CREATE INDEX idx_animals_supplier_id ON animals(supplier_id);
CREATE INDEX idx_animals_status ON animals(status);
CREATE INDEX idx_animals_animal_type ON animals(animal_type);

-- ============================================================
-- 13. ANIMAL ALLOCATIONS (links orders → animals)
-- ============================================================

CREATE TABLE animal_allocations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  animal_id         UUID NOT NULL REFERENCES animals(id) ON DELETE RESTRICT,
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  participant_id    UUID NOT NULL REFERENCES participants(id),
  programme_id      UUID NOT NULL REFERENCES programmes(id),
  allocated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  allocated_by      UUID REFERENCES profiles(id),
  notes             TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_animal_allocations_animal_id ON animal_allocations(animal_id);
CREATE INDEX idx_animal_allocations_order_id ON animal_allocations(order_id);
CREATE INDEX idx_animal_allocations_tenant_id ON animal_allocations(tenant_id);
CREATE UNIQUE INDEX idx_animal_allocations_unique ON animal_allocations(animal_id) WHERE is_active = TRUE;

-- ============================================================
-- 14. ANIMAL UPDATES (growth / general updates)
-- ============================================================

CREATE TABLE animal_updates (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id         UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  update_type       TEXT NOT NULL CHECK (update_type IN ('growth','health','weight','inspection','note','photo','video','status')),
  title             TEXT NOT NULL,
  description       TEXT,
  is_public         BOOLEAN NOT NULL DEFAULT TRUE,
  recorded_by       UUID REFERENCES profiles(id),
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_animal_updates_animal_id ON animal_updates(animal_id);
CREATE INDEX idx_animal_updates_tenant_id ON animal_updates(tenant_id);
CREATE INDEX idx_animal_updates_recorded_at ON animal_updates(recorded_at DESC);

-- ============================================================
-- 15. ANIMAL WEIGHTS (weight history)
-- ============================================================

CREATE TABLE animal_weights (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id         UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  weight_kg         NUMERIC(8,2) NOT NULL CHECK (weight_kg > 0),
  weighed_at        DATE NOT NULL,
  recorded_by       UUID REFERENCES profiles(id),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_animal_weights_animal_id ON animal_weights(animal_id);
CREATE INDEX idx_animal_weights_weighed_at ON animal_weights(weighed_at DESC);

-- ============================================================
-- 16. ANIMAL HEALTH RECORDS
-- ============================================================

CREATE TABLE animal_health_records (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id         UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  health_status     TEXT NOT NULL CHECK (health_status IN ('healthy','sick','recovering','rejected','deceased')),
  condition         TEXT,
  treatment         TEXT,
  vet_name          TEXT,
  examined_at       DATE NOT NULL,
  next_check_at     DATE,
  recorded_by       UUID REFERENCES profiles(id),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_animal_health_records_animal_id ON animal_health_records(animal_id);

-- ============================================================
-- 17. ANIMAL INSPECTIONS
-- ============================================================

CREATE TABLE animal_inspections (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  animal_id         UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  inspection_type   TEXT NOT NULL CHECK (inspection_type IN ('pre_allocation','routine','final','post_qurban')),
  result            TEXT NOT NULL CHECK (result IN ('passed','failed','conditional','pending')),
  inspector_name    TEXT,
  inspector_id      UUID REFERENCES profiles(id),
  weight_kg         NUMERIC(8,2),
  findings          TEXT,
  conditions        TEXT,
  inspected_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by       UUID REFERENCES profiles(id),
  approved_at       TIMESTAMPTZ,
  notes             TEXT,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_animal_inspections_animal_id ON animal_inspections(animal_id);

-- ============================================================
-- 18. QURBAN EXECUTIONS
-- ============================================================

CREATE TABLE qurban_executions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  animal_id         UUID NOT NULL REFERENCES animals(id) ON DELETE RESTRICT,
  order_id          UUID REFERENCES orders(id),
  programme_id      UUID REFERENCES programmes(id),
  executed_at       TIMESTAMPTZ,
  location          TEXT,
  officiant_name    TEXT,
  method            TEXT,
  slaughter_ref     TEXT,
  verified          BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by       UUID REFERENCES profiles(id),
  verified_at       TIMESTAMPTZ,
  notes             TEXT,
  metadata          JSONB DEFAULT '{}',
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qurban_executions_animal_id ON qurban_executions(animal_id);
CREATE INDEX idx_qurban_executions_order_id ON qurban_executions(order_id);

-- ============================================================
-- 19. DISTRIBUTIONS
-- ============================================================

CREATE TABLE distributions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  programme_id      UUID NOT NULL REFERENCES programmes(id),
  method            distribution_method NOT NULL,
  origin_country    TEXT,
  destination_country TEXT,
  shipment_ref      TEXT,
  carrier           TEXT,
  processing_started_at TIMESTAMPTZ,
  shipped_at        TIMESTAMPTZ,
  arrived_at        TIMESTAMPTZ,
  estimated_arrival DATE,
  notes             TEXT,
  metadata          JSONB DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'pending',
  created_by        UUID REFERENCES profiles(id),
  updated_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_distributions_tenant_id ON distributions(tenant_id);
CREATE INDEX idx_distributions_order_id ON distributions(order_id);

-- ============================================================
-- 20. DELIVERIES
-- ============================================================

CREATE TABLE deliveries (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  distribution_id   UUID REFERENCES distributions(id),
  participant_id    UUID NOT NULL REFERENCES participants(id),
  delivery_ref      TEXT NOT NULL,
  status            delivery_status NOT NULL DEFAULT 'pending',
  delivery_address  JSONB NOT NULL,
  contact_name      TEXT NOT NULL,
  contact_phone     TEXT NOT NULL,
  scheduled_date    DATE,
  delivery_slot     TEXT,
  driver_id         UUID REFERENCES profiles(id),
  driver_notes      TEXT,
  delivered_at      TIMESTAMPTZ,
  delivery_notes    TEXT,
  confirmed_by      UUID REFERENCES profiles(id),
  confirmed_at      TIMESTAMPTZ,
  metadata          JSONB DEFAULT '{}',
  created_by        UUID REFERENCES profiles(id),
  updated_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, delivery_ref)
);

CREATE INDEX idx_deliveries_tenant_id ON deliveries(tenant_id);
CREATE INDEX idx_deliveries_order_id ON deliveries(order_id);
CREATE INDEX idx_deliveries_driver_id ON deliveries(driver_id);
CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_deliveries_scheduled_date ON deliveries(scheduled_date);

-- ============================================================
-- 21. DELIVERY EVENTS (tracking history)
-- ============================================================

CREATE TABLE delivery_events (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id       UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  event_type        TEXT NOT NULL,
  description       TEXT NOT NULL,
  location          TEXT,
  recorded_by       UUID REFERENCES profiles(id),
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_delivery_events_delivery_id ON delivery_events(delivery_id);

-- ============================================================
-- 22. MEDIA ASSETS
-- ============================================================

CREATE TABLE media_assets (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  entity_type       media_entity_type NOT NULL,
  entity_id         UUID NOT NULL,
  file_name         TEXT NOT NULL,
  file_type         TEXT NOT NULL,
  file_size         INTEGER NOT NULL CHECK (file_size > 0),
  mime_type         TEXT,
  storage_key       TEXT NOT NULL,
  storage_provider  TEXT NOT NULL DEFAULT 'r2',
  public_url        TEXT,
  thumbnail_key     TEXT,
  caption           TEXT,
  is_public         BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  uploaded_by       UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_media_assets_tenant_id ON media_assets(tenant_id);
CREATE INDEX idx_media_assets_entity ON media_assets(entity_type, entity_id);
CREATE INDEX idx_media_assets_storage_key ON media_assets(storage_key);

-- ============================================================
-- 23. CERTIFICATES
-- ============================================================

CREATE TABLE certificates (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  participant_id    UUID NOT NULL REFERENCES participants(id),
  certificate_ref   TEXT NOT NULL,
  status            certificate_status NOT NULL DEFAULT 'not_generated',
  programme_name    TEXT NOT NULL,
  participant_name  TEXT NOT NULL,
  qurban_date       DATE,
  animal_ref        TEXT,
  animal_type       TEXT,
  storage_key       TEXT,
  public_url        TEXT,
  verification_code TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  generated_at      TIMESTAMPTZ,
  generated_by      UUID REFERENCES profiles(id),
  sent_at           TIMESTAMPTZ,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, certificate_ref),
  UNIQUE(verification_code)
);

CREATE INDEX idx_certificates_tenant_id ON certificates(tenant_id);
CREATE INDEX idx_certificates_order_id ON certificates(order_id);
CREATE INDEX idx_certificates_participant_id ON certificates(participant_id);
CREATE INDEX idx_certificates_verification_code ON certificates(verification_code);

-- ============================================================
-- 24. NOTIFICATION TEMPLATES
-- ============================================================

CREATE TABLE notification_templates (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  trigger_event     TEXT NOT NULL,
  channel           notification_channel NOT NULL,
  name              TEXT NOT NULL,
  subject           TEXT,
  body              TEXT NOT NULL,
  variables         TEXT[] DEFAULT '{}',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  metadata          JSONB DEFAULT '{}',
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, trigger_event, channel)
);

CREATE INDEX idx_notification_templates_tenant_id ON notification_templates(tenant_id);

-- ============================================================
-- 25. NOTIFICATIONS (outbound log)
-- ============================================================

CREATE TABLE notifications (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  template_id       UUID REFERENCES notification_templates(id),
  channel           notification_channel NOT NULL,
  recipient_id      UUID REFERENCES profiles(id),
  recipient_email   TEXT,
  recipient_phone   TEXT,
  subject           TEXT,
  body              TEXT NOT NULL,
  trigger_event     TEXT,
  related_entity    TEXT,
  related_entity_id UUID,
  status            notification_status NOT NULL DEFAULT 'pending',
  sent_at           TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  failure_reason    TEXT,
  retry_count       INTEGER NOT NULL DEFAULT 0,
  provider_ref      TEXT,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_tenant_id ON notifications(tenant_id);
CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================================
-- 26. AUDIT LOGS
-- ============================================================

CREATE TABLE audit_logs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID REFERENCES tenants(id),
  agency_id         UUID REFERENCES agencies(id),
  actor_id          UUID REFERENCES profiles(id),
  actor_email       TEXT,
  actor_role        user_role,
  action            TEXT NOT NULL,
  entity            TEXT NOT NULL,
  entity_id         UUID,
  old_values        JSONB,
  new_values        JSONB,
  description       TEXT,
  ip_address        INET,
  user_agent        TEXT,
  session_id        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity, entity_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================================
-- 27. STATUS HISTORY (universal status audit trail)
-- ============================================================

CREATE TABLE status_history (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  entity            TEXT NOT NULL,
  entity_id         UUID NOT NULL,
  from_status       TEXT,
  to_status         TEXT NOT NULL,
  reason            TEXT,
  transitioned_by   UUID REFERENCES profiles(id),
  transitioned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_status_history_entity ON status_history(entity, entity_id);
CREATE INDEX idx_status_history_tenant_id ON status_history(tenant_id);
CREATE INDEX idx_status_history_transitioned_at ON status_history(transitioned_at DESC);

-- ============================================================
-- 28. EXCEPTIONS
-- ============================================================

CREATE TABLE exceptions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  severity          exception_severity NOT NULL DEFAULT 'medium',
  status            exception_status NOT NULL DEFAULT 'open',
  category          TEXT NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  related_entity    TEXT,
  related_entity_id UUID,
  assigned_to       UUID REFERENCES profiles(id),
  resolution        TEXT,
  resolved_by       UUID REFERENCES profiles(id),
  resolved_at       TIMESTAMPTZ,
  auto_generated    BOOLEAN NOT NULL DEFAULT FALSE,
  metadata          JSONB DEFAULT '{}',
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exceptions_tenant_id ON exceptions(tenant_id);
CREATE INDEX idx_exceptions_status ON exceptions(status);
CREATE INDEX idx_exceptions_severity ON exceptions(severity);
CREATE INDEX idx_exceptions_created_at ON exceptions(created_at DESC);

-- ============================================================
-- 29. SYSTEM SETTINGS
-- ============================================================

CREATE TABLE system_settings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID REFERENCES tenants(id),
  key               TEXT NOT NULL,
  value             JSONB NOT NULL,
  description       TEXT,
  is_public         BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, key)
);

CREATE INDEX idx_system_settings_tenant_id ON system_settings(tenant_id);
CREATE INDEX idx_system_settings_key ON system_settings(key);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'agencies','tenants','profiles','programmes',
    'participants','participant_addresses','orders',
    'payments','suppliers','animals','animal_allocations',
    'animal_inspections','qurban_executions','distributions',
    'deliveries','media_assets','certificates',
    'notification_templates','notifications','exceptions',
    'system_settings'
  ]
  LOOP
    EXECUTE format('
      CREATE TRIGGER trg_%I_updated_at
      BEFORE UPDATE ON %I
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    ', t, t);
  END LOOP;
END $$;

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'participant')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- Generate order reference function
CREATE OR REPLACE FUNCTION generate_order_ref(tenant_slug TEXT, year INTEGER)
RETURNS TEXT AS $$
DECLARE
  next_seq INTEGER;
  new_ref TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_ref FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_seq
  FROM orders o
  JOIN tenants t ON t.id = o.tenant_id
  WHERE t.slug = tenant_slug
    AND EXTRACT(YEAR FROM o.created_at) = year;

  new_ref := UPPER(tenant_slug) || '-' || year::TEXT || '-' || LPAD(next_seq::TEXT, 6, '0');
  RETURN new_ref;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE agencies               ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants                ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE programmes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants           ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_addresses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_proofs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE animals                ENABLE ROW LEVEL SECURITY;
ALTER TABLE animal_allocations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE animal_updates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE animal_weights         ENABLE ROW LEVEL SECURITY;
ALTER TABLE animal_health_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE animal_inspections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE qurban_executions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries             ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_history         ENABLE ROW LEVEL SECURITY;
ALTER TABLE exceptions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings        ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's profile
CREATE OR REPLACE FUNCTION auth_profile()
RETURNS profiles AS $$
  SELECT * FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION auth_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: get current user's tenant_id
CREATE OR REPLACE FUNCTION auth_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: check if current user is staff (non-participant)
CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN AS $$
  SELECT role IN ('super_admin','operations_admin','supplier_manager','field_team','driver','d3_technical_admin')
  FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: check if super admin or d3
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT role IN ('super_admin') FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── PROFILES ─────────────────────────────────────────────────
-- Users can read their own profile
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (id = auth.uid());

-- Staff can read profiles in same tenant
CREATE POLICY "profiles_select_tenant_staff" ON profiles
  FOR SELECT USING (
    is_staff() AND tenant_id = auth_tenant_id()
  );

-- Super admin can read all
CREATE POLICY "profiles_select_super_admin" ON profiles
  FOR SELECT USING (is_super_admin());

-- Users can update their own profile (limited fields via app logic)
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Super admin can update any
CREATE POLICY "profiles_update_super_admin" ON profiles
  FOR UPDATE USING (is_super_admin());

-- ── TENANTS ───────────────────────────────────────────────────
CREATE POLICY "tenants_select_own" ON tenants
  FOR SELECT USING (
    id = auth_tenant_id() OR is_super_admin()
  );

-- ── PROGRAMMES ────────────────────────────────────────────────
CREATE POLICY "programmes_select" ON programmes
  FOR SELECT USING (
    tenant_id = auth_tenant_id() OR is_super_admin()
  );
CREATE POLICY "programmes_insert" ON programmes
  FOR INSERT WITH CHECK (
    tenant_id = auth_tenant_id() AND is_staff()
  );
CREATE POLICY "programmes_update" ON programmes
  FOR UPDATE USING (
    tenant_id = auth_tenant_id() AND
    auth_role() IN ('super_admin','operations_admin')
  );

-- ── PARTICIPANTS ───────────────────────────────────────────────
-- Participants can view their own record
CREATE POLICY "participants_select_own" ON participants
  FOR SELECT USING (
    profile_id = auth.uid()
  );
-- Staff can view their tenant's participants
CREATE POLICY "participants_select_staff" ON participants
  FOR SELECT USING (
    tenant_id = auth_tenant_id() AND is_staff()
  );
-- Staff can insert
CREATE POLICY "participants_insert_staff" ON participants
  FOR INSERT WITH CHECK (
    tenant_id = auth_tenant_id() AND is_staff()
  );
-- Participant can insert self (during registration)
CREATE POLICY "participants_insert_self" ON participants
  FOR INSERT WITH CHECK (
    profile_id = auth.uid()
  );
-- Staff can update
CREATE POLICY "participants_update_staff" ON participants
  FOR UPDATE USING (
    tenant_id = auth_tenant_id() AND is_staff()
  );
-- Participant can update own
CREATE POLICY "participants_update_own" ON participants
  FOR UPDATE USING (profile_id = auth.uid());

-- ── ORDERS ────────────────────────────────────────────────────
CREATE POLICY "orders_select_participant" ON orders
  FOR SELECT USING (
    participant_id IN (SELECT id FROM participants WHERE profile_id = auth.uid())
  );
CREATE POLICY "orders_select_staff" ON orders
  FOR SELECT USING (
    tenant_id = auth_tenant_id() AND is_staff()
  );
CREATE POLICY "orders_insert_participant" ON orders
  FOR INSERT WITH CHECK (
    tenant_id = auth_tenant_id() AND
    participant_id IN (SELECT id FROM participants WHERE profile_id = auth.uid())
  );
CREATE POLICY "orders_insert_staff" ON orders
  FOR INSERT WITH CHECK (
    tenant_id = auth_tenant_id() AND is_staff()
  );
CREATE POLICY "orders_update_staff" ON orders
  FOR UPDATE USING (
    tenant_id = auth_tenant_id() AND is_staff()
  );

-- ── PAYMENTS ──────────────────────────────────────────────────
CREATE POLICY "payments_select_participant" ON payments
  FOR SELECT USING (
    participant_id IN (SELECT id FROM participants WHERE profile_id = auth.uid())
  );
CREATE POLICY "payments_select_staff" ON payments
  FOR SELECT USING (
    tenant_id = auth_tenant_id() AND is_staff()
  );
CREATE POLICY "payments_insert_participant" ON payments
  FOR INSERT WITH CHECK (
    tenant_id = auth_tenant_id() AND
    participant_id IN (SELECT id FROM participants WHERE profile_id = auth.uid())
  );
CREATE POLICY "payments_insert_staff" ON payments
  FOR INSERT WITH CHECK (
    tenant_id = auth_tenant_id() AND is_staff()
  );
CREATE POLICY "payments_update_staff" ON payments
  FOR UPDATE USING (
    tenant_id = auth_tenant_id() AND
    auth_role() IN ('super_admin','operations_admin')
  );

-- ── ANIMALS ───────────────────────────────────────────────────
CREATE POLICY "animals_select_staff" ON animals
  FOR SELECT USING (
    tenant_id = auth_tenant_id() AND is_staff()
  );
CREATE POLICY "animals_select_allocated_participant" ON animals
  FOR SELECT USING (
    id IN (
      SELECT aa.animal_id FROM animal_allocations aa
      JOIN participants p ON p.id = aa.participant_id
      WHERE p.profile_id = auth.uid()
    )
  );
CREATE POLICY "animals_insert_staff" ON animals
  FOR INSERT WITH CHECK (
    tenant_id = auth_tenant_id() AND
    auth_role() IN ('super_admin','operations_admin','supplier_manager','field_team')
  );
CREATE POLICY "animals_update_staff" ON animals
  FOR UPDATE USING (
    tenant_id = auth_tenant_id() AND
    auth_role() IN ('super_admin','operations_admin','supplier_manager','field_team')
  );

-- ── DELIVERIES ────────────────────────────────────────────────
CREATE POLICY "deliveries_select_participant" ON deliveries
  FOR SELECT USING (
    participant_id IN (SELECT id FROM participants WHERE profile_id = auth.uid())
  );
CREATE POLICY "deliveries_select_staff" ON deliveries
  FOR SELECT USING (
    tenant_id = auth_tenant_id() AND is_staff()
  );
CREATE POLICY "deliveries_select_driver" ON deliveries
  FOR SELECT USING (
    driver_id = auth.uid()
  );
CREATE POLICY "deliveries_update_driver" ON deliveries
  FOR UPDATE USING (
    driver_id = auth.uid() AND auth_role() = 'driver'
  );
CREATE POLICY "deliveries_update_staff" ON deliveries
  FOR UPDATE USING (
    tenant_id = auth_tenant_id() AND is_staff()
  );

-- ── CERTIFICATES ──────────────────────────────────────────────
CREATE POLICY "certificates_select_participant" ON certificates
  FOR SELECT USING (
    participant_id IN (SELECT id FROM participants WHERE profile_id = auth.uid())
  );
CREATE POLICY "certificates_select_staff" ON certificates
  FOR SELECT USING (
    tenant_id = auth_tenant_id() AND is_staff()
  );

-- ── MEDIA ASSETS ──────────────────────────────────────────────
CREATE POLICY "media_select_public" ON media_assets
  FOR SELECT USING (is_public = TRUE);
CREATE POLICY "media_select_staff" ON media_assets
  FOR SELECT USING (
    tenant_id = auth_tenant_id() AND is_staff()
  );
CREATE POLICY "media_select_owner" ON media_assets
  FOR SELECT USING (uploaded_by = auth.uid());
CREATE POLICY "media_insert_staff" ON media_assets
  FOR INSERT WITH CHECK (
    tenant_id = auth_tenant_id() AND is_staff()
  );

-- ── AUDIT LOGS ────────────────────────────────────────────────
-- Staff can insert audit logs
CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT WITH CHECK (actor_id = auth.uid());
-- Only super admins can read all audit logs
CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT USING (
    (tenant_id = auth_tenant_id() AND auth_role() IN ('super_admin','operations_admin')) OR
    is_super_admin()
  );

-- ── NOTIFICATIONS ─────────────────────────────────────────────
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (recipient_id = auth.uid());
CREATE POLICY "notifications_select_staff" ON notifications
  FOR SELECT USING (
    tenant_id = auth_tenant_id() AND is_staff()
  );

-- ── EXCEPTIONS ────────────────────────────────────────────────
CREATE POLICY "exceptions_select_staff" ON exceptions
  FOR SELECT USING (
    tenant_id = auth_tenant_id() AND is_staff()
  );
CREATE POLICY "exceptions_update_staff" ON exceptions
  FOR UPDATE USING (
    tenant_id = auth_tenant_id() AND is_staff()
  );

-- ── STATUS HISTORY ────────────────────────────────────────────
CREATE POLICY "status_history_select_participant" ON status_history
  FOR SELECT USING (
    entity = 'order' AND entity_id IN (
      SELECT o.id FROM orders o
      JOIN participants p ON p.id = o.participant_id
      WHERE p.profile_id = auth.uid()
    )
  );
CREATE POLICY "status_history_select_staff" ON status_history
  FOR SELECT USING (
    tenant_id = auth_tenant_id() AND is_staff()
  );

-- ── SYSTEM SETTINGS ───────────────────────────────────────────
CREATE POLICY "system_settings_select_public" ON system_settings
  FOR SELECT USING (is_public = TRUE AND tenant_id = auth_tenant_id());
CREATE POLICY "system_settings_select_staff" ON system_settings
  FOR SELECT USING (
    tenant_id = auth_tenant_id() AND is_staff()
  );
CREATE POLICY "system_settings_update_admin" ON system_settings
  FOR UPDATE USING (is_super_admin());
CREATE POLICY "system_settings_insert_admin" ON system_settings
  FOR INSERT WITH CHECK (is_super_admin());
