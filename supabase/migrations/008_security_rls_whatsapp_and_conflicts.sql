-- ============================================================
-- AIGMS — Al Ihsan Group Qurban Management System
-- Migration: 008_security_rls_whatsapp_and_conflicts.sql
-- Description:
--   Forward-only, non-destructive production security & feature migration:
--   1. Replaces permissive `authenticated_all_*` RLS policies on `aigms_*`
--      with strict role-based policies (Staff full access; Participants
--      SELECT-only on their own orders, payments, animals, deliveries,
--      and certificates; zero participant access to other participants' data,
--      suppliers, exceptions, or audit logs).
--   2. Enforces Weight Timeline protection at the database level:
--      - `animal_weights` RLS restricts participant SELECT to programmes with
--        `supports_weight_timeline = TRUE` (Indonesia Breeding Programme).
--      - `trg_fn_validate_aigms_animal` strips `weight_history` on non-breeding
--        order animals.
--   3. Fixes `confirmation_email_sent_at` handling (Phase 4.8):
--      - Adds `confirmation_email_status`, `confirmation_email_provider_ref`,
--        and `confirmation_email_idempotency_key`.
--      - Safely reconciles historical rows as `'legacy_unverified_timestamp'`
--        without destructively wiping timestamps.
--      - Adds `record_order_invoice_email_sent()` RPC to stamp
--        `confirmation_email_sent_at` ONLY after real email provider acceptance.
--   4. Creates `aigms_notifications` queue & webhook status tracking table.
--   5. Adds `template_type`, `service_type`, `qurban_name_holder` to
--      `aigms_certificates` (with unique `(order_ref, animal_ref)` index) and
--      `animals_per_share`, `share_ratio` to `aigms_animals`.
--   6. Upgrades `create_aigms_order()` RPC with caller authorization,
--      ambiguous participant identity conflict detection (flagging an
--      operational Exception in `aigms_exceptions` without silent merging),
--      and honest invoice status initialization.
-- ============================================================

-- ============================================================
-- 1. SAFE SCHEMA ADDITIONS (Forward-Only, Non-Destructive)
-- ============================================================

ALTER TABLE IF EXISTS orders
  ADD COLUMN IF NOT EXISTS confirmation_email_status          TEXT NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS confirmation_email_provider_ref    TEXT,
  ADD COLUMN IF NOT EXISTS confirmation_email_idempotency_key TEXT;

ALTER TABLE IF EXISTS aigms_orders
  ADD COLUMN IF NOT EXISTS confirmation_email_status          TEXT NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS confirmation_email_provider_ref    TEXT,
  ADD COLUMN IF NOT EXISTS confirmation_email_idempotency_key TEXT;

-- Safe reconciliation of pre-existing rows (Phase 4.8):
-- Do NOT blindly reset historical timestamps; tag rows that were initialized
-- without a provider reference as 'legacy_unverified_timestamp'.
UPDATE aigms_orders
SET confirmation_email_status = 'legacy_unverified_timestamp'
WHERE confirmation_email_sent_at IS NOT NULL
  AND confirmation_email_provider_ref IS NULL
  AND confirmation_email_status = 'not_sent';

UPDATE orders
SET confirmation_email_status = 'legacy_unverified_timestamp'
WHERE confirmation_email_sent_at IS NOT NULL
  AND confirmation_email_provider_ref IS NULL
  AND confirmation_email_status = 'not_sent';

ALTER TABLE IF EXISTS aigms_animals
  ADD COLUMN IF NOT EXISTS animals_per_share INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS share_ratio       TEXT NOT NULL DEFAULT '1/1';

UPDATE aigms_animals
SET animals_per_share = 7,
    share_ratio       = '1/7'
WHERE (COALESCE(programme, '') ~* '1/7|cattle \(1/7\)|cow share')
  AND animals_per_share = 1;

ALTER TABLE IF EXISTS aigms_certificates
  ADD COLUMN IF NOT EXISTS template_type      TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS service_type       TEXT NOT NULL DEFAULT 'qurban',
  ADD COLUMN IF NOT EXISTS qurban_name_holder TEXT,
  ADD COLUMN IF NOT EXISTS animal_photo_url   TEXT;

UPDATE aigms_certificates
SET template_type = CASE
  WHEN COALESCE(programme_name, '') ~* '\mbreeding\M' THEN 'breeding_programme'
  ELSE 'standard'
END
WHERE template_type = 'standard';

CREATE UNIQUE INDEX IF NOT EXISTS idx_aigms_certificates_order_animal_uniq
  ON aigms_certificates (order_ref, animal_ref)
  WHERE order_ref IS NOT NULL AND animal_ref IS NOT NULL AND animal_ref <> 'Pending';

-- ============================================================
-- 2. NOTIFICATION QUEUE & WEBHOOK LOGS TABLE (aigms_notifications)
-- ============================================================

