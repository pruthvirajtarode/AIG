/**
 * supabaseSync.ts
 *
 * Bridges AppDataContext (localStorage-based) with Supabase.
 *
 * Strategy:
 *  - On load: fetch all rows from Supabase and return as AppData.
 *  - On commit: upsert changed records to Supabase in the background.
 *  - localStorage remains the fast local cache & offline fallback.
 *
 * Table mapping (flat Supabase tables → AppData types):
 *   aigms_orders        → AppOrder
 *   aigms_animals       → AppAnimal
 *   aigms_payments      → AppPayment
 *   aigms_deliveries    → AppDelivery
 *   aigms_certificates  → AppCertificate
 *   aigms_participants  → AppParticipant
 *   aigms_suppliers     → AppSupplier
 *   aigms_programmes    → AppProgramme
 *   aigms_exceptions    → AppException
 *   aigms_audit_logs    → AppAuditLog
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type {
  AppOrder, AppAnimal, AppPayment, AppDelivery, AppCertificate,
  AppParticipant, AppSupplier, AppProgramme, AppException, AppAuditLog,
} from '@/contexts/AppDataContext';

// ─── Table names ────────────────────────────────────────────────────────────

const T = {
  orders:       'aigms_orders',
  animals:      'aigms_animals',
  payments:     'aigms_payments',
  deliveries:   'aigms_deliveries',
  certificates: 'aigms_certificates',
  participants: 'aigms_participants',
  suppliers:    'aigms_suppliers',
  programmes:   'aigms_programmes',
  exceptions:   'aigms_exceptions',
  auditLogs:    'aigms_audit_logs',
} as const;

// ─── Load all data from Supabase ─────────────────────────────────────────────

export type SupabaseAppData = {
  orders: AppOrder[];
  animals: AppAnimal[];
  payments: AppPayment[];
  deliveries: AppDelivery[];
  certificates: AppCertificate[];
  participants: AppParticipant[];
  suppliers: AppSupplier[];
  programmes: AppProgramme[];
  exceptions: AppException[];
  auditLogs: AppAuditLog[];
};

async function fetchTable<T>(tableName: string): Promise<T[]> {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.warn(`[supabaseSync] Failed to fetch ${tableName}:`, error.message);
      return [];
    }
    return (data ?? []) as T[];
  } catch (e) {
    console.warn(`[supabaseSync] Error fetching ${tableName}:`, e);
    return [];
  }
}

export async function loadFromSupabase(): Promise<SupabaseAppData | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const [
      orders, animals, payments, deliveries, certificates,
      participants, suppliers, programmes, exceptions, auditLogs,
    ] = await Promise.all([
      fetchTable<AppOrder>(T.orders),
      fetchTable<AppAnimal>(T.animals),
      fetchTable<AppPayment>(T.payments),
      fetchTable<AppDelivery>(T.deliveries),
      fetchTable<AppCertificate>(T.certificates),
      fetchTable<AppParticipant>(T.participants),
      fetchTable<AppSupplier>(T.suppliers),
      fetchTable<AppProgramme>(T.programmes),
      fetchTable<AppException>(T.exceptions),
      fetchTable<AppAuditLog>(T.auditLogs),
    ]);

    return { orders, animals, payments, deliveries, certificates, participants, suppliers, programmes, exceptions, auditLogs };
  } catch (e) {
    console.error('[supabaseSync] loadFromSupabase failed:', e);
    return null;
  }
}

// ─── Upsert helpers ──────────────────────────────────────────────────────────

/**
 * PostgREST requires every object in a bulk upsert array to have identical keys.
 * Normalize `undefined` properties to `null` across all keys in the batch.
 */
function normaliseBatchRows(rows: unknown[]): Record<string, unknown>[] {
  const keySet = new Set<string>();
  for (const r of rows) {
    if (r && typeof r === 'object') {
      for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
        if (v !== undefined) keySet.add(k);
      }
    }
  }
  const keys = Array.from(keySet);
  return rows.map(r => {
    const obj = (r ?? {}) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      out[k] = obj[k] === undefined ? null : obj[k];
    }
    return out;
  });
}

async function upsert(tableName: string, rows: unknown[]): Promise<void> {
  if (!isSupabaseConfigured || rows.length === 0) return;
  try {
    const payload = normaliseBatchRows(rows);
    const { error } = await supabase.from(tableName).upsert(payload as never[], { onConflict: 'id' });
    if (error) console.warn(`[supabaseSync] upsert ${tableName} error:`, error.message);
  } catch (e) {
    console.warn(`[supabaseSync] upsert ${tableName} exception:`, e);
  }
}

