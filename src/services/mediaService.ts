// ============================================================
// Media / Storage Service — Cloudflare R2 Server-Signed Adapter
//
// SECURITY RULES (Phase 8):
// 1. Never expose R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY in browser VITE_* variables.
// 2. Validate MIME type, file size (<= 20 MB), category, and actor authorization/ownership.
// 3. In production (VITE_ENABLE_LIVE_R2_STORAGE=true), obtain short-lived presigned PUT/GET
//    URLs from the authenticated `media-upload-url` Supabase Edge Function.
// 4. In development/unconfigured environments, explicitly tag uploads with `isSimulated: true`
//    and `storageMode: 'simulated_dev'` so simulated storage is never mistaken for live R2.
// ============================================================

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { UserRole } from '@/lib/database.types';

export interface UploadResult {
  success: boolean;
  storageKey?: string;
  publicUrl?: string;
  isSimulated: boolean;
  storageMode: 'live_r2_signed' | 'simulated_dev' | 'unconfigured';
  error?: string;
}

export type MediaCategory =
  | 'animal-photos'
  | 'animal-videos'
  | 'inspection'
  | 'delivery-evidence'
  | 'payment-proofs'
  | 'certificates'
  | 'documents';

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'application/pdf',
];

const CATEGORY_ALLOWED_TYPES: Record<MediaCategory, ReadonlyArray<string>> = {
  'animal-photos': ['image/jpeg', 'image/png', 'image/webp'],
  'animal-videos': ['video/mp4', 'video/quicktime'],
  inspection: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  'delivery-evidence': ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  'payment-proofs': ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  certificates: ['image/png', 'image/jpeg', 'application/pdf'],
  documents: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
};

const STAFF_ROLES: ReadonlyArray<UserRole> = [
  'super_admin',
  'operations_admin',
  'supplier_manager',
  'field_team',
  'driver',
  'd3_technical_admin',
];

const MAX_FILE_SIZE_MB = 20;

export function validateFile(
  file: Pick<File, 'type' | 'size' | 'name'>,
  category?: MediaCategory,
): { valid: boolean; error?: string } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: `File type "${file.type}" is not allowed.` };
  }
  if (category && !CATEGORY_ALLOWED_TYPES[category]?.includes(file.type)) {
    return {
      valid: false,
      error: `File type "${file.type}" is not permitted for category "${category}".`,
    };
  }
  if (file.size <= 0) {
    return { valid: false, error: 'File is empty (0 bytes).' };
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return { valid: false, error: `File exceeds maximum size of ${MAX_FILE_SIZE_MB}MB.` };
  }
  return { valid: true };
}

/**
 * Validate whether an actor has permission to upload or view media in a given category.
 * Participants may only upload payment-proofs for their own orders and view their own order/certificate media;
 * only authorized staff may upload animal-photos, animal-videos, inspection, delivery-evidence, or certificates.
 */
export function validateMediaAuthorization(params: {
  actorRole?: UserRole | null;
  actorParticipantId?: string | null;
  resourceOwnerParticipantId?: string | null;
  category: MediaCategory;
  action: 'upload' | 'read';
}): { authorized: true } | { authorized: false; error: string } {
  const role = params.actorRole ?? null;
  if (!role) {
    return { authorized: false, error: 'Unauthenticated user is not authorized to access media storage.' };
  }
  if (STAFF_ROLES.includes(role)) {
    return { authorized: true };
  }

  // Participant role rules
  if (params.action === 'upload') {
    if (params.category !== 'payment-proofs') {
      return {
        authorized: false,
        error: `Participants are not authorized to upload to category "${params.category}".`,
      };
    }
    if (
      params.actorParticipantId &&
      params.resourceOwnerParticipantId &&
      params.actorParticipantId !== params.resourceOwnerParticipantId
    ) {
      return {
        authorized: false,
        error: 'Participants may only upload payment proofs for their own orders.',
      };
    }
    return { authorized: true };
  }

  // Participant read access: must own the resource
  if (
    params.actorParticipantId &&
    params.resourceOwnerParticipantId &&
    params.actorParticipantId !== params.resourceOwnerParticipantId
  ) {
    return {
      authorized: false,
      error: 'Participants may not access media belonging to another participant.',
    };
  }
  return { authorized: true };
}

