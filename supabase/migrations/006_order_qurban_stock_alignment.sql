-- ============================================================
-- AIGMS — Al Ihsan Group Qurban Management System
-- Migration: 006_order_qurban_stock_alignment.sql
-- Description:
--   Safe, non-destructive migration aligning both the flat operational
--   tables (aigms_*) and normalized tables (orders, animals, participants)
--   with the latest AIG Order Creation, Participant Matching, Dynamic
--   Qurban/Animal Stock, Payment Method, Service Type, and Australia ->
--   Singapore Delivery Portion requirements.
--
--   Includes:
--   1. Enum extensions (installment payment_method, nil delivery_portion)
--   2. Safe schema additions & backfills (no data loss)
--   3. Live AIG 1447H/2026 programme seed (idempotent)
--   4. Non-destructive foreign keys & uniqueness indexes
--   5. Backend validation triggers (Indonesia-only installment,
--      Australia -> Singapore portion requirement, Order Reference
--      integrity, Qurban count validation, Participant normalization)
--   6. Transactional, idempotent RPC create_aigms_order()
-- ============================================================

-- ============================================================
-- 1. ENUM EXTENSIONS (Normalized Schema)
-- ============================================================

ALTER TYPE payment_method   ADD VALUE IF NOT EXISTS 'installment';
ALTER TYPE delivery_portion ADD VALUE IF NOT EXISTS 'nil';

-- Allow both Qurban and Aqiqah orders to record delivery_portion on Australia -> Singapore
ALTER TABLE IF EXISTS orders
  DROP CONSTRAINT IF EXISTS orders_portion_requires_qurban;

-- ============================================================
-- 2. NORMALIZED TABLES — SAFE MISSING COLUMNS
-- ============================================================

ALTER TABLE IF EXISTS participants
  ADD COLUMN IF NOT EXISTS full_name       TEXT,
  ADD COLUMN IF NOT EXISTS contact_number  TEXT,
  ADD COLUMN IF NOT EXISTS portal_access   BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE participants
   SET full_name      = COALESCE(NULLIF(TRIM(full_name), ''), TRIM(first_name || ' ' || last_name)),
       contact_number = COALESCE(NULLIF(TRIM(contact_number), ''), phone)
 WHERE full_name IS NULL OR contact_number IS NULL;

-- Replace strict single-email uniqueness on participants if present so
-- matching follows Full Name + Email + Contact Number (3-field rule)
ALTER TABLE IF EXISTS participants
  DROP CONSTRAINT IF EXISTS participants_tenant_id_email_key;

ALTER TABLE IF EXISTS orders
  ADD COLUMN IF NOT EXISTS order_reference    TEXT,
  ADD COLUMN IF NOT EXISTS payment_method     TEXT DEFAULT 'paynow',
  ADD COLUMN IF NOT EXISTS number_of_qurbans  INTEGER;

UPDATE orders
   SET order_reference   = COALESCE(order_reference, order_ref),
       number_of_qurbans = COALESCE(number_of_qurbans, quantity)
 WHERE order_reference IS NULL OR number_of_qurbans IS NULL;

ALTER TABLE IF EXISTS animals
  ADD COLUMN IF NOT EXISTS animal_code       TEXT,
  ADD COLUMN IF NOT EXISTS order_id          UUID REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS programme_id      UUID REFERENCES programmes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_portion  delivery_portion;

