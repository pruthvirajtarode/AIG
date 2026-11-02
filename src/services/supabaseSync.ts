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

async function upsert(tableName: string, rows: unknown[]): Promise<void> {
  if (!isSupabaseConfigured || rows.length === 0) return;
  try {
    const { error } = await supabase.from(tableName).upsert(rows as never[], { onConflict: 'id' });
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

export async function syncToSupabase(
  prev: SupabaseAppData,
  next: SupabaseAppData,
): Promise<void> {
  if (!isSupabaseConfigured) return;

  const tables: [string, keyof SupabaseAppData][] = [
    [T.orders,       'orders'],
    [T.animals,      'animals'],
    [T.payments,     'payments'],
    [T.deliveries,   'deliveries'],
    [T.certificates, 'certificates'],
    [T.participants, 'participants'],
    [T.suppliers,    'suppliers'],
    [T.programmes,   'programmes'],
    [T.exceptions,   'exceptions'],
    [T.auditLogs,    'auditLogs'],
  ];

  await Promise.all(tables.map(async ([tableName, key]) => {
    const prevArr = prev[key] as WithId[];
    const nextArr = next[key] as WithId[];

    const newRows     = findNew(nextArr, prevArr);
    const changedRows = findChanged(nextArr, prevArr);
    const deletedIds  = findDeleted(nextArr, prevArr);

    const toUpsert = [...newRows, ...changedRows];
    await upsert(tableName, toUpsert);
    await deleteRows(tableName, deletedIds);
  }));
}

// ─── Full upsert (initial push of all local data to Supabase) ────────────────

export async function pushAllToSupabase(data: SupabaseAppData): Promise<void> {
  if (!isSupabaseConfigured) return;

  await Promise.all([
    upsert(T.orders,       data.orders),
    upsert(T.animals,      data.animals),
    upsert(T.payments,     data.payments),
    upsert(T.deliveries,   data.deliveries),
    upsert(T.certificates, data.certificates),
    upsert(T.participants, data.participants),
    upsert(T.suppliers,    data.suppliers),
    upsert(T.programmes,   data.programmes),
    upsert(T.exceptions,   data.exceptions),
    upsert(T.auditLogs,    data.auditLogs),
  ]);
}