export function buildStorageKey(
  tenantId: string,
  category: MediaCategory,
  entityId: string,
  fileName: string,
): string {
  const safeTenant = tenantId.replace(/[^a-zA-Z0-9_-]/g, '') || 'al-ihsan';
  const safeEntity = entityId.replace(/[^a-zA-Z0-9_-]/g, '') || 'entity';
  const ext = (fileName.split('.').pop() ?? 'bin').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin';
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${safeTenant}/${category}/${safeEntity}/${ts}-${rand}.${ext}`;
}

async function simulatedDevUpload(_file: File, storageKey: string): Promise<UploadResult> {
  const mockUrl = `https://simulated-r2.local/${storageKey}`;
  return {
    success: true,
    storageKey,
    publicUrl: mockUrl,
    isSimulated: true,
    storageMode: 'simulated_dev',
  };
}

async function productionSignedUpload(
  file: File,
  storageKey: string,
  category: MediaCategory,
): Promise<UploadResult> {
  if (!isSupabaseConfigured) {
    return {
      success: false,
      isSimulated: false,
      storageMode: 'unconfigured',
      error: 'Production R2 upload requires Supabase Edge Function (`media-upload-url`) and R2 secrets.',
    };
  }

  const { data, error } = await supabase.functions.invoke('media-upload-url', {
    body: {
      storageKey,
      category,
      contentType: file.type,
      fileSize: file.size,
    },
  });

  if (error || !data?.presignedPutUrl) {
    return {
      success: false,
      isSimulated: false,
      storageMode: 'unconfigured',
      error: error?.message || data?.error || 'Could not obtain signed R2 upload URL from server.',
    };
  }

  const putRes = await fetch(data.presignedPutUrl as string, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!putRes.ok) {
    return {
      success: false,
      isSimulated: false,
      storageMode: 'live_r2_signed',
      error: `Cloudflare R2 PUT failed with HTTP ${putRes.status}.`,
    };
  }

  return {
    success: true,
    storageKey,
    publicUrl: (data.publicUrl as string) || getMediaUrl(storageKey) || undefined,
    isSimulated: false,
    storageMode: 'live_r2_signed',
  };
}

export async function uploadMedia(
  file: File,
  category: MediaCategory,
  tenantId: string,
  entityId: string,
): Promise<UploadResult> {
  const validation = validateFile(file, category);
  if (!validation.valid) {
    return {
      success: false,
      isSimulated: false,
      storageMode: 'unconfigured',
      error: validation.error,
    };
  }

  const storageKey = buildStorageKey(tenantId, category, entityId, file.name);
  const liveR2Enabled =
    String(import.meta.env.VITE_ENABLE_LIVE_R2_STORAGE ?? '').toLowerCase() === 'true';

  if (!liveR2Enabled) {
    const env = import.meta.env.VITE_APP_ENV ?? 'development';
    if (env === 'development' || env === 'test') {
      return simulatedDevUpload(file, storageKey);
    }
    return {
      success: false,
      isSimulated: false,
      storageMode: 'unconfigured',
      error: 'Cloudflare R2 storage is not yet configured in production (VITE_ENABLE_LIVE_R2_STORAGE is false).',
    };
  }

  return productionSignedUpload(file, storageKey, category);
}

export function getMediaUrl(storageKey: string | null | undefined): string | null {
  if (!storageKey) return null;
  const baseUrl = (import.meta.env.VITE_R2_PUBLIC_URL as string | undefined)?.replace(/\/$/, '') || 'https://simulated-r2.local';
  return `${baseUrl}/${storageKey}`;
}
