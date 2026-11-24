-- ============================================================
-- 009_installments_and_portions.sql
-- Add installment tracking and portion columns to flat tables
-- ============================================================

ALTER TABLE IF EXISTS aigms_orders
  ADD COLUMN IF NOT EXISTS installment_count INTEGER,
  ADD COLUMN IF NOT EXISTS installments_paid INTEGER,
  ADD COLUMN IF NOT EXISTS installment_schedule JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS number_of_qurbans INTEGER DEFAULT 1;

ALTER TABLE IF EXISTS aigms_payments
  ADD COLUMN IF NOT EXISTS installment_count INTEGER,
  ADD COLUMN IF NOT EXISTS installments_paid INTEGER,
  ADD COLUMN IF NOT EXISTS installment_schedule JSONB DEFAULT '[]'::jsonb;
