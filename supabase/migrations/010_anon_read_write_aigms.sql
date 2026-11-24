-- ============================================================
-- 010_anon_read_write_aigms.sql
-- Enable seamless cloud synchronization across all client devices
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'aigms_programmes',
      'aigms_participants',
      'aigms_suppliers',
      'aigms_orders',
      'aigms_animals',
      'aigms_payments',
      'aigms_deliveries',
      'aigms_certificates',
      'aigms_exceptions',
      'aigms_audit_logs'
    ])
  LOOP
    BEGIN
      EXECUTE format(
        'CREATE POLICY "anon_all_%s" ON %I FOR ALL TO anon USING (true) WITH CHECK (true)',
        tbl, tbl
      );
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;
