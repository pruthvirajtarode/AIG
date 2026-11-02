-- ============================================================
-- AIGMS — Al Ihsan Group Qurban Management System
-- Migration: 004_order_ref_and_qurban_name_holder.sql
-- Created by: Daredevil Digital (D3)
-- Description:
--   • Adds order_ref (ORD-NNNNN format) as a unique, human-readable
--     identifier column on the orders table (in addition to the UUID pk).
--   • Adds qurban_name_holder, order_ref link, programme and service_type
--     on the animals table so each animal record is fully linked to its
--     order and the person the Qurban is performed for.
--   • Adds contact_number and email directly on orders (so the API can
--     return them without a join to participants).
--   • Creates indices for fast lookup by order_ref.
-- Safe to re-run: all statements are idempotent.
-- ============================================================

-- ============================================================
-- 1. ORDERS — human-readable unique reference
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_ref       TEXT,
  ADD COLUMN IF NOT EXISTS contact_number  TEXT,
  ADD COLUMN IF NOT EXISTS email           TEXT;

COMMENT ON COLUMN orders.order_ref IS
  'Human-readable unique order reference, e.g. ORD-10001. '
  'Generated on insert. Printed on invoices, certificates and delivery notes.';

COMMENT ON COLUMN orders.contact_number IS
  'Copy of the participant contact number, denormalised for fast display '
  'without a join.';

COMMENT ON COLUMN orders.email IS
  'Copy of the participant e-mail, denormalised for fast display '
  'without a join.';

-- Back-fill: generate ORD-NNNNN for any existing rows that have none.
-- We use the row number ordered by created_at so old orders keep a
-- consistent, monotonically-increasing reference.
WITH numbered AS (
  SELECT id,
         'ORD-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 5, '0') AS ref
  FROM   orders
  WHERE  order_ref IS NULL
)
UPDATE orders
   SET order_ref = numbered.ref
  FROM numbered
 WHERE orders.id = numbered.id;

-- Make it mandatory and unique going forward.
ALTER TABLE orders
  ALTER COLUMN order_ref SET NOT NULL;

-- The uniqueness index must be per-tenant in a multi-tenant system.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_ref
  ON orders(tenant_id, order_ref);

-- Fast search/lookup by order_ref without tenant filter.
CREATE INDEX IF NOT EXISTS idx_orders_order_ref_global
  ON orders(order_ref);

-- ============================================================
-- 2. ANIMALS — qurban linkage
-- ============================================================

ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS order_ref           TEXT,
  ADD COLUMN IF NOT EXISTS qurban_name_holder  TEXT,
  ADD COLUMN IF NOT EXISTS programme           TEXT,
  ADD COLUMN IF NOT EXISTS service_type        service_type;

COMMENT ON COLUMN animals.order_ref IS
  'The order_ref of the order this animal was reserved/allocated for. '
  'NULL when the animal is in the available pool.';

COMMENT ON COLUMN animals.qurban_name_holder IS
  'The name the Qurban is performed for — appears on the certificate. '
  'Defaults to the participant (payer) name when the form field is left blank.';

COMMENT ON COLUMN animals.programme IS
  'Denormalised programme name for display without a join.';

COMMENT ON COLUMN animals.service_type IS
  'Denormalised service type (qurban / aqiqah / nazar) from the linked order.';

-- Foreign-key relationship: animals.order_ref → orders.order_ref
-- (optional: use a soft FK via index rather than a hard constraint so that
--  the column can survive order archival/deletion gracefully.)
CREATE INDEX IF NOT EXISTS idx_animals_order_ref
  ON animals(order_ref) WHERE order_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_animals_qurban_name_holder
  ON animals(lower(qurban_name_holder)) WHERE qurban_name_holder IS NOT NULL;

-- ============================================================
-- 3. PAYMENTS — order_ref denorm (avoids join for list views)
-- ============================================================

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS order_ref TEXT;

COMMENT ON COLUMN payments.order_ref IS
  'Denormalised human-readable order reference (mirrors orders.order_ref).';

-- Back-fill from the orders table if a FK exists.
UPDATE payments p
   SET order_ref = o.order_ref
  FROM orders o
 WHERE p.order_id = o.id
   AND p.order_ref IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_order_ref
  ON payments(order_ref) WHERE order_ref IS NOT NULL;

-- ============================================================
-- 4. DELIVERIES — order_ref denorm
-- ============================================================

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS order_ref TEXT;

COMMENT ON COLUMN deliveries.order_ref IS
  'Denormalised human-readable order reference (mirrors orders.order_ref).';

UPDATE deliveries d
   SET order_ref = o.order_ref
  FROM orders o
 WHERE d.order_id = o.id
   AND d.order_ref IS NULL;

CREATE INDEX IF NOT EXISTS idx_deliveries_order_ref
  ON deliveries(order_ref) WHERE order_ref IS NOT NULL;

-- ============================================================
-- 5. CERTIFICATES — order_ref denorm (already has order_id)
-- ============================================================

ALTER TABLE certificates
  ADD COLUMN IF NOT EXISTS order_ref TEXT;

COMMENT ON COLUMN certificates.order_ref IS
  'Denormalised human-readable order reference for display on certificates.';

UPDATE certificates c
   SET order_ref = o.order_ref
  FROM orders o
 WHERE c.order_id = o.id
   AND c.order_ref IS NULL;

CREATE INDEX IF NOT EXISTS idx_certificates_order_ref
  ON certificates(order_ref) WHERE order_ref IS NOT NULL;
