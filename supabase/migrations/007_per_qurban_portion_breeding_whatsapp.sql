-- ============================================================
-- AIGMS — Al Ihsan Group Qurban Management System
-- Migration: 007_per_qurban_portion_breeding_whatsapp.sql
-- Description:
--   Safe, non-destructive migration aligning the database schema and
--   transactional order RPC with the latest AIG client updates:
--   1. Per-Qurban "Portion to be Delivered" (Full, 1/3, 2/3, NIL) on
--      Australia -> Singapore orders with multiple Qurbans.
--   2. "Indonesia - Breeding Programme" (SGD 360, supports_weight_timeline = TRUE,
--      Installment allowed) + Approx. Weight labels (supports_weight_timeline = FALSE)
--      on all 11 standard Qurban programmes.
--   3. One-time Order Confirmation & Invoice email tracking
--      (confirmation_email_sent_at) + WhatsApp (+6585456783) primary / Email
--      fallback communication settings.
-- ============================================================

-- ============================================================
-- 1. SAFE COLUMN ADDITIONS (Normalized & Operational Tables)
-- ============================================================

ALTER TABLE IF EXISTS programmes
  ADD COLUMN IF NOT EXISTS approx_weight_label      TEXT,
  ADD COLUMN IF NOT EXISTS supports_weight_timeline BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE IF EXISTS orders
  ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS animals
  ADD COLUMN IF NOT EXISTS approx_weight  TEXT,
  ADD COLUMN IF NOT EXISTS weight_history JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS aigms_programmes
  ADD COLUMN IF NOT EXISTS approx_weight_label      TEXT,
  ADD COLUMN IF NOT EXISTS supports_weight_timeline BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE IF EXISTS aigms_orders
  ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS aigms_animals
  ADD COLUMN IF NOT EXISTS approx_weight  TEXT,
  ADD COLUMN IF NOT EXISTS weight_history JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ============================================================
-- 2. SEED INDONESIA BREEDING PROGRAMME & BACKFILL WEIGHT LABELS
-- ============================================================

INSERT INTO aigms_programmes (
  id, name, slug, country, animal_type, animals_per_share,
  price_per_share, currency, shares_available, min_quantity,
  distribution_method, is_active, qurban_date, orders_count,
  approx_weight_label, supports_weight_timeline
) VALUES (
  'prog-id-breeding',
  'Indonesia - Breeding Programme',
  'id-breeding',
  'Indonesia',
  'goat',
  1,
  360,
  'SGD',
  0,
  1,
  'local_distribution',
  TRUE,
  '2026-05-27',
  0,
  'Approx. 25–35 kg (monthly weight updates)',
  TRUE
)
ON CONFLICT (id) DO UPDATE
   SET approx_weight_label      = EXCLUDED.approx_weight_label,
       supports_weight_timeline = TRUE,
       is_active                = TRUE;

-- Backfill standard 11 programmes: static approx weight only (supports_weight_timeline = FALSE)
UPDATE aigms_programmes
   SET supports_weight_timeline = FALSE,
       approx_weight_label = CASE id
         WHEN 'prog-au-sg-lamb'   THEN 'Approx. 18–22 kg'
         WHEN 'prog-au-sg-sheep'  THEN 'Approx. 25–30 kg'
         WHEN 'prog-au-sg-cattle' THEN 'Approx. 300–350 kg (whole)'
         WHEN 'prog-au-ps-lamb'   THEN 'Approx. 18–22 kg'
         WHEN 'prog-au-ps-sheep'  THEN 'Approx. 25–30 kg'
         WHEN 'prog-au-ps-cattle' THEN 'Approx. 300–350 kg (whole)'
         WHEN 'prog-ye-goat-m'    THEN 'Approx. 20–25 kg'
         WHEN 'prog-ye-goat-l'    THEN 'Approx. 25–30 kg'
         WHEN 'prog-id-goat-xl'   THEN 'Approx. 35–40 kg'
         WHEN 'prog-ug-sheep'     THEN 'Approx. 25–30 kg'
         WHEN 'prog-ug-goat'      THEN 'Approx. 22–28 kg'
         ELSE COALESCE(approx_weight_label, 'Approx. 25–30 kg')
       END
 WHERE id <> 'prog-id-breeding'
   AND LOWER(name) NOT LIKE '%breeding%';

