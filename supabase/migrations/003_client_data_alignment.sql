-- ============================================================
-- AIGMS — Al Ihsan Group Qurban Management System
-- Migration: 003_client_data_alignment.sql
-- Created by: Daredevil Digital (D3)
-- Description: Aligns the schema with the client's 2025 order sheet
--              ("Qurban, Aqiqah, Nazar form"). Closes the gaps found
--              in the gap analysis:
--                * PayNow payment method + payee name
--                * Lamb as a distinct animal choice
--                * Payer (account holder) vs. Qurban participant name
--                * Doorstep delivery portions (1/3, 2/3, Full) - Australia
--                * Service type (Qurban / Aqiqah / Nazar)
--                * Hijri year + certificate serial number
--                * Legacy order reference, supplier, survey answers
-- Safe to re-run: all statements are idempotent.
-- ============================================================

-- ============================================================
-- 1. ENUM CHANGES
-- ============================================================
-- NOTE: new enum values cannot be referenced inside the same transaction
-- that creates them, so nothing below defaults to / updates with them.

ALTER TYPE animal_type    ADD VALUE IF NOT EXISTS 'lamb';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'paynow';

DO $$ BEGIN
  CREATE TYPE service_type AS ENUM ('qurban', 'aqiqah', 'nazar');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  -- Share of the animal delivered to the participant's doorstep (Australia).
  CREATE TYPE delivery_portion AS ENUM ('one_third', 'two_thirds', 'full');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. PROGRAMMES — which service a programme offers
-- ============================================================

ALTER TABLE programmes
  ADD COLUMN IF NOT EXISTS service_type      service_type NOT NULL DEFAULT 'qurban',
  ADD COLUMN IF NOT EXISTS supports_portions BOOLEAN      NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN programmes.supports_portions IS
  'TRUE when participants can choose a doorstep delivery portion (1/3, 2/3, Full), e.g. Australia.';

-- Australia delivery programmes support portion selection.
UPDATE programmes
   SET supports_portions = TRUE
 WHERE country = 'Australia' AND delivery_required = TRUE;

-- ============================================================
-- 3. ORDERS — client form fields
-- ============================================================
-- participants  = the PAYER / account holder (form: Name, Contact No, email)
-- orders.qurban_* = the person the Qurban is performed for and whose name
--                   appears on the certificate (form: Name of Participant,
--                   Mobile Number, Email2). Defaults to the payer when empty.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS service_type       service_type     NOT NULL DEFAULT 'qurban',
  ADD COLUMN IF NOT EXISTS qurban_name        TEXT,
  ADD COLUMN IF NOT EXISTS qurban_phone       TEXT,
  ADD COLUMN IF NOT EXISTS qurban_email       TEXT,
  ADD COLUMN IF NOT EXISTS preferred_animal   animal_type,
  ADD COLUMN IF NOT EXISTS delivery_portion   delivery_portion,
  ADD COLUMN IF NOT EXISTS hijri_year         INTEGER CHECK (hijri_year BETWEEN 1400 AND 1600),
  ADD COLUMN IF NOT EXISTS supplier_id        UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS legacy_ref         TEXT,
  ADD COLUMN IF NOT EXISTS is_returning_customer BOOLEAN,
  ADD COLUMN IF NOT EXISTS would_recommend    TEXT
      CHECK (would_recommend IS NULL OR would_recommend IN ('definitely','probably','not_sure','no')),
  ADD COLUMN IF NOT EXISTS feedback           TEXT;

COMMENT ON COLUMN orders.qurban_name IS
  'Name the Qurban is performed for (printed on certificate). Falls back to the payer name.';
COMMENT ON COLUMN orders.delivery_portion IS
  'Doorstep delivery portion for Australia Qurban: one_third, two_thirds or full.';
COMMENT ON COLUMN orders.legacy_ref IS
  'Order / serial reference from the client''s previous spreadsheet (e.g. AIG-IDSXL-0002, 20012). Used by the Excel import.';

-- A doorstep portion only makes sense for Qurban orders that ship to an address.
DO $$ BEGIN
  ALTER TABLE orders
    ADD CONSTRAINT orders_portion_requires_qurban
    CHECK (delivery_portion IS NULL OR service_type = 'qurban');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_service_type ON orders(service_type);
CREATE INDEX IF NOT EXISTS idx_orders_supplier_id  ON orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_orders_hijri_year   ON orders(hijri_year);
-- Prevents the Excel import from creating duplicates when re-run.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_legacy_ref
  ON orders(tenant_id, legacy_ref) WHERE legacy_ref IS NOT NULL;

-- ============================================================
-- 4. PAYMENTS — PayNow payee name
-- ============================================================
-- PayNow transfers are often made by someone other than the account holder
-- (form: "Payee's Name"). Admins need it to match the bank statement.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payee_name TEXT;

COMMENT ON COLUMN payments.payee_name IS
  'Name shown on the PayNow / bank transfer; may differ from the participant or Qurban name.';

CREATE INDEX IF NOT EXISTS idx_payments_payee_name ON payments(lower(payee_name));

-- ============================================================
-- 5. CERTIFICATES — location, year, serial
-- ============================================================
-- Client certificate design shows: name, location, livestock, year, serial.

ALTER TABLE certificates
  ADD COLUMN IF NOT EXISTS service_type    service_type NOT NULL DEFAULT 'qurban',
  ADD COLUMN IF NOT EXISTS country         TEXT,
  ADD COLUMN IF NOT EXISTS hijri_year      INTEGER CHECK (hijri_year BETWEEN 1400 AND 1600),
  ADD COLUMN IF NOT EXISTS gregorian_year  INTEGER,
  ADD COLUMN IF NOT EXISTS serial_number   TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_serial
  ON certificates(tenant_id, serial_number) WHERE serial_number IS NOT NULL;

-- ============================================================
-- 6. PROGRAMMES — Qurban Hijri year context
-- ============================================================

ALTER TABLE programmes
  ADD COLUMN IF NOT EXISTS hijri_year INTEGER CHECK (hijri_year BETWEEN 1400 AND 1600);