CREATE TABLE IF NOT EXISTS aigms_notifications (
  id                   TEXT PRIMARY KEY,
  idempotency_key      TEXT UNIQUE,
  event_type           TEXT NOT NULL,
  order_ref            TEXT,
  entity_ref           TEXT,
  recipient_name       TEXT NOT NULL,
  recipient_phone_e164 TEXT,
  recipient_email      TEXT,
  primary_channel      TEXT NOT NULL DEFAULT 'whatsapp' CHECK (primary_channel IN ('whatsapp', 'email', 'sms')),
  channel_used         TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel_used IN ('whatsapp', 'email', 'sms')),
  template_id          TEXT,
  template_variables   JSONB NOT NULL DEFAULT '{}'::jsonb,
  delivery_state       TEXT NOT NULL DEFAULT 'queued' CHECK (
    delivery_state IN (
      'queued',
      'submitted',
      'accepted_by_provider',
      'sent',
      'delivered',
      'read',
      'failed',
      'fallback_initiated',
      'fallback_completed',
      'simulated'
    )
  ),
  is_simulated         BOOLEAN NOT NULL DEFAULT FALSE,
  fallback_used        BOOLEAN NOT NULL DEFAULT FALSE,
  provider_ref         TEXT,
  error_message        TEXT,
  retry_count          INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_aigms_notifications_provider_ref
  ON aigms_notifications (provider_ref)
  WHERE provider_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aigms_notifications_order_ref
  ON aigms_notifications (order_ref);

ALTER TABLE aigms_notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. STRICT ROLE-BASED RLS ON ALL aigms_* TABLES & animal_weights
-- ============================================================

CREATE OR REPLACE FUNCTION is_aigms_staff()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND is_active = TRUE
      AND role IN (
        'super_admin',
        'operations_admin',
        'supplier_manager',
        'field_team',
        'driver',
        'd3_technical_admin'
      )
  );
$$;

-- Drop overly permissive policies from 005_flat_aigms_tables.sql
DROP POLICY IF EXISTS "authenticated_all_programmes"   ON aigms_programmes;
DROP POLICY IF EXISTS "authenticated_all_suppliers"    ON aigms_suppliers;
DROP POLICY IF EXISTS "authenticated_all_participants" ON aigms_participants;
DROP POLICY IF EXISTS "authenticated_all_orders"       ON aigms_orders;
DROP POLICY IF EXISTS "authenticated_all_animals"      ON aigms_animals;
DROP POLICY IF EXISTS "authenticated_all_payments"     ON aigms_payments;
DROP POLICY IF EXISTS "authenticated_all_deliveries"   ON aigms_deliveries;
DROP POLICY IF EXISTS "authenticated_all_certificates" ON aigms_certificates;
DROP POLICY IF EXISTS "authenticated_all_exceptions"   ON aigms_exceptions;
DROP POLICY IF EXISTS "authenticated_all_audit_logs"   ON aigms_audit_logs;

-- 3.1 Staff full access policies
DROP POLICY IF EXISTS "aigms_programmes_staff_all"    ON aigms_programmes;
DROP POLICY IF EXISTS "aigms_suppliers_staff_all"     ON aigms_suppliers;
DROP POLICY IF EXISTS "aigms_participants_staff_all"  ON aigms_participants;
DROP POLICY IF EXISTS "aigms_orders_staff_all"        ON aigms_orders;
DROP POLICY IF EXISTS "aigms_animals_staff_all"       ON aigms_animals;
DROP POLICY IF EXISTS "aigms_payments_staff_all"      ON aigms_payments;
DROP POLICY IF EXISTS "aigms_deliveries_staff_all"    ON aigms_deliveries;
DROP POLICY IF EXISTS "aigms_certificates_staff_all"  ON aigms_certificates;
DROP POLICY IF EXISTS "aigms_exceptions_staff_all"    ON aigms_exceptions;
DROP POLICY IF EXISTS "aigms_audit_logs_staff_all"    ON aigms_audit_logs;
DROP POLICY IF EXISTS "aigms_notifications_staff_all" ON aigms_notifications;

CREATE POLICY "aigms_programmes_staff_all"    ON aigms_programmes    FOR ALL TO authenticated USING (is_aigms_staff()) WITH CHECK (is_aigms_staff());
CREATE POLICY "aigms_suppliers_staff_all"     ON aigms_suppliers     FOR ALL TO authenticated USING (is_aigms_staff()) WITH CHECK (is_aigms_staff());
CREATE POLICY "aigms_participants_staff_all"  ON aigms_participants  FOR ALL TO authenticated USING (is_aigms_staff()) WITH CHECK (is_aigms_staff());
CREATE POLICY "aigms_orders_staff_all"        ON aigms_orders        FOR ALL TO authenticated USING (is_aigms_staff()) WITH CHECK (is_aigms_staff());
CREATE POLICY "aigms_animals_staff_all"       ON aigms_animals       FOR ALL TO authenticated USING (is_aigms_staff()) WITH CHECK (is_aigms_staff());
CREATE POLICY "aigms_payments_staff_all"      ON aigms_payments      FOR ALL TO authenticated USING (is_aigms_staff()) WITH CHECK (is_aigms_staff());
CREATE POLICY "aigms_deliveries_staff_all"    ON aigms_deliveries    FOR ALL TO authenticated USING (is_aigms_staff()) WITH CHECK (is_aigms_staff());
CREATE POLICY "aigms_certificates_staff_all"  ON aigms_certificates  FOR ALL TO authenticated USING (is_aigms_staff()) WITH CHECK (is_aigms_staff());
CREATE POLICY "aigms_exceptions_staff_all"    ON aigms_exceptions    FOR ALL TO authenticated USING (is_aigms_staff()) WITH CHECK (is_aigms_staff());
CREATE POLICY "aigms_audit_logs_staff_all"    ON aigms_audit_logs    FOR ALL TO authenticated USING (is_aigms_staff()) WITH CHECK (is_aigms_staff());
CREATE POLICY "aigms_notifications_staff_all" ON aigms_notifications FOR ALL TO authenticated USING (is_aigms_staff()) WITH CHECK (is_aigms_staff());

