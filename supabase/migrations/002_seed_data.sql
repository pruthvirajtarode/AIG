-- ============================================================
-- AIGMS — Seed Data (DEVELOPMENT ONLY — never run in production)
-- Migration: 002_seed_data.sql
-- ============================================================

-- !! WARNING: This file contains fake development data only.
-- !! Do NOT run in production.

-- Insert D3 Agency
INSERT INTO agencies (id, name, slug, email, website) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Daredevil Digital', 'd3', 'hello@daredevildigital.com', 'https://daredevildigital.com');

-- Insert Al Ihsan Group tenant
INSERT INTO tenants (id, agency_id, name, slug, email, website, timezone, currency) VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
   'Al Ihsan Group', 'aig', 'info@alhisangroup.com', 'https://alhisangroup.com',
   'Asia/Singapore', 'SGD');

-- NOTE: Profiles are auto-created via auth trigger.
-- Seed users must be created via Supabase Auth API or dashboard.
-- After creating auth users, update profiles manually with tenant_id, role.

-- Insert 7 Qurban Programmes
INSERT INTO programmes (id, tenant_id, name, slug, description, country, animal_type, animals_per_share, price_per_share, currency, distribution_method, delivery_required, certificate_required, status_flow, sort_order, is_active) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010',
   'Qurban Indonesia — Sapi', 'qurban-indonesia-sapi',
   'Qurban cow programme in Indonesia with local distribution.',
   'Indonesia', 'cow', 1, 550.00, 'SGD', 'local_distribution', FALSE, TRUE,
   ARRAY['pending_payment','payment_submitted','payment_verified','confirmed','animal_allocated','animal_growing','final_inspection','qurban_complete','certificate_generated','completed'],
   1, TRUE),

  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010',
   'Qurban Indonesia — Kambing', 'qurban-indonesia-kambing',
   'Qurban goat programme in Indonesia with local distribution.',
   'Indonesia', 'goat', 1, 250.00, 'SGD', 'local_distribution', FALSE, TRUE,
   ARRAY['pending_payment','payment_submitted','payment_verified','confirmed','animal_allocated','animal_growing','final_inspection','qurban_complete','certificate_generated','completed'],
   2, TRUE),

  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000010',
   'Qurban Australia — Lamb (Singapore Delivery)', 'qurban-australia-lamb-sg',
   'Qurban lamb programme in Australia with air freight delivery to Singapore.',
   'Australia', 'sheep', 1, 380.00, 'SGD', 'air_freight', TRUE, TRUE,
   ARRAY['pending_payment','payment_submitted','payment_verified','confirmed','qurban_complete','processing','shipped','arrived','delivery_scheduled','out_for_delivery','delivered','certificate_generated','completed'],
   3, TRUE),

  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000010',
   'Qurban Palestine', 'qurban-palestine',
   'Qurban programme supporting communities in Palestine.',
   'Palestine', 'sheep', 1, 180.00, 'SGD', 'local_distribution', FALSE, TRUE,
   ARRAY['pending_payment','payment_submitted','payment_verified','confirmed','qurban_complete','certificate_generated','completed'],
   4, TRUE),

  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000010',
   'Qurban Bangladesh', 'qurban-bangladesh',
   'Qurban programme supporting communities in Bangladesh.',
   'Bangladesh', 'cow', 1, 400.00, 'SGD', 'local_distribution', FALSE, TRUE,
   ARRAY['pending_payment','payment_submitted','payment_verified','confirmed','qurban_complete','certificate_generated','completed'],
   5, TRUE),

  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000010',
   'Qurban Yemen', 'qurban-yemen',
   'Qurban programme supporting communities in Yemen.',
   'Yemen', 'goat', 1, 200.00, 'SGD', 'local_distribution', FALSE, TRUE,
   ARRAY['pending_payment','payment_submitted','payment_verified','confirmed','qurban_complete','certificate_generated','completed'],
   6, TRUE),

  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000010',
   'Qurban Somalia', 'qurban-somalia',
   'Qurban programme supporting communities in Somalia.',
   'Somalia', 'goat', 1, 190.00, 'SGD', 'local_distribution', FALSE, TRUE,
   ARRAY['pending_payment','payment_submitted','payment_verified','confirmed','qurban_complete','certificate_generated','completed'],
   7, TRUE);

-- Seed Suppliers
INSERT INTO suppliers (id, tenant_id, supplier_ref, name, contact_name, country, region, animal_types, is_active) VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010',
   'SUP-ID-001', 'PT Maju Ternak Indonesia', 'Bapak Ahmad', 'Indonesia', 'Jawa Tengah',
   ARRAY['cow','goat']::animal_type[], TRUE),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010',
   'SUP-AU-001', 'Green Pastures Farm Australia', 'John Smith', 'Australia', 'Victoria',
   ARRAY['sheep']::animal_type[], TRUE);

-- System Settings for AIG
INSERT INTO system_settings (tenant_id, key, value, description, is_public) VALUES
  ('00000000-0000-0000-0000-000000000010', 'order_ref_format', '"AIG-{YEAR}-{SEQ6}"', 'Order reference number format', FALSE),
  ('00000000-0000-0000-0000-000000000010', 'certificate_issuer', '"Al Ihsan Group"', 'Certificate issuing organisation name', TRUE),
  ('00000000-0000-0000-0000-000000000010', 'payment_hold_days', '7', 'Days before payment is considered overdue', FALSE),
  ('00000000-0000-0000-0000-000000000010', 'max_file_size_mb', '20', 'Maximum upload file size in megabytes', FALSE),
  ('00000000-0000-0000-0000-000000000010', 'allowed_file_types', '["image/jpeg","image/png","image/webp","video/mp4","application/pdf"]', 'Allowed media upload types', FALSE);

-- Notification Templates (basic)
INSERT INTO notification_templates (tenant_id, trigger_event, channel, name, subject, body, variables, is_active) VALUES
  ('00000000-0000-0000-0000-000000000010', 'order.created', 'email', 'Order Confirmation Email',
   'Your Qurban Order {{order_ref}} is Confirmed',
   'Assalamualaikum {{participant_name}},\n\nThank you for your Qurban registration with Al Ihsan Group.\n\nOrder Reference: {{order_ref}}\nProgramme: {{programme_name}}\nAmount: {{currency}} {{amount}}\n\nPlease proceed with payment to confirm your Qurban.\n\nJazakallahu Khairan.',
   ARRAY['participant_name','order_ref','programme_name','currency','amount'], TRUE),

  ('00000000-0000-0000-0000-000000000010', 'payment.verified', 'email', 'Payment Verified Email',
   'Payment Verified — Your Qurban is Confirmed',
   'Assalamualaikum {{participant_name}},\n\nAlhamdulillah! Your payment for Order {{order_ref}} has been verified.\n\nYour Qurban has been officially confirmed. We will keep you updated on the progress.\n\nJazakallahu Khairan.',
   ARRAY['participant_name','order_ref','programme_name'], TRUE),

  ('00000000-0000-0000-0000-000000000010', 'certificate.ready', 'email', 'Certificate Ready Email',
   'Your Qurban Certificate is Ready',
   'Assalamualaikum {{participant_name}},\n\nYour Qurban certificate for Order {{order_ref}} is now available.\n\nPlease login to your portal to download your certificate.\n\nJazakallahu Khairan.',
   ARRAY['participant_name','order_ref','certificate_url'], TRUE);