CREATE UNIQUE INDEX IF NOT EXISTS idx_animals_tenant_animal_code
  ON animals(tenant_id, animal_code)
  WHERE animal_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_animals_order_id     ON animals(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_animals_programme_id ON animals(programme_id) WHERE programme_id IS NOT NULL;

-- ============================================================
-- 3. FLAT OPERATIONAL TABLES (aigms_*) — SAFE ADDITIONS
-- ============================================================

ALTER TABLE IF EXISTS aigms_participants
  ADD COLUMN IF NOT EXISTS full_name       TEXT,
  ADD COLUMN IF NOT EXISTS contact_number  TEXT,
  ADD COLUMN IF NOT EXISTS profile_id      UUID,
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE aigms_participants
   SET full_name      = COALESCE(NULLIF(TRIM(full_name), ''), TRIM(first_name || ' ' || last_name)),
       contact_number = COALESCE(NULLIF(TRIM(contact_number), ''), phone)
 WHERE full_name IS NULL OR contact_number IS NULL;

ALTER TABLE IF EXISTS aigms_orders
  ADD COLUMN IF NOT EXISTS order_reference    TEXT,
  ADD COLUMN IF NOT EXISTS number_of_qurbans  INTEGER,
  ADD COLUMN IF NOT EXISTS client_request_id  TEXT,
  ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE aigms_orders
   SET order_reference   = COALESCE(order_reference, order_ref),
       number_of_qurbans = COALESCE(number_of_qurbans, quantity)
 WHERE order_reference IS NULL OR number_of_qurbans IS NULL;

ALTER TABLE IF EXISTS aigms_animals
  ADD COLUMN IF NOT EXISTS order_id          TEXT,
  ADD COLUMN IF NOT EXISTS programme_id      TEXT,
  ADD COLUMN IF NOT EXISTS delivery_portion  TEXT,
  ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill order_id and programme_id on existing aigms_animals rows safely
UPDATE aigms_animals a
   SET order_id = o.id,
       delivery_portion = COALESCE(a.delivery_portion, o.delivery_portion)
  FROM aigms_orders o
 WHERE a.order_ref = o.order_ref
   AND a.order_id IS NULL;

UPDATE aigms_animals a
   SET programme_id = p.id
  FROM aigms_programmes p
 WHERE LOWER(TRIM(COALESCE(a.programme, ''))) = LOWER(TRIM(p.name))
   AND a.programme_id IS NULL;

-- ============================================================
-- 4. SEED LIVE AIG 1447H / 2026 PROGRAMMES (IDEMPOTENT)
-- ============================================================

INSERT INTO aigms_programmes (
  id, name, slug, country, animal_type, animals_per_share,
  price_per_share, currency, shares_available, min_quantity,
  distribution_method, is_active, qurban_date, orders_count
) VALUES
  ('prog-au-sg-lamb',   'Australia to Singapore - Lamb',         'au-sg-lamb',   'Australia', 'lamb',  1, 345, 'SGD', 0, 1, 'direct_delivery',    TRUE, '2026-05-27', 0),
  ('prog-au-sg-sheep',  'Australia to Singapore - Sheep',        'au-sg-sheep',  'Australia', 'sheep', 1, 330, 'SGD', 0, 1, 'direct_delivery',    TRUE, '2026-05-27', 0),
  ('prog-au-sg-cattle', 'Australia to Singapore - Cattle (1/7)', 'au-sg-cattle', 'Australia', 'cow',   7, 330, 'SGD', 0, 1, 'direct_delivery',    TRUE, '2026-05-27', 0),
  ('prog-au-ps-lamb',   'Australia to Palestine - Lamb',         'au-ps-lamb',   'Palestine', 'lamb',  1, 355, 'SGD', 0, 1, 'local_distribution', TRUE, '2026-05-27', 0),
  ('prog-au-ps-sheep',  'Australia to Palestine - Sheep',        'au-ps-sheep',  'Palestine', 'sheep', 1, 335, 'SGD', 0, 1, 'local_distribution', TRUE, '2026-05-27', 0),
  ('prog-au-ps-cattle', 'Australia to Palestine - Cattle (1/7)', 'au-ps-cattle', 'Palestine', 'cow',   7, 330, 'SGD', 0, 1, 'local_distribution', TRUE, '2026-05-27', 0),
  ('prog-ye-goat-m',    'Yemen/Tarim - Goat (M)',                'ye-goat-m',    'Yemen',     'goat',  1, 265, 'SGD', 0, 1, 'local_distribution', TRUE, '2026-05-27', 0),
  ('prog-ye-goat-l',    'Yemen/Tarim - Goat (L)',                'ye-goat-l',    'Yemen',     'goat',  1, 300, 'SGD', 0, 1, 'local_distribution', TRUE, '2026-05-27', 0),
  ('prog-id-goat-xl',   'Indonesia - Goat (XL)',                 'id-goat-xl',   'Indonesia', 'goat',  1, 290, 'SGD', 0, 1, 'local_distribution', TRUE, '2026-05-27', 0),
  ('prog-ug-sheep',     'Uganda - Sheep',                        'ug-sheep',     'Uganda',    'sheep', 1, 165, 'SGD', 0, 1, 'local_distribution', TRUE, '2026-05-27', 0),
  ('prog-ug-goat',      'Uganda - Goat',                         'ug-goat',      'Uganda',    'goat',  1, 165, 'SGD', 0, 1, 'local_distribution', TRUE, '2026-05-27', 0)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. INDEXES & NON-DESTRUCTIVE FOREIGN KEYS
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_aigms_orders_client_req
  ON aigms_orders(client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aigms_orders_participant_id ON aigms_orders(participant_id);
CREATE INDEX IF NOT EXISTS idx_aigms_orders_programme_id   ON aigms_orders(programme_id);
CREATE INDEX IF NOT EXISTS idx_aigms_orders_service_type   ON aigms_orders(service_type);

CREATE UNIQUE INDEX IF NOT EXISTS idx_aigms_animals_animal_code
  ON aigms_animals(animal_code)
  WHERE animal_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aigms_animals_order_ref    ON aigms_animals(order_ref) WHERE order_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_aigms_animals_order_id     ON aigms_animals(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_aigms_animals_programme_id ON aigms_animals(programme_id) WHERE programme_id IS NOT NULL;

DO $$ BEGIN
  ALTER TABLE aigms_orders
    ADD CONSTRAINT fk_aigms_orders_participant
    FOREIGN KEY (participant_id) REFERENCES aigms_participants(id)
    ON DELETE SET NULL NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE aigms_orders
    ADD CONSTRAINT fk_aigms_orders_programme
    FOREIGN KEY (programme_id) REFERENCES aigms_programmes(id)
    ON DELETE SET NULL NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE aigms_animals
    ADD CONSTRAINT fk_aigms_animals_order
    FOREIGN KEY (order_id) REFERENCES aigms_orders(id)
    ON DELETE SET NULL NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE aigms_animals
    ADD CONSTRAINT fk_aigms_animals_programme
    FOREIGN KEY (programme_id) REFERENCES aigms_programmes(id)
    ON DELETE SET NULL NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 6. NORMALIZATION & BACKEND VALIDATION FUNCTIONS / TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION aigms_norm_text(val TEXT)
RETURNS TEXT AS $$
  SELECT LOWER(REGEXP_REPLACE(TRIM(COALESCE(val, '')), '\s+', ' ', 'g'));
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION aigms_norm_phone(val TEXT)
RETURNS TEXT AS $$
DECLARE
  digits TEXT;
BEGIN
  digits := REGEXP_REPLACE(COALESCE(val, ''), '[^0-9]', '', 'g');
  -- Normalize 8-digit Singapore local mobile/landline numbers (6/8/9xxxxxxx) to 65xxxxxxxx
  IF LENGTH(digits) = 8 AND SUBSTRING(digits FROM 1 FOR 1) IN ('6', '8', '9') THEN
    RETURN '65' || digits;
  END IF;
  RETURN digits;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Participant trigger: sync full_name / contact_number & block exact 3-field duplicates
CREATE OR REPLACE FUNCTION trg_fn_validate_aigms_participant()
RETURNS TRIGGER AS $$
DECLARE
  computed_full TEXT;
  computed_phone TEXT;
  dup_id TEXT;
BEGIN
  computed_full := COALESCE(NULLIF(TRIM(NEW.full_name), ''), TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '')));
  computed_phone := COALESCE(NULLIF(TRIM(NEW.phone), ''), TRIM(COALESCE(NEW.contact_number, '')));

  NEW.full_name      := computed_full;
  NEW.phone          := computed_phone;
  NEW.contact_number := computed_phone;
  NEW.email          := TRIM(COALESCE(NEW.email, ''));
  NEW.updated_at     := NOW();

  IF TG_OP = 'INSERT' AND NEW.full_name <> '' AND NEW.email <> '' AND NEW.phone <> '' THEN
    SELECT id INTO dup_id
      FROM aigms_participants p
     WHERE p.id <> NEW.id
       AND aigms_norm_text(COALESCE(NULLIF(p.full_name, ''), p.first_name || ' ' || p.last_name)) = aigms_norm_text(NEW.full_name)
       AND aigms_norm_text(p.email) = aigms_norm_text(NEW.email)
       AND aigms_norm_phone(COALESCE(NULLIF(p.phone, ''), p.contact_number)) = aigms_norm_phone(NEW.phone)
     LIMIT 1;

    IF dup_id IS NOT NULL THEN
      RAISE EXCEPTION 'Duplicate participant: participant with matching Full Name, Email, and Contact Number already exists (%).', dup_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_aigms_participant ON aigms_participants;
CREATE TRIGGER trg_validate_aigms_participant
  BEFORE INSERT OR UPDATE ON aigms_participants
  FOR EACH ROW EXECUTE FUNCTION trg_fn_validate_aigms_participant();

-- Order trigger: enforce Order Ref, Qurban count, Payment Method (Indonesia-only installment),
-- Service Type, and Australia -> Singapore delivery portion
CREATE OR REPLACE FUNCTION trg_fn_validate_aigms_order()
RETURNS TRIGGER AS $$
DECLARE
  is_indonesia BOOLEAN;
  is_au_sg     BOOLEAN;
BEGIN
  NEW.order_ref := TRIM(COALESCE(NEW.order_ref, NEW.order_reference, ''));
  IF NEW.order_ref = '' THEN
    RAISE EXCEPTION 'Order Reference is required.';
  END IF;
  NEW.order_reference := NEW.order_ref;

  NEW.quantity := COALESCE(NEW.quantity, NEW.number_of_qurbans, 1);
  IF NEW.quantity < 1 THEN
    RAISE EXCEPTION 'Number of Qurbans must be at least 1.';
  END IF;
  NEW.number_of_qurbans := NEW.quantity;

  IF TRIM(COALESCE(NEW.programme, '')) = '' THEN
    RAISE EXCEPTION 'Programme is required.';
  END IF;

  NEW.service_type := LOWER(TRIM(COALESCE(NEW.service_type, 'qurban')));
  IF NEW.service_type NOT IN ('qurban', 'aqiqah', 'nazar') THEN
    RAISE EXCEPTION 'Invalid Type of Service: %. Allowed values are qurban, aqiqah.', NEW.service_type;
  END IF;

  IF NEW.payment_method IS NOT NULL AND TRIM(NEW.payment_method) <> '' THEN
    NEW.payment_method := LOWER(TRIM(NEW.payment_method));
    IF NEW.payment_method NOT IN ('paynow', 'cash', 'installment', 'bank_transfer') THEN
      RAISE EXCEPTION 'Invalid Payment Method: %.', NEW.payment_method;
    END IF;
  END IF;

  is_indonesia := (
    LOWER(TRIM(COALESCE(NEW.programme_country, ''))) = 'indonesia'
    OR LOWER(COALESCE(NEW.programme, '')) LIKE '%indonesia%'
  );

  IF NEW.payment_method = 'installment' AND NOT is_indonesia THEN
    RAISE EXCEPTION 'Installment payment method is only available for Indonesia programmes.';
  END IF;

  is_au_sg := (
    NEW.programme ~* 'australia\s*(to|→|->|-|—)+\s*singapore'
    OR (
      LOWER(TRIM(COALESCE(NEW.programme_country, ''))) = 'australia'
      AND LOWER(COALESCE(NEW.programme, '')) NOT LIKE '%palestine%'
    )
  );

  IF is_au_sg THEN
    IF NEW.delivery_portion IS NULL OR TRIM(NEW.delivery_portion) = '' THEN
      RAISE EXCEPTION 'Portion to be Delivered is required for Australia -> Singapore programmes.';
    END IF;
    NEW.delivery_portion := LOWER(TRIM(NEW.delivery_portion));
    IF NEW.delivery_portion NOT IN ('full', 'one_third', 'two_thirds', 'nil') THEN
      RAISE EXCEPTION 'Invalid Portion to be Delivered: %.', NEW.delivery_portion;
    END IF;
  ELSE
    NEW.delivery_portion := NULL;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_aigms_order ON aigms_orders;
CREATE TRIGGER trg_validate_aigms_order
  BEFORE INSERT OR UPDATE ON aigms_orders
  FOR EACH ROW EXECUTE FUNCTION trg_fn_validate_aigms_order();

-- Animal trigger: keep animal_code / animal_ref consistent & require qurban_name_holder on order animals
CREATE OR REPLACE FUNCTION trg_fn_validate_aigms_animal()
RETURNS TRIGGER AS $$
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

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_aigms_animal ON aigms_animals;
CREATE TRIGGER trg_validate_aigms_animal
  BEFORE INSERT OR UPDATE ON aigms_animals
  FOR EACH ROW EXECUTE FUNCTION trg_fn_validate_aigms_animal();

-- ============================================================
-- 7. TRANSACTIONAL & IDEMPOTENT RPC FOR ORDER CREATION
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
  v_animal_code      TEXT;
  v_ref_num          TEXT;
  v_animal_status    TEXT;
  v_min_weight       NUMERIC;
  v_profile_id       UUID;
  i                  INTEGER;
BEGIN
  -- Security: require authenticated staff user (if profiles table has caller)
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role IS NOT NULL AND v_caller_role = 'participant' THEN
    RAISE EXCEPTION 'Permission denied: staff role required to create admin orders.';
  END IF;

  -- Idempotency: if client_request_id was already processed, return existing order
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

  -- Validate required participant fields
  IF TRIM(COALESCE(p_full_name, '')) = ''
     OR TRIM(COALESCE(p_email, '')) = ''
     OR TRIM(COALESCE(p_contact_number, '')) = '' THEN
    RAISE EXCEPTION 'Full Name, Email Address, and Contact Number are required.';
  END IF;

  -- Validate programme relationship
  SELECT * INTO v_prog FROM aigms_programmes WHERE id = p_programme_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected programme (%) does not exist.', p_programme_id;
  END IF;

  -- Validate Qurban count & entries
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'Number of Qurbans must be at least 1.';
  END IF;

  IF p_qurban_entries IS NULL
     OR jsonb_typeof(p_qurban_entries) <> 'array'
     OR jsonb_array_length(p_qurban_entries) <> p_quantity THEN
    RAISE EXCEPTION 'Number of Qurban Name Holder entries must match Number of Qurbans (%).', p_quantity;
  END IF;

  FOR i IN 0 .. (p_quantity - 1) LOOP
    v_holder := TRIM(COALESCE(p_qurban_entries->i->>'qurban_name_holder', ''));
    IF v_holder = '' THEN
      RAISE EXCEPTION 'Qurban Name Holder is required for Qurban %.', i + 1;
    END IF;
  END LOOP;

  -- Serialize reference generation within transaction to avoid race conditions
  PERFORM pg_advisory_xact_lock(914472026);
  v_year := EXTRACT(YEAR FROM NOW())::TEXT;

  -- Determine unique Order Reference
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

  -- Insert Order (trigger validates service_type, payment_method, installment, delivery_portion)
  INSERT INTO aigms_orders (
    id, order_ref, order_reference, participant, participant_id,
    contact_number, email, programme, programme_id, programme_country,
    service_type, payment_method, delivery_portion,
    quantity, number_of_qurbans, total_amount, currency,
    status, notes, client_request_id
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
    NULLIF(TRIM(COALESCE(p_delivery_portion, '')), ''),
    p_quantity,
    p_quantity,
    COALESCE(p_unit_price, v_prog.price_per_share) * p_quantity,
    COALESCE(v_prog.currency, 'SGD'),
    COALESCE(NULLIF(TRIM(p_initial_status), ''), 'pending_payment'),
    NULLIF(TRIM(COALESCE(p_notes, '')), ''),
    NULLIF(TRIM(COALESCE(p_client_request_id, '')), '')
  )
  RETURNING * INTO v_order;

  -- Create 1..N Animals linked to the same Order Reference
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
    v_holder      := TRIM(p_qurban_entries->i->>'qurban_name_holder');
    v_animal_code := 'ANM-' || v_ref_num || '-' || LPAD((i + 1)::TEXT, 2, '0');

    INSERT INTO aigms_animals (
      id, animal_ref, animal_code, animal_type, breed, gender,
      status, current_weight_kg, min_weight_kg, location, supplier,
      tag_number, order_id, order_ref, qurban_name_holder,
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
      COALESCE(NULLIF(v_prog.country, ''), 'TBD'),
      'To be assigned',
      'Pending',
      v_order.id,
      v_order.order_ref,
      v_holder,
      v_prog.name,
      v_prog.id,
      v_order.service_type,
      v_order.delivery_portion
    )
    ON CONFLICT (animal_code) WHERE animal_code IS NOT NULL DO NOTHING;
  END LOOP;

  -- Create initial Payment record when order is not draft
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