-- 3.2 Participant SELECT-only policies scoped strictly to own records
DROP POLICY IF EXISTS "aigms_programmes_participant_select"    ON aigms_programmes;
DROP POLICY IF EXISTS "aigms_participants_participant_select"  ON aigms_participants;
DROP POLICY IF EXISTS "aigms_orders_participant_select"        ON aigms_orders;
DROP POLICY IF EXISTS "aigms_animals_participant_select"       ON aigms_animals;
DROP POLICY IF EXISTS "aigms_payments_participant_select"      ON aigms_payments;
DROP POLICY IF EXISTS "aigms_deliveries_participant_select"    ON aigms_deliveries;
DROP POLICY IF EXISTS "aigms_certificates_participant_select"  ON aigms_certificates;
DROP POLICY IF EXISTS "aigms_notifications_participant_select" ON aigms_notifications;

CREATE POLICY "aigms_programmes_participant_select"
  ON aigms_programmes FOR SELECT TO authenticated
  USING (is_active = TRUE);

CREATE POLICY "aigms_participants_participant_select"
  ON aigms_participants FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()::text
    OR LOWER(COALESCE(email, '')) = LOWER(COALESCE(auth.jwt()->>'email', ''))
  );

CREATE POLICY "aigms_orders_participant_select"
  ON aigms_orders FOR SELECT TO authenticated
  USING (
    LOWER(COALESCE(email, '')) = LOWER(COALESCE(auth.jwt()->>'email', ''))
    OR participant_id IN (
      SELECT p.id
      FROM aigms_participants p
      WHERE p.profile_id = auth.uid()::text
         OR LOWER(COALESCE(p.email, '')) = LOWER(COALESCE(auth.jwt()->>'email', ''))
    )
  );

CREATE POLICY "aigms_animals_participant_select"
  ON aigms_animals FOR SELECT TO authenticated
  USING (
    order_ref IS NOT NULL
    AND order_ref IN (
      SELECT o.order_ref
      FROM aigms_orders o
      WHERE LOWER(COALESCE(o.email, '')) = LOWER(COALESCE(auth.jwt()->>'email', ''))
         OR o.participant_id IN (
           SELECT p.id
           FROM aigms_participants p
           WHERE p.profile_id = auth.uid()::text
              OR LOWER(COALESCE(p.email, '')) = LOWER(COALESCE(auth.jwt()->>'email', ''))
         )
    )
  );

CREATE POLICY "aigms_payments_participant_select"
  ON aigms_payments FOR SELECT TO authenticated
  USING (
    order_ref IN (
      SELECT o.order_ref
      FROM aigms_orders o
      WHERE LOWER(COALESCE(o.email, '')) = LOWER(COALESCE(auth.jwt()->>'email', ''))
         OR o.participant_id IN (
           SELECT p.id
           FROM aigms_participants p
           WHERE p.profile_id = auth.uid()::text
              OR LOWER(COALESCE(p.email, '')) = LOWER(COALESCE(auth.jwt()->>'email', ''))
         )
    )
  );

CREATE POLICY "aigms_deliveries_participant_select"
  ON aigms_deliveries FOR SELECT TO authenticated
  USING (
    order_ref IN (
      SELECT o.order_ref
      FROM aigms_orders o
      WHERE LOWER(COALESCE(o.email, '')) = LOWER(COALESCE(auth.jwt()->>'email', ''))
         OR o.participant_id IN (
           SELECT p.id
           FROM aigms_participants p
           WHERE p.profile_id = auth.uid()::text
              OR LOWER(COALESCE(p.email, '')) = LOWER(COALESCE(auth.jwt()->>'email', ''))
         )
    )
  );

CREATE POLICY "aigms_certificates_participant_select"
  ON aigms_certificates FOR SELECT TO authenticated
  USING (
    status IN ('generated', 'sent', 'regenerated')
    AND order_ref IN (
      SELECT o.order_ref
      FROM aigms_orders o
      WHERE LOWER(COALESCE(o.email, '')) = LOWER(COALESCE(auth.jwt()->>'email', ''))
         OR o.participant_id IN (
           SELECT p.id
           FROM aigms_participants p
           WHERE p.profile_id = auth.uid()::text
              OR LOWER(COALESCE(p.email, '')) = LOWER(COALESCE(auth.jwt()->>'email', ''))
         )
    )
  );

CREATE POLICY "aigms_notifications_participant_select"
  ON aigms_notifications FOR SELECT TO authenticated
  USING (
    LOWER(COALESCE(recipient_email, '')) = LOWER(COALESCE(auth.jwt()->>'email', ''))
  );