-- Backfill approx_weight on existing order animals where missing
UPDATE aigms_animals a
   SET approx_weight = p.approx_weight_label
  FROM aigms_programmes p
 WHERE (a.programme_id = p.id OR LOWER(TRIM(COALESCE(a.programme, ''))) = LOWER(TRIM(p.name)))
   AND (a.approx_weight IS NULL OR TRIM(a.approx_weight) = '');

-- ============================================================
-- 3. VALIDATE PER-QURBAN PORTION ON ORDER ANIMALS
-- ============================================================

CREATE OR REPLACE FUNCTION trg_fn_validate_aigms_animal()
RETURNS TRIGGER AS $$
DECLARE
  is_au_sg BOOLEAN;
BEGIN
  IF NEW.animal_code IS NOT NULL AND TRIM(NEW.animal_code) = '' THEN
    NEW.animal_code := NULL;
  END IF;

  IF NEW.animal_code IS NOT NULL AND (NEW.animal_ref IS NULL OR TRIM(NEW.animal_ref) = '') THEN
    NEW.animal_ref := NEW.animal_code;
  END IF;

  IF NEW.animal_code IS NOT NULL AND NEW.order_ref IS NOT NULL AND TRIM(COALESCE(NEW.qurban_name_holder, '')) = '' THEN
    RAISE EXCEPTION 'Qurban Name Holder is required for order animal %.', NEW.animal_code;
  END IF;

  is_au_sg := (
    COALESCE(NEW.programme, '') ~* 'australia\s*(to|→|->|-|—)+\s*singapore'
  );

  IF is_au_sg AND NEW.order_ref IS NOT NULL THEN
    IF NEW.delivery_portion IS NULL OR TRIM(NEW.delivery_portion) = '' THEN
      RAISE EXCEPTION 'Portion to be Delivered is required for Australia -> Singapore animal %.', COALESCE(NEW.animal_code, NEW.animal_ref);
    END IF;
    NEW.delivery_portion := LOWER(TRIM(NEW.delivery_portion));
    IF NEW.delivery_portion NOT IN ('full', 'one_third', 'two_thirds', 'nil') THEN
      RAISE EXCEPTION 'Invalid Portion to be Delivered (%) for animal %.', NEW.delivery_portion, COALESCE(NEW.animal_code, NEW.animal_ref);
    END IF;
  ELSIF NEW.programme IS NOT NULL AND NOT is_au_sg THEN
    NEW.delivery_portion := NULL;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. UPDATE create_aigms_order RPC FOR PER-QURBAN PORTIONS,
