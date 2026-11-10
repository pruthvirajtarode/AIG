import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT_DIR = path.resolve(__dirname, '../..');

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
}

describe('Phase 7 & 10 — Supabase RLS Security, Triggers, Schema Consistency & Secret Isolation', () => {
  it('has clean sequential SQL migrations 001..008 with no duplicate prefixes', () => {
    const migrationsDir = path.join(ROOT_DIR, 'supabase/migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    expect(files.length).toBeGreaterThanOrEqual(8);

    const prefixes = files.map(f => f.slice(0, 3));
    expect(new Set(prefixes).size).toBe(prefixes.length);
    expect(files.some(f => f.startsWith('008_'))).toBe(true);
  });

  it('migration 008 drops permissive authenticated_all_* policies and replaces with strict staff + owner RLS', () => {
    const m008 = readFile('supabase/migrations/008_security_rls_whatsapp_and_conflicts.sql');

    // Drops permissive policies from 005_flat_aigms_tables.sql across all aigms_* tables
    const droppedPolicies = [
      'DROP POLICY IF EXISTS "authenticated_all_programmes"   ON aigms_programmes;',
      'DROP POLICY IF EXISTS "authenticated_all_suppliers"    ON aigms_suppliers;',
      'DROP POLICY IF EXISTS "authenticated_all_participants" ON aigms_participants;',
      'DROP POLICY IF EXISTS "authenticated_all_orders"       ON aigms_orders;',
      'DROP POLICY IF EXISTS "authenticated_all_animals"      ON aigms_animals;',
      'DROP POLICY IF EXISTS "authenticated_all_payments"     ON aigms_payments;',
      'DROP POLICY IF EXISTS "authenticated_all_deliveries"   ON aigms_deliveries;',
      'DROP POLICY IF EXISTS "authenticated_all_certificates" ON aigms_certificates;',
      'DROP POLICY IF EXISTS "authenticated_all_exceptions"   ON aigms_exceptions;',
      'DROP POLICY IF EXISTS "authenticated_all_audit_logs"   ON aigms_audit_logs;',
    ];
    for (const stmt of droppedPolicies) {
      expect(m008).toContain(stmt);
    }

    // Strict participant isolation & breeding-only weight history RLS
    expect(m008).toContain('CREATE POLICY "aigms_orders_participant_select"');
    expect(m008).toContain('CREATE POLICY "aigms_animals_participant_select"');
    expect(m008).toContain('CREATE POLICY "aigms_certificates_participant_select"');
    expect(m008).toContain('CREATE POLICY "animal_weights_breeding_participant_read"');
    expect(m008).toContain('prog.supports_weight_timeline = TRUE');

    // Breeding-only trigger enforcement & non-breeding weight history stripping
    expect(m008).toContain("NEW.weight_history := '[]'::jsonb;");
    expect(m008).toContain('trg_fn_validate_aigms_animal()');
  });

  it('migration 008 fixes confirmation_email_sent_at initialization and adds honest status + notifications log table', () => {
    const m008 = readFile('supabase/migrations/008_security_rls_whatsapp_and_conflicts.sql');

    expect(m008).toContain('confirmation_email_status');
    expect(m008).toContain('legacy_unverified_timestamp');
    expect(m008).toContain('CREATE OR REPLACE FUNCTION record_order_invoice_email_sent(');
    expect(m008).toContain('CREATE TABLE IF NOT EXISTS aigms_notifications');
    expect(m008).toContain('CREATE OR REPLACE FUNCTION create_aigms_order(');
    expect(m008).toContain('Participant identity conflict for review');
    expect(m008).toContain('Forbidden: participants may only create orders under their own registered email.');
  });

  it('contains zero server-side secret tokens inside frontend src/ or VITE_* client environment variables', () => {
    const envExample = readFile('.env.example');
    expect(envExample).not.toContain('VITE_WHATSAPP_ACCESS_TOKEN');
    expect(envExample).not.toContain('VITE_META_APP_SECRET');
    expect(envExample).not.toContain('VITE_SUPABASE_SERVICE_ROLE_KEY');
    expect(envExample).not.toContain('VITE_R2_SECRET_ACCESS_KEY');

    const srcDir = path.join(ROOT_DIR, 'src');
    const scanDir = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(full);
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          const content = fs.readFileSync(full, 'utf8');
          expect(content, `${entry.name} leaked VITE_WHATSAPP_ACCESS_TOKEN`).not.toContain('VITE_WHATSAPP_ACCESS_TOKEN');
          expect(content, `${entry.name} leaked VITE_META_APP_SECRET`).not.toContain('VITE_META_APP_SECRET');
          expect(content, `${entry.name} leaked VITE_SUPABASE_SERVICE_ROLE_KEY`).not.toContain('VITE_SUPABASE_SERVICE_ROLE_KEY');
          expect(content, `${entry.name} leaked VITE_R2_SECRET_ACCESS_KEY`).not.toContain('VITE_R2_SECRET_ACCESS_KEY');
          expect(content, `${entry.name} referenced process.env secret`).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
          expect(content, `${entry.name} referenced WHATSAPP_ACCESS_TOKEN`).not.toContain('WHATSAPP_ACCESS_TOKEN');
        }
      }
    };
    scanDir(srcDir);
  });
});