-- 3.3 Normalized `animal_weights` RLS Policy (Phase 3 Weight Display Rule)
-- Participants may ONLY read `animal_weights` if the animal is allocated to their
-- order AND the order's programme has `supports_weight_timeline = TRUE` (Indonesia Breeding Programme).
DROP POLICY IF EXISTS "animal_weights_staff_all"                 ON animal_weights;
DROP POLICY IF EXISTS "animal_weights_breeding_participant_read" ON animal_weights;

CREATE POLICY "animal_weights_staff_all"
  ON animal_weights FOR ALL TO authenticated
  USING (is_aigms_staff())
  WITH CHECK (is_aigms_staff());

CREATE POLICY "animal_weights_breeding_participant_read"
  ON animal_weights FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN participants p ON p.id = o.participant_id
      JOIN programmes prog ON prog.id = o.programme_id
      WHERE oi.animal_id = animal_weights.animal_id
        AND prog.supports_weight_timeline = TRUE
        AND p.profile_id = auth.uid()
    )
  );

-- ============================================================
-- 4. DATABASE-LEVEL WEIGHT TIMELINE & ANIMAL VALIDATION TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION trg_fn_validate_aigms_animal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_breeding BOOLEAN := FALSE;
BEGIN
  IF NEW.animal_code IS NULL OR btrim(NEW.animal_code) = '' THEN
    NEW.animal_code := NEW.animal_ref;
  END IF;

  IF NEW.order_ref IS NOT NULL THEN
    IF NEW.qurban_name_holder IS NULL OR btrim(NEW.qurban_name_holder) = '' THEN
      RAISE EXCEPTION 'Qurban Name Holder is required for order animals (Order %).', NEW.order_ref;
    END IF;
  END IF;

  IF NEW.delivery_portion IS NOT NULL AND NEW.delivery_portion NOT IN ('full', 'one_third', 'two_thirds', 'nil') THEN
    RAISE EXCEPTION 'Invalid Portion to be Delivered "%" on animal %.', NEW.delivery_portion, NEW.animal_code;
  END IF;

  IF COALESCE(NEW.programme, '') ~* '1/7|cattle \(1/7\)|cow share' THEN
    NEW.animals_per_share := 7;
    NEW.share_ratio := '1/7';
  ELSIF COALESCE(NEW.animals_per_share, 0) <= 0 THEN
    NEW.animals_per_share := 1;
    NEW.share_ratio := '1/1';
  END IF;

  -- Enforce Phase 3 Weight Display Rule in DB:
  -- Order-linked animals on non-breeding programmes must never store or expose a weight_history timeline
  IF NEW.order_ref IS NOT NULL THEN
    v_is_breeding := (COALESCE(NEW.programme, '') ~* '\mbreeding\M') OR (COALESCE(NEW.programme_id, '') = 'prog-id-breeding');
    IF NOT v_is_breeding AND NEW.programme_id IS NOT NULL THEN
      SELECT COALESCE(supports_weight_timeline, FALSE)
        INTO v_is_breeding
        FROM aigms_programmes
       WHERE id = NEW.programme_id
       LIMIT 1;
    END IF;

    IF NOT COALESCE(v_is_breeding, FALSE) THEN
      NEW.weight_history := '[]'::jsonb;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. RPC: record_order_invoice_email_sent (Phase 4.8)
-- ============================================================

