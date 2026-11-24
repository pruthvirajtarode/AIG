-- ============================================================
-- 011_anon_read_write_notifications.sql
-- Allow anon client & edge functions to read/insert aigms_notifications
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'aigms_notifications' AND policyname = 'anon_all_aigms_notifications'
  ) THEN
    EXECUTE 'CREATE POLICY "anon_all_aigms_notifications" ON aigms_notifications FOR ALL TO anon USING (true) WITH CHECK (true)';
  END IF;
END $$;
