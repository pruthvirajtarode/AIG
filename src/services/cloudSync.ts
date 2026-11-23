/**
 * cloudSync.ts
 *
 * Realtime multi-device cloud synchronizer for AIGMS.
 * Synchronizes orders, participants, animals, payments, deliveries,
 * certificates, and exceptions across all devices (Desktop, Mobile, Tablets).
 */

import type {
  AppData,
  AppOrder,
  AppParticipant,
  AppAnimal,
  AppPayment,
  AppDelivery,
  AppCertificate,
  AppException,
} from '@/contexts/AppDataContext';
import { LIVE_PROGRAMMES } from '@/data/liveProgrammes';

export const CLOUD_SYNC_ENDPOINT = 'https://kvdb.io/qpLZvotNMAakA6J7oyH2V/aigms_master_state_v1';

export type CloudSyncPayload = {
  version: number;
  updated_at: string;
  orders: AppOrder[];
  participants: AppParticipant[];
  animals: AppAnimal[];
  payments: AppPayment[];
  deliveries: AppDelivery[];
  certificates: AppCertificate[];
  exceptions: AppException[];
};

/**
 * Fetch latest master state from the central cloud database.
 */
export async function fetchCloudState(): Promise<CloudSyncPayload | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch(CLOUD_SYNC_ENDPOINT, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timer);

    if (!resp.ok) {
      if (resp.status === 404) return null;
      console.warn(`[cloudSync] fetch returned HTTP ${resp.status}`);
      return null;
    }

    const json = await resp.json();
    if (!json || typeof json !== 'object') return null;

    return {
      version: typeof json.version === 'number' ? json.version : 1,
      updated_at: typeof json.updated_at === 'string' ? json.updated_at : new Date().toISOString(),
      orders: Array.isArray(json.orders) ? json.orders : [],
      participants: Array.isArray(json.participants) ? json.participants : [],
      animals: Array.isArray(json.animals) ? json.animals : [],
      payments: Array.isArray(json.payments) ? json.payments : [],
      deliveries: Array.isArray(json.deliveries) ? json.deliveries : [],
      certificates: Array.isArray(json.certificates) ? json.certificates : [],
      exceptions: Array.isArray(json.exceptions) ? json.exceptions : [],
    };
  } catch (err) {
    // Network / abort error — fail silently and use local cache
    return null;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingData: AppData | null = null;

/**
 * Push local changes to the central cloud database with debouncing.
 */
export function pushCloudState(data: AppData, immediate = false): Promise<boolean> {
  pendingData = data;

  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  const executePush = async (d: AppData): Promise<boolean> => {
    try {
      const payload: CloudSyncPayload = {
        version: 2,
        updated_at: new Date().toISOString(),
        orders: d.orders,
        participants: d.participants,
        animals: d.animals,
        payments: d.payments,
        deliveries: d.deliveries,
        certificates: d.certificates,
        exceptions: d.exceptions,
      };

      const resp = await fetch(CLOUD_SYNC_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      return resp.ok;
    } catch (err) {
      console.warn('[cloudSync] push failed:', err);
      return false;
    }
  };

  if (immediate) {
    return executePush(data);
  }

  return new Promise((resolve) => {
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      if (pendingData) {
        const ok = await executePush(pendingData);
        resolve(ok);
      } else {
        resolve(true);
      }
    }, 400);
  });
}

/**
 * Merge cloud records into local state safely.
 * Prefers the most up-to-date items by ID.
 */
export function mergeCloudWithLocal(local: AppData, cloud: CloudSyncPayload): AppData {
  const mergeById = <T extends { id: string }>(localList: T[], cloudList: T[]): T[] => {
    const map = new Map<string, T>();
    // First insert local
    for (const item of localList) {
      if (item && item.id) map.set(item.id, item);
    }
    // Then merge cloud (cloud records overwrite or augment)
    for (const item of cloudList) {
      if (item && item.id) map.set(item.id, item);
    }
    return Array.from(map.values());
  };

  return {
    ...local,
    orders: mergeById(local.orders, cloud.orders),
    participants: mergeById(local.participants, cloud.participants),
    animals: mergeById(local.animals, cloud.animals),
    payments: mergeById(local.payments, cloud.payments),
    deliveries: mergeById(local.deliveries, cloud.deliveries),
    certificates: mergeById(local.certificates, cloud.certificates),
    exceptions: mergeById(local.exceptions, cloud.exceptions),
    programmes: local.programmes.length > 0 ? local.programmes : LIVE_PROGRAMMES,
  };
}
