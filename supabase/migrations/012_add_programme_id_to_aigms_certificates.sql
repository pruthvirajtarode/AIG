-- ============================================================
-- AIGMS — Migration 011: Add programme_id to aigms_certificates
-- Ensures schema compatibility with app-level certificate metadata
-- ============================================================

ALTER TABLE IF EXISTS aigms_certificates
  ADD COLUMN IF NOT EXISTS programme_id TEXT;