// ─── Diff helpers ────────────────────────────────────────────────────────────

type WithId = { id: string };

function findNew<T extends WithId>(next: T[], prev: T[]): T[] {
  const prevIds = new Set(prev.map(x => x.id));
  return next.filter(x => !prevIds.has(x.id));
}

function findChanged<T extends WithId>(next: T[], prev: T[]): T[] {
  const prevMap = new Map(prev.map(x => [x.id, x]));
  return next.filter(x => {
    const p = prevMap.get(x.id);
    if (!p) return false;
    return JSON.stringify(x) !== JSON.stringify(p);
  });
}

function findDeleted<T extends WithId>(next: T[], prev: T[]): string[] {
  const nextIds = new Set(next.map(x => x.id));
  return prev.filter(x => !nextIds.has(x.id)).map(x => x.id);
}

async function deleteRows(tableName: string, ids: string[]): Promise<void> {
  if (!isSupabaseConfigured || ids.length === 0) return;
  try {
    const { error } = await supabase.from(tableName).delete().in('id', ids);
    if (error) console.warn(`[supabaseSync] delete ${tableName} error:`, error.message);
  } catch (e) {
    console.warn(`[supabaseSync] delete ${tableName} exception:`, e);
  }
}

// ─── Sync diff between prev and next AppData ──────────────────────────────────

const TIER_1_PARENTS: [string, keyof SupabaseAppData][] = [
  [T.programmes,   'programmes'],
  [T.suppliers,    'suppliers'],
  [T.participants, 'participants'],
];

const TIER_2_ORDERS: [string, keyof SupabaseAppData][] = [
  [T.orders, 'orders'],
];

const TIER_3_CHILDREN: [string, keyof SupabaseAppData][] = [
  [T.animals,      'animals'],
  [T.payments,     'payments'],
  [T.deliveries,   'deliveries'],
  [T.certificates, 'certificates'],
  [T.exceptions,   'exceptions'],
  [T.auditLogs,    'auditLogs'],
];

export async function syncToSupabase(
  prev: SupabaseAppData,
  next: SupabaseAppData,
): Promise<void> {
  if (!isSupabaseConfigured) return;

  const upsertTier = (tier: [string, keyof SupabaseAppData][]) =>
    Promise.all(tier.map(async ([tableName, key]) => {
      const prevArr = prev[key] as WithId[];
      const nextArr = next[key] as WithId[];
      const toUpsert = [...findNew(nextArr, prevArr), ...findChanged(nextArr, prevArr)];
      await upsert(tableName, toUpsert);
    }));

  const deleteTier = (tier: [string, keyof SupabaseAppData][]) =>
    Promise.all(tier.map(async ([tableName, key]) => {
      const prevArr = prev[key] as WithId[];
      const nextArr = next[key] as WithId[];
      const deletedIds = findDeleted(nextArr, prevArr);
      await deleteRows(tableName, deletedIds);
    }));

  // Upsert parents -> orders -> children so foreign keys are always satisfied
  await upsertTier(TIER_1_PARENTS);
  await upsertTier(TIER_2_ORDERS);
  await upsertTier(TIER_3_CHILDREN);

  // Delete children -> orders -> parents in reverse dependency order
  await deleteTier(TIER_3_CHILDREN);
  await deleteTier(TIER_2_ORDERS);
  await deleteTier(TIER_1_PARENTS);
}

// ─── Full upsert (initial push of all local data to Supabase) ────────────────

export async function pushAllToSupabase(data: SupabaseAppData): Promise<void> {
  if (!isSupabaseConfigured) return;

  await Promise.all([
    upsert(T.programmes,   data.programmes),
    upsert(T.suppliers,    data.suppliers),
    upsert(T.participants, data.participants),
  ]);
  await upsert(T.orders, data.orders);
  await Promise.all([
    upsert(T.animals,      data.animals),
    upsert(T.payments,     data.payments),
    upsert(T.deliveries,   data.deliveries),
    upsert(T.certificates, data.certificates),
    upsert(T.exceptions,   data.exceptions),
    upsert(T.auditLogs,    data.auditLogs),
  ]);
}
