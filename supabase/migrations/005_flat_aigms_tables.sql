-- ============================================================
-- AIGMS — Migration 005: Flat aigms_* tables for the admin UI
-- These are simple flat tables that mirror the AppData types
-- used in AppDataContext. RLS is permissive for authenticated users.
-- ============================================================

-- Enable UUID extension (may already exist)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Programmes ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aigms_programmes (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL,
  country           TEXT NOT NULL DEFAULT '',
  animal_type       TEXT NOT NULL DEFAULT 'goat',
  animals_per_share INTEGER NOT NULL DEFAULT 1,
  price_per_share   NUMERIC NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'SGD',
  shares_available  INTEGER NOT NULL DEFAULT 0,
  min_quantity      INTEGER NOT NULL DEFAULT 1,
  distribution_method TEXT NOT NULL DEFAULT 'local',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  qurban_date       DATE,
  orders_count      INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Participants ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aigms_participants (
  id               TEXT PRIMARY KEY,
  participant_ref  TEXT NOT NULL,
  first_name       TEXT NOT NULL DEFAULT '',
  last_name        TEXT NOT NULL DEFAULT '',
  email            TEXT NOT NULL DEFAULT '',
  phone            TEXT NOT NULL DEFAULT '',
  country          TEXT NOT NULL DEFAULT 'Singapore',
  ic_number        TEXT NOT NULL DEFAULT '',
  orders_count     INTEGER NOT NULL DEFAULT 0,
  total_spent      NUMERIC NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  portal_access    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Suppliers ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aigms_suppliers (
  id            TEXT PRIMARY KEY,
  supplier_ref  TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  contact_name  TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL DEFAULT '',
  phone         TEXT NOT NULL DEFAULT '',
  country       TEXT NOT NULL DEFAULT '',
  region        TEXT,
  animal_types  TEXT[] NOT NULL DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  animals_count INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Orders ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aigms_orders (
  id                  TEXT PRIMARY KEY,
  order_ref           TEXT NOT NULL UNIQUE,
  participant         TEXT NOT NULL DEFAULT '',
  participant_id      TEXT,
  contact_number      TEXT,
  email               TEXT,
  programme           TEXT NOT NULL DEFAULT '',
  programme_id        TEXT,
  programme_country   TEXT,
  service_type        TEXT,
  payment_method      TEXT,
  delivery_portion    TEXT,
  quantity            INTEGER NOT NULL DEFAULT 1,
  total_amount        NUMERIC NOT NULL DEFAULT 0,
  currency            TEXT NOT NULL DEFAULT 'SGD',
  status              TEXT NOT NULL DEFAULT 'draft',
  recipient           TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Animals ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aigms_animals (
  id                   TEXT PRIMARY KEY,
  animal_ref           TEXT NOT NULL,
  animal_code          TEXT,
  animal_type          TEXT NOT NULL DEFAULT 'goat',
  breed                TEXT NOT NULL DEFAULT '',
  gender               TEXT NOT NULL DEFAULT 'male',
  status               TEXT NOT NULL DEFAULT 'available',
  current_weight_kg    NUMERIC NOT NULL DEFAULT 0,
  min_weight_kg        NUMERIC NOT NULL DEFAULT 0,
  location             TEXT NOT NULL DEFAULT '',
  supplier             TEXT NOT NULL DEFAULT '',
  tag_number           TEXT NOT NULL DEFAULT '',
  last_inspection      TEXT,
  order_ref            TEXT,
  qurban_name_holder   TEXT,
  programme            TEXT,
  service_type         TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Payments ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aigms_payments (
  id                TEXT PRIMARY KEY,
  payment_ref       TEXT NOT NULL,
  order_ref         TEXT NOT NULL,
  participant       TEXT NOT NULL DEFAULT '',
  amount            NUMERIC NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'SGD',
  method            TEXT NOT NULL DEFAULT 'bank_transfer',
  status            TEXT NOT NULL DEFAULT 'pending',
  submitted_at      TIMESTAMPTZ,
  verified_at       TIMESTAMPTZ,
  bank              TEXT,
  notes             TEXT,
  proof_url         TEXT,
  rejection_reason  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Deliveries ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aigms_deliveries (
  id              TEXT PRIMARY KEY,
  delivery_ref    TEXT NOT NULL,
  order_ref       TEXT NOT NULL,
  participant     TEXT NOT NULL DEFAULT '',
  contact_phone   TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'pending',
  scheduled_date  DATE,
  delivered_at    TIMESTAMPTZ,
  address         TEXT NOT NULL DEFAULT '',
  driver          TEXT,
  delivery_slot   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Certificates ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aigms_certificates (
  id                TEXT PRIMARY KEY,
  certificate_ref   TEXT NOT NULL,
  order_ref         TEXT NOT NULL,
  participant_name  TEXT NOT NULL DEFAULT '',
  programme_name    TEXT NOT NULL DEFAULT '',
  country           TEXT NOT NULL DEFAULT '',
  animal_ref        TEXT NOT NULL DEFAULT '',
  animal_type       TEXT NOT NULL DEFAULT 'goat',
  animal_label      TEXT NOT NULL DEFAULT '',
  qurban_date       DATE,
  status            TEXT NOT NULL DEFAULT 'not_generated',
  generated_at      TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ,
  verification_code TEXT NOT NULL DEFAULT '',
  year              TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Exceptions ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aigms_exceptions (
  id                  TEXT PRIMARY KEY,
  severity            TEXT NOT NULL DEFAULT 'low',
  status              TEXT NOT NULL DEFAULT 'open',
  category            TEXT NOT NULL DEFAULT '',
  title               TEXT NOT NULL DEFAULT '',
  description         TEXT NOT NULL DEFAULT '',
  related_entity      TEXT NOT NULL DEFAULT '',
  related_entity_id   TEXT NOT NULL DEFAULT '',
  assigned_to         TEXT,
  resolution          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Audit Logs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aigms_audit_logs (
  id            TEXT PRIMARY KEY,
  actor_email   TEXT NOT NULL DEFAULT '',
  actor_role    TEXT NOT NULL DEFAULT 'super_admin',
  action        TEXT NOT NULL DEFAULT '',
  entity        TEXT NOT NULL DEFAULT '',
  entity_id     TEXT,
  description   TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Row Level Security ────────────────────────────────────────
-- Allow all authenticated users to read and write (admin app).
-- Adjust per-role if needed later.

ALTER TABLE aigms_programmes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE aigms_participants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE aigms_suppliers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE aigms_orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE aigms_animals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE aigms_payments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE aigms_deliveries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE aigms_certificates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE aigms_exceptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE aigms_audit_logs    ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'aigms_programmes','aigms_participants','aigms_suppliers','aigms_orders',
    'aigms_animals','aigms_payments','aigms_deliveries','aigms_certificates',
    'aigms_exceptions','aigms_audit_logs'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY IF NOT EXISTS "authenticated_all_%s" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      tbl, tbl
    );
  END LOOP;
END $$;