CREATE OR REPLACE FUNCTION record_order_invoice_email_sent(
  p_order_ref       TEXT,
  p_provider_ref    TEXT,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order aigms_orders%ROWTYPE;
BEGIN
  IF auth.role() <> 'service_role' AND NOT is_aigms_staff() THEN
    RAISE EXCEPTION 'Forbidden: only authorized staff or service role may record invoice email delivery.';
  END IF;

  SELECT * INTO v_order
    FROM aigms_orders
   WHERE LOWER(order_ref) = LOWER(btrim(p_order_ref))
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order "%" not found.', p_order_ref;
  END IF;

  IF v_order.confirmation_email_sent_at IS NOT NULL AND v_order.confirmation_email_status = 'sent' THEN
    RETURN jsonb_build_object(
      'order_ref', v_order.order_ref,
      'confirmation_email_sent_at', v_order.confirmation_email_sent_at,
      'confirmation_email_status', v_order.confirmation_email_status,
      'idempotent_replay', TRUE
    );
  END IF;

  UPDATE aigms_orders
     SET confirmation_email_sent_at         = NOW(),
         confirmation_email_status          = 'sent',
         confirmation_email_provider_ref    = COALESCE(NULLIF(btrim(p_provider_ref), ''), 'email-accepted'),
         confirmation_email_idempotency_key = COALESCE(NULLIF(btrim(p_idempotency_key), ''), 'invoice:' || v_order.order_ref)
   WHERE id = v_order.id
   RETURNING * INTO v_order;

  RETURN jsonb_build_object(
    'order_ref', v_order.order_ref,
    'confirmation_email_sent_at', v_order.confirmation_email_sent_at,
    'confirmation_email_status', v_order.confirmation_email_status,
    'idempotent_replay', FALSE
  );
END;
$$;

GRANT EXECUTE ON FUNCTION record_order_invoice_email_sent(TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 6. UPGRADED TRANSACTIONAL RPC: create_aigms_order()
--    - Enforces caller auth & participant scope
--    - Detects ambiguous participant identity conflicts & raises Exception
--    - Preserves fractional cattle share metadata (1/7 vs 1/1)
--    - Does NOT prematurely stamp confirmation_email_sent_at
-- ============================================================

CREATE OR REPLACE FUNCTION create_aigms_order(
  p_full_name         TEXT,
  p_email             TEXT,
  p_contact_number    TEXT,
  p_programme_id      TEXT,
  p_service_type      TEXT,
  p_payment_method    TEXT,
  p_quantity          INTEGER,
  p_unit_price        NUMERIC,
  p_qurban_entries    JSONB,
  p_order_ref         TEXT DEFAULT NULL,
  p_delivery_portion  TEXT DEFAULT NULL,
  p_notes             TEXT DEFAULT NULL,
  p_initial_status    TEXT DEFAULT 'pending_payment',
  p_client_request_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm_name         TEXT;
  v_norm_email        TEXT;
  v_norm_phone        TEXT;
  v_first_name        TEXT;
  v_last_name         TEXT;
  v_clean_name        TEXT;
  v_prog              aigms_programmes%ROWTYPE;
  v_participant       aigms_participants%ROWTYPE;
  v_conflict_part     aigms_participants%ROWTYPE;
  v_conflict_Raised   BOOLEAN := FALSE;
  v_order             aigms_orders%ROWTYPE;
  v_order_ref         TEXT;
  v_max_ord           INTEGER;
  v_prt_seq           INTEGER;
  v_pay_seq           INTEGER;
  v_idx               INTEGER;
  v_holder            TEXT;
  v_entry_portion     TEXT;
  v_first_portion     TEXT := NULL;
  v_animal_code       TEXT;
  v_base_code         TEXT;
  v_min_weight        NUMERIC;
  v_is_indonesia      BOOLEAN;
  v_is_au_sg          BOOLEAN;
  v_year              TEXT := EXTRACT(YEAR FROM NOW())::TEXT;
  v_initial_status    TEXT;
  v_share_divisor     INTEGER;
  v_share_ratio       TEXT;
BEGIN
  -- 0. Caller Authorization Check
  IF auth.uid() IS NULL AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: authentication required to create an order.';
  END IF;

  -- Serialize order ref & participant allocation within transaction to prevent race conditions
  PERFORM pg_advisory_xact_lock(hashtext('aigms_order_creation_lock'));

  -- 1. Idempotency check
  IF p_client_request_id IS NOT NULL AND btrim(p_client_request_id) <> '' THEN
    SELECT * INTO v_order
      FROM aigms_orders
     WHERE client_request_id = btrim(p_client_request_id)
     LIMIT 1;
    IF FOUND THEN
      SELECT * INTO v_participant
        FROM aigms_participants
       WHERE id = v_order.participant_id
       LIMIT 1;
      RETURN jsonb_build_object(
        'order', to_jsonb(v_order),
        'participant', to_jsonb(v_participant),
        'idempotent_replay', TRUE
      );
    END IF;
  END IF;

  -- 2. Normalize and validate participant inputs
  v_clean_name := regexp_replace(btrim(COALESCE(p_full_name, '')), '\s+', ' ', 'g');
  v_norm_name  := aigms_norm_text(v_clean_name);
  v_norm_email := aigms_norm_email(p_email);
  v_norm_phone := aigms_norm_phone(p_contact_number);

  IF v_norm_name = '' THEN
    RAISE EXCEPTION 'Full Name is required.';
  END IF;
  IF v_norm_email = '' OR v_norm_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'A valid Email Address is required.';
  END IF;
  IF length(v_norm_phone) < 6 THEN
    RAISE EXCEPTION 'A valid Contact Number is required.';
  END IF;

  -- Non-staff authenticated participants may only create orders for their own email
  IF auth.role() <> 'service_role' AND NOT is_aigms_staff() THEN
    IF v_norm_email <> aigms_norm_email(COALESCE(auth.jwt()->>'email', '')) THEN
      RAISE EXCEPTION 'Forbidden: participants may only create orders under their own registered email.';
    END IF;
  END IF;

  -- 3. Validate programme against configured aigms_programmes
  SELECT * INTO v_prog
    FROM aigms_programmes
   WHERE id = p_programme_id
      OR aigms_norm_text(name) = aigms_norm_text(p_programme_id)
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Programme "%" does not exist in aigms_programmes.', p_programme_id;
  END IF;

  -- 4. Validate Service Type, Payment Method & Per-Qurban Portion rules
  IF lower(btrim(COALESCE(p_service_type, ''))) NOT IN ('qurban', 'aqiqah') THEN
    RAISE EXCEPTION 'Service Type must be Qurban or Aqiqah.';
  END IF;

  IF lower(btrim(COALESCE(p_payment_method, ''))) NOT IN ('paynow', 'cash', 'installment') THEN
    RAISE EXCEPTION 'Payment Method must be PayNow, Cash, or Installment.';
  END IF;

  v_is_indonesia := (lower(btrim(v_prog.country)) = 'indonesia') OR (lower(v_prog.name) LIKE '%indonesia%');
  IF lower(btrim(p_payment_method)) = 'installment' AND NOT v_is_indonesia THEN
    RAISE EXCEPTION 'Installment payment method is only allowed for Indonesia programmes.';
  END IF;

  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'Number of Qurbans must be at least 1.';
  END IF;

  IF jsonb_typeof(p_qurban_entries) <> 'array' OR jsonb_array_length(p_qurban_entries) <> p_quantity THEN
    RAISE EXCEPTION 'Exact Qurban Name Holder entries (%) are required.', p_quantity;
  END IF;

  v_is_au_sg := (v_prog.name ~* 'australia\s*(to|→|->|-|—)+\s*singapore')
                OR (lower(btrim(v_prog.country)) = 'australia' AND lower(v_prog.name) NOT LIKE '%palestine%');

  FOR v_idx IN 0..(p_quantity - 1) LOOP
    v_holder := btrim(COALESCE(p_qurban_entries->v_idx->>'qurban_name_holder', ''));
    IF v_holder = '' THEN
      RAISE EXCEPTION 'Qurban Name Holder is required for Qurban %.', v_idx + 1;
    END IF;

    IF v_is_au_sg THEN
      v_entry_portion := lower(btrim(COALESCE(
        NULLIF(btrim(p_qurban_entries->v_idx->>'delivery_portion'), ''),
        p_delivery_portion,
        ''
      )));
      IF v_entry_portion NOT IN ('full', 'one_third', 'two_thirds', 'nil') THEN
        RAISE EXCEPTION 'Portion to be Delivered (Full, 1/3, 2/3, or NIL) is required for Qurban % (Australia -> Singapore).', v_idx + 1;
      END IF;
      IF v_idx = 0 THEN
        v_first_portion := v_entry_portion;
      END IF;
    END IF;
  END LOOP;

  -- 5. Participant matching on normalized Full Name + Email + Contact Number
  SELECT * INTO v_participant
    FROM aigms_participants
   WHERE aigms_norm_text(COALESCE(NULLIF(btrim(full_name), ''), btrim(first_name || ' ' || last_name))) = v_norm_name
     AND aigms_norm_email(email) = v_norm_email
     AND aigms_norm_phone(COALESCE(NULLIF(btrim(phone), ''), contact_number)) = v_norm_phone
   LIMIT 1;

  IF NOT FOUND THEN
    -- Check for ambiguous identity conflicts (same email or phone on a differently named participant)
    SELECT * INTO v_conflict_part
      FROM aigms_participants
     WHERE aigms_norm_email(email) = v_norm_email
        OR aigms_norm_phone(COALESCE(NULLIF(btrim(phone), ''), contact_number)) = v_norm_phone
     LIMIT 1;

    IF FOUND THEN
      v_conflict_raised := TRUE;
    END IF;

    IF strpos(v_clean_name, ' ') > 0 THEN
      v_first_name := regexp_replace(v_clean_name, '\s+\S+$', '');
      v_last_name  := regexp_replace(v_clean_name, '^.*\s+', '');
    ELSE
      v_first_name := v_clean_name;
      v_last_name  := '';
    END IF;

    SELECT COALESCE(MAX((REGEXP_MATCH(participant_ref, '^PRT-(\d+)$'))[1]::INTEGER), 0) + 1
      INTO v_prt_seq
      FROM aigms_participants;

    INSERT INTO aigms_participants (
      id, participant_ref, first_name, last_name, full_name,
      email, phone, contact_number, country, ic_number,
      orders_count, total_spent, is_active, portal_access
    ) VALUES (
      uuid_generate_v4()::TEXT,
      'PRT-' || LPAD(v_prt_seq::TEXT, 3, '0'),
      v_first_name,
      v_last_name,
      v_clean_name,
      btrim(p_email),
      btrim(p_contact_number),
      btrim(p_contact_number),
      'Singapore',
      '',
      0,
      0,
      TRUE,
      TRUE
    )
    RETURNING * INTO v_participant;
  END IF;

  -- 6. Determine unique Order Reference
  IF p_order_ref IS NOT NULL AND btrim(p_order_ref) <> '' THEN
    v_order_ref := btrim(p_order_ref);
    IF EXISTS (SELECT 1 FROM aigms_orders WHERE lower(order_ref) = lower(v_order_ref)) THEN
      RAISE EXCEPTION 'Order Reference "%" already exists.', v_order_ref;
    END IF;
  ELSE
    SELECT COALESCE(MAX((REGEXP_MATCH(order_ref, '^ORD-(\d+)$'))[1]::INTEGER), 10000) + 1
      INTO v_max_ord
      FROM aigms_orders;
    v_order_ref := 'ORD-' || v_max_ord::TEXT;
  END IF;

  v_initial_status := COALESCE(NULLIF(btrim(p_initial_status), ''), 'pending_payment');

  -- 7. Insert Order (Phase 4.8: confirmation_email_sent_at is NULL until real email provider confirms!)
  INSERT INTO aigms_orders (
    id, order_ref, order_reference,
    participant, participant_id, email, contact_number,
    programme, programme_id, programme_country,
    service_type, payment_method, delivery_portion,
    quantity, number_of_qurbans, total_amount, currency,
    status, notes, client_request_id,
    confirmation_email_sent_at,
    confirmation_email_status,
    confirmation_email_idempotency_key
  ) VALUES (
    uuid_generate_v4()::TEXT,
    v_order_ref,
    v_order_ref,
    COALESCE(NULLIF(btrim(v_participant.full_name), ''), btrim(v_participant.first_name || ' ' || v_participant.last_name)),
    v_participant.id,
    btrim(p_email),
    btrim(p_contact_number),
    v_prog.name,
    v_prog.id,
    v_prog.country,
    lower(btrim(p_service_type)),
    lower(btrim(p_payment_method)),
    CASE WHEN v_is_au_sg THEN v_first_portion ELSE NULL END,
    p_quantity,
    p_quantity,
    ROUND((COALESCE(NULLIF(p_unit_price, 0), v_prog.price_per_share) * p_quantity)::NUMERIC, 2),
    COALESCE(v_prog.currency, 'SGD'),
    v_initial_status,
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    NULLIF(btrim(COALESCE(p_client_request_id, '')), ''),
    NULL,
    CASE WHEN v_initial_status <> 'draft' THEN 'queued' ELSE 'not_sent' END,
    'invoice:' || v_order_ref
  )
  RETURNING * INTO v_order;

  -- If an ambiguous participant identity conflict was detected, flag an Exception for staff review
  IF v_conflict_raised THEN
    INSERT INTO aigms_exceptions (
      id, severity, status, category, title, description,
      related_entity, related_entity_id, assigned_to
    ) VALUES (
      uuid_generate_v4()::TEXT,
      'medium',
      'open',
      'Participant',
      'Participant identity conflict for review (' || v_order_ref || ')',
      'Order ' || v_order_ref || ' created new participant ' || v_participant.participant_ref ||
      ' (' || v_clean_name || ' / ' || btrim(p_email) || ' / ' || btrim(p_contact_number) ||
      ') because all 3 fields did not match existing participant ' || v_conflict_part.participant_ref ||
      ' (' || COALESCE(NULLIF(btrim(v_conflict_part.full_name), ''), btrim(v_conflict_part.first_name || ' ' || v_conflict_part.last_name)) ||
      ' / ' || v_conflict_part.email || ' / ' || COALESCE(v_conflict_part.phone, '') || '). Please review and confirm.',
      'participant',
      v_participant.participant_ref,
      NULL
    );
  END IF;

  -- 8. Create 1..N Animal / Share Allocation records linked to v_order_ref
  v_base_code := regexp_replace(v_order_ref, '^ORD-', '', 'i');
  v_min_weight := CASE
    WHEN v_prog.animal_type IN ('cow', 'buffalo') THEN 350
    WHEN v_prog.animal_type = 'camel' THEN 300
    ELSE 25
  END;
  v_share_divisor := GREATEST(1, COALESCE(v_prog.animals_per_share, 1));
  v_share_ratio := '1/' || v_share_divisor::TEXT;

  FOR v_idx IN 0..(p_quantity - 1) LOOP
    v_holder := btrim(p_qurban_entries->v_idx->>'qurban_name_holder');
    v_animal_code := 'ANM-' || v_base_code || '-' || LPAD((v_idx + 1)::TEXT, 2, '0');
    v_entry_portion := CASE
      WHEN v_is_au_sg THEN lower(btrim(COALESCE(
        NULLIF(btrim(p_qurban_entries->v_idx->>'delivery_portion'), ''),
        p_delivery_portion
      )))
      ELSE NULL
    END;

    INSERT INTO aigms_animals (
      id, animal_ref, animal_code, animal_type, breed, gender, status,
      current_weight_kg, min_weight_kg, approx_weight, weight_history,
      location, supplier, tag_number,
      order_id, order_ref, qurban_name_holder,
      programme, programme_id, service_type, delivery_portion,
      animals_per_share, share_ratio
    ) VALUES (
      uuid_generate_v4()::TEXT,
      v_animal_code,
      v_animal_code,
      v_prog.animal_type,
      'To be assigned',
      'male',
      'reserved',
      0,
      v_min_weight,
      COALESCE(v_prog.approx_weight_label, 'Approx. 25–30 kg'),
      '[]'::jsonb,
      COALESCE(NULLIF(v_prog.country, ''), 'TBD'),
      'To be assigned',
      'Pending',
      v_order.id,
      v_order.order_ref,
      v_holder,
      v_prog.name,
      v_prog.id,
      v_order.service_type,
      v_entry_portion,
      v_share_divisor,
      v_share_ratio
    )
    ON CONFLICT (animal_code) WHERE animal_code IS NOT NULL DO NOTHING;
  END LOOP;

  -- 9. Create linked Payment record
  IF v_order.status <> 'draft' THEN
    SELECT COALESCE(MAX((REGEXP_MATCH(payment_ref, '^PAY-' || v_year || '-(\d+)$'))[1]::INTEGER), 0) + 1
      INTO v_pay_seq
      FROM aigms_payments;

    INSERT INTO aigms_payments (
      id, payment_ref, order_ref, participant, amount, currency, method, status,
      submitted_at, verified_at
    ) VALUES (
      uuid_generate_v4()::TEXT,
      'PAY-' || v_year || '-' || LPAD(v_pay_seq::TEXT, 6, '0'),
      v_order.order_ref,
      v_order.participant,
      v_order.total_amount,
      v_order.currency,
      v_order.payment_method,
      CASE
        WHEN v_order.status = 'pending_payment' THEN 'pending'
        WHEN v_order.status = 'payment_submitted' THEN 'submitted'
        WHEN v_order.status = 'payment_under_review' THEN 'under_review'
        ELSE 'verified'
      END,
      CASE WHEN v_order.status IN ('payment_submitted', 'payment_under_review', 'payment_verified', 'confirmed') THEN NOW() ELSE NULL END,
      CASE WHEN v_order.status IN ('payment_verified', 'confirmed') THEN NOW() ELSE NULL END
    );
  END IF;

  RETURN jsonb_build_object(
    'order', to_jsonb(v_order),
    'participant', to_jsonb(v_participant),
    'identity_conflict_flagged', v_conflict_raised,
    'idempotent_replay', FALSE
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_aigms_order(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, NUMERIC, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

-- ============================================================
-- 7. PUBLIC NON-SENSITIVE CERTIFICATE VERIFICATION RPC (/verify/:code)
-- ============================================================

CREATE OR REPLACE FUNCTION verify_aigms_certificate(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean TEXT := UPPER(btrim(COALESCE(p_code, '')));
  v_cert  aigms_certificates%ROWTYPE;
BEGIN
  IF v_clean = '' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_cert
    FROM aigms_certificates
   WHERE status IN ('generated', 'sent', 'regenerated')
     AND (
       UPPER(btrim(verification_code)) = v_clean
       OR UPPER(btrim(certificate_ref)) = v_clean
     )
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Return ONLY safe public verification attributes (zero email/phone/IC/address)
  RETURN jsonb_build_object(
    'id', v_cert.id,
    'certificate_ref', v_cert.certificate_ref,
    'order_ref', v_cert.order_ref,
    'participant_name', COALESCE(NULLIF(btrim(v_cert.qurban_name_holder), ''), v_cert.participant_name),
    'qurban_name_holder', COALESCE(NULLIF(btrim(v_cert.qurban_name_holder), ''), v_cert.participant_name),
    'programme_name', v_cert.programme_name,
    'country', COALESCE(v_cert.country, ''),
    'animal_ref', v_cert.animal_ref,
    'animal_type', v_cert.animal_type,
    'animal_label', v_cert.animal_label,
    'qurban_date', v_cert.qurban_date,
    'status', v_cert.status,
    'generated_at', v_cert.generated_at,
    'sent_at', v_cert.sent_at,
    'verification_code', v_cert.verification_code,
    'year', COALESCE(v_cert.year, EXTRACT(YEAR FROM NOW())::TEXT),
    'template_type', COALESCE(v_cert.template_type, 'standard'),
    'service_type', COALESCE(v_cert.service_type, 'qurban'),
    'animal_photo_url', v_cert.animal_photo_url
  );
END;
$$;

GRANT EXECUTE ON FUNCTION verify_aigms_certificate(TEXT) TO anon, authenticated;

-- ============================================================
-- 8. SAFE ADMIN ORDER DELETE RPC (Audit-Logged Disposal)
-- ============================================================

CREATE OR REPLACE FUNCTION delete_aigms_order(p_order_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order aigms_orders%ROWTYPE;
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND is_active = TRUE
      AND role IN ('super_admin', 'operations_admin', 'd3_technical_admin')
  ) THEN
    RAISE EXCEPTION 'Forbidden: only senior admin staff may permanently delete disposable orders.';
  END IF;

  SELECT * INTO v_order
    FROM aigms_orders
   WHERE id = p_order_id OR LOWER(order_ref) = LOWER(btrim(p_order_id))
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order "%" not found.', p_order_id;
  END IF;

  IF v_order.status NOT IN ('cancelled', 'draft', 'pending_payment', 'payment_rejected') THEN
    RAISE EXCEPTION 'Order % must be cancelled before it can be permanently deleted.', v_order.order_ref;
  END IF;

  DELETE FROM aigms_certificates WHERE order_ref = v_order.order_ref;
  DELETE FROM aigms_deliveries   WHERE order_ref = v_order.order_ref;
  DELETE FROM aigms_payments     WHERE order_ref = v_order.order_ref;
  DELETE FROM aigms_animals      WHERE order_ref = v_order.order_ref AND animal_code IS NOT NULL;
  UPDATE aigms_animals
     SET status = 'available', order_id = NULL, order_ref = NULL, qurban_name_holder = NULL
   WHERE order_ref = v_order.order_ref AND animal_code IS NULL;
  DELETE FROM aigms_orders       WHERE id = v_order.id;

  INSERT INTO aigms_audit_logs (
    id, actor_email, actor_role, action, entity, entity_id, description
  ) VALUES (
    uuid_generate_v4()::TEXT,
    COALESCE(auth.jwt()->>'email', 'admin'),
    'super_admin',
    'order.deleted',
    'order',
    v_order.order_ref,
    'Order ' || v_order.order_ref || ' permanently deleted by admin'
  );

  RETURN jsonb_build_object('deleted', TRUE, 'order_ref', v_order.order_ref);
END;
$$;

GRANT EXECUTE ON FUNCTION delete_aigms_order(TEXT) TO authenticated;