--    APPROX WEIGHT, AND ONE-TIME INVOICE EMAIL TIMESTAMP
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
  v_caller_role      user_role;
  v_existing_order   aigms_orders%ROWTYPE;
  v_prog             aigms_programmes%ROWTYPE;
  v_participant      aigms_participants%ROWTYPE;
  v_order            aigms_orders%ROWTYPE;
  v_order_ref        TEXT;
  v_max_num          INTEGER;
  v_name_parts       TEXT[];
  v_first_name       TEXT;
  v_last_name        TEXT;
  v_prt_seq          INTEGER;
  v_pay_seq          INTEGER;
  v_year             TEXT;
  v_holder           TEXT;
  v_entry_portion    TEXT;
  v_header_portion   TEXT;
  v_is_au_sg         BOOLEAN;
  v_animal_code      TEXT;
  v_ref_num          TEXT;
  v_animal_status    TEXT;
  v_min_weight       NUMERIC;
  v_profile_id       UUID;
  i                  INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role IS NOT NULL AND v_caller_role = 'participant' THEN
    RAISE EXCEPTION 'Permission denied: staff role required to create admin orders.';
  END IF;

  -- Idempotency: return existing order if client_request_id was already processed
  IF p_client_request_id IS NOT NULL AND TRIM(p_client_request_id) <> '' THEN
    SELECT * INTO v_existing_order
      FROM aigms_orders
     WHERE client_request_id = TRIM(p_client_request_id)
     LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'order', to_jsonb(v_existing_order),
        'idempotent_replay', TRUE
      );
    END IF;
  END IF;

  IF TRIM(COALESCE(p_full_name, '')) = ''
     OR TRIM(COALESCE(p_email, '')) = ''
     OR TRIM(COALESCE(p_contact_number, '')) = '' THEN
    RAISE EXCEPTION 'Full Name, Email Address, and Contact Number are required.';
  END IF;

  SELECT * INTO v_prog FROM aigms_programmes WHERE id = p_programme_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected programme (%) does not exist.', p_programme_id;
  END IF;

  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'Number of Qurbans must be at least 1.';
  END IF;

  IF p_qurban_entries IS NULL
     OR jsonb_typeof(p_qurban_entries) <> 'array'
     OR jsonb_array_length(p_qurban_entries) <> p_quantity THEN
    RAISE EXCEPTION 'Number of Qurban Name Holder entries must match Number of Qurbans (%).', p_quantity;
  END IF;

  v_is_au_sg := (
    v_prog.name ~* 'australia\s*(to|→|->|-|—)+\s*singapore'
    OR (
      LOWER(TRIM(COALESCE(v_prog.country, ''))) = 'australia'
      AND LOWER(COALESCE(v_prog.name, '')) NOT LIKE '%palestine%'
    )
  );

  v_header_portion := NULL;

  FOR i IN 0 .. (p_quantity - 1) LOOP
    v_holder := TRIM(COALESCE(p_qurban_entries->i->>'qurban_name_holder', ''));
    IF v_holder = '' THEN
      RAISE EXCEPTION 'Qurban Name Holder is required for Qurban %.', i + 1;
    END IF;

    IF v_is_au_sg THEN
      v_entry_portion := LOWER(TRIM(COALESCE(
        NULLIF(TRIM(p_qurban_entries->i->>'delivery_portion'), ''),
        p_delivery_portion,
        ''
      )));
      IF v_entry_portion = '' THEN
        RAISE EXCEPTION 'Portion to be Delivered is required for Qurban % (Australia -> Singapore).', i + 1;
      END IF;
      IF v_entry_portion NOT IN ('full', 'one_third', 'two_thirds', 'nil') THEN
        RAISE EXCEPTION 'Invalid Portion to be Delivered (%) for Qurban %.', v_entry_portion, i + 1;
      END IF;
      IF i = 0 THEN
        v_header_portion := v_entry_portion;
      END IF;
    END IF;
  END LOOP;

  PERFORM pg_advisory_xact_lock(914472026);
  v_year := EXTRACT(YEAR FROM NOW())::TEXT;

  IF p_order_ref IS NOT NULL AND TRIM(p_order_ref) <> '' THEN
    v_order_ref := TRIM(p_order_ref);
    IF EXISTS (SELECT 1 FROM aigms_orders WHERE LOWER(order_ref) = LOWER(v_order_ref)) THEN
      RAISE EXCEPTION 'Order Reference % already exists.', v_order_ref;
    END IF;
  ELSE
    SELECT COALESCE(MAX((REGEXP_MATCH(order_ref, '^ORD-(\d+)$'))[1]::INTEGER), 10000)
      INTO v_max_num
      FROM aigms_orders
     WHERE order_ref ~ '^ORD-\d+$';
    v_order_ref := 'ORD-' || (v_max_num + 1)::TEXT;
  END IF;

  -- Participant matching: Full Name + Email + Contact Number (normalized)
  SELECT * INTO v_participant
    FROM aigms_participants p
   WHERE aigms_norm_text(COALESCE(NULLIF(p.full_name, ''), p.first_name || ' ' || p.last_name)) = aigms_norm_text(p_full_name)
     AND aigms_norm_text(p.email) = aigms_norm_text(p_email)
     AND aigms_norm_phone(COALESCE(NULLIF(p.phone, ''), p.contact_number)) = aigms_norm_phone(p_contact_number)
   LIMIT 1;

  IF NOT FOUND THEN
    v_name_parts := REGEXP_SPLIT_TO_ARRAY(TRIM(p_full_name), '\s+');
    IF ARRAY_LENGTH(v_name_parts, 1) > 1 THEN
      v_first_name := ARRAY_TO_STRING(v_name_parts[1 : ARRAY_LENGTH(v_name_parts, 1) - 1], ' ');
      v_last_name  := v_name_parts[ARRAY_LENGTH(v_name_parts, 1)];
    ELSE
      v_first_name := v_name_parts[1];
      v_last_name  := '';
    END IF;

    SELECT COALESCE(MAX((REGEXP_MATCH(participant_ref, '^PRT-' || v_year || '-(\d+)$'))[1]::INTEGER), 0) + 1
      INTO v_prt_seq
      FROM aigms_participants;

    SELECT id INTO v_profile_id
      FROM profiles
     WHERE LOWER(email) = LOWER(TRIM(p_email))
     LIMIT 1;

    INSERT INTO aigms_participants (
      id, participant_ref, first_name, last_name, full_name,
      email, phone, contact_number, country, ic_number,
      orders_count, total_spent, is_active, portal_access, profile_id
    ) VALUES (
      uuid_generate_v4()::TEXT,
      'PRT-' || v_year || '-' || LPAD(v_prt_seq::TEXT, 3, '0'),
      v_first_name,
      v_last_name,
      TRIM(p_full_name),
      TRIM(p_email),
      TRIM(p_contact_number),
      TRIM(p_contact_number),
      'Singapore',
      '',
      1,
      0,
      TRUE,
      TRUE,
      v_profile_id
    )
    RETURNING * INTO v_participant;
  END IF;

  INSERT INTO aigms_orders (
    id, order_ref, order_reference, participant, participant_id,
    contact_number, email, programme, programme_id, programme_country,
    service_type, payment_method, delivery_portion,
    quantity, number_of_qurbans, total_amount, currency,
    status, notes, client_request_id, confirmation_email_sent_at
  ) VALUES (
    uuid_generate_v4()::TEXT,
    v_order_ref,
    v_order_ref,
    COALESCE(NULLIF(v_participant.full_name, ''), TRIM(v_participant.first_name || ' ' || v_participant.last_name)),
    v_participant.id,
    TRIM(p_contact_number),
    TRIM(p_email),
    v_prog.name,
    v_prog.id,
    v_prog.country,
    LOWER(TRIM(p_service_type)),
    LOWER(TRIM(p_payment_method)),
    v_header_portion,
    p_quantity,
    p_quantity,
    COALESCE(p_unit_price, v_prog.price_per_share) * p_quantity,
    COALESCE(v_prog.currency, 'SGD'),
    COALESCE(NULLIF(TRIM(p_initial_status), ''), 'pending_payment'),
    NULLIF(TRIM(COALESCE(p_notes, '')), ''),
    NULLIF(TRIM(COALESCE(p_client_request_id, '')), ''),
    CASE WHEN COALESCE(NULLIF(TRIM(p_initial_status), ''), 'pending_payment') <> 'draft' THEN NOW() ELSE NULL END
  )
  RETURNING * INTO v_order;

  v_ref_num := REGEXP_REPLACE(v_order.order_ref, '^ORD-', '', 'i');
  v_animal_status := CASE
    WHEN v_order.status IN ('animal_allocated') THEN 'allocated'
    WHEN v_order.status IN ('animal_growing') THEN 'growing'
    WHEN v_order.status IN ('final_inspection') THEN 'inspection_pending'
    WHEN v_order.status IN ('qurban_complete', 'processing', 'shipped', 'arrived', 'delivery_scheduled', 'out_for_delivery', 'delivered') THEN 'slaughtered'
    WHEN v_order.status IN ('certificate_generated', 'completed') THEN 'completed'
    ELSE 'reserved'
  END;
  v_min_weight := CASE
    WHEN v_prog.animal_type IN ('cow', 'buffalo') THEN 350
    WHEN v_prog.animal_type = 'camel' THEN 300
    ELSE 25
  END;

  FOR i IN 0 .. (p_quantity - 1) LOOP
    v_holder := TRIM(p_qurban_entries->i->>'qurban_name_holder');
    v_animal_code := 'ANM-' || v_ref_num || '-' || LPAD((i + 1)::TEXT, 2, '0');
    v_entry_portion := CASE
      WHEN v_is_au_sg THEN LOWER(TRIM(COALESCE(NULLIF(TRIM(p_qurban_entries->i->>'delivery_portion'), ''), v_order.delivery_portion)))
      ELSE NULL
    END;

    INSERT INTO aigms_animals (
      id, animal_ref, animal_code, animal_type, breed, gender,
      status, current_weight_kg, min_weight_kg, approx_weight, weight_history,
      location, supplier, tag_number, order_id, order_ref, qurban_name_holder,
      programme, programme_id, service_type, delivery_portion
    ) VALUES (
      uuid_generate_v4()::TEXT,
      v_animal_code,
      v_animal_code,
      v_prog.animal_type,
      'To be assigned',
      'male',
      v_animal_status,
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
      v_entry_portion
    )
    ON CONFLICT (animal_code) WHERE animal_code IS NOT NULL DO NOTHING;
  END LOOP;

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
    'idempotent_replay', FALSE
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_aigms_order(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, NUMERIC, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;
