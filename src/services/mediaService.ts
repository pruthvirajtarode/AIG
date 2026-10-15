// ============================================================
// Media / Storage Service — Cloudflare R2 adapter
// In production this should use signed URLs from a server-side
// edge function or Supabase function. Never expose R2 credentials
// to the browser directly.
// ============================================================

export interface UploadResult {
  success: boolean;
  storageKey?: string;
  publicUrl?: string;
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

const MAX_FILE_SIZE_MB = 20;

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: `File type "${file.type}" is not allowed.` };
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return { valid: false, error: `File exceeds maximum size of ${MAX_FILE_SIZE_MB}MB.` };
  }
  return { valid: true };
}

export function buildStorageKey(
  tenantId: string,
  category: MediaCategory,
  entityId: string,
  fileName: string
): string {
  const ext = fileName.split('.').pop() ?? 'bin';
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${tenantId}/${category}/${entityId}/${ts}-${rand}.${ext}`;
}

// ── Mock Upload (development) ─────────────────────────────────
async function mockUpload(file: File, storageKey: string): Promise<UploadResult> {
  // Simulate upload delay
  await new Promise(r => setTimeout(r, 500));
  const mockUrl = `https://mock-r2.dev/${storageKey}`;
  console.log('[MockStorage] Uploaded:', { key: storageKey, size: file.size, type: file.type });
  return { success: true, storageKey, publicUrl: mockUrl };
}

// ── Production Upload (via signed URL from server-side function) ─
// In production, call your Supabase edge function to get a presigned PUT URL,
// then PUT the file directly to R2. Return the storage key + CDN URL.
async function productionUpload(_file: File, _storageKey: string): Promise<UploadResult> {
  // TODO: implement via Supabase edge function
  // const { data } = await supabase.functions.invoke('get-upload-url', {
  //   body: { key: storageKey, contentType: file.type },
  // });
  // await fetch(data.presignedUrl, { method: 'PUT', body: file });
  // return { success: true, storageKey, publicUrl: data.publicUrl };
  return { success: false, error: 'Production upload not yet configured' };
}

export async function uploadMedia(
  file: File,
  category: MediaCategory,
  tenantId: string,
  entityId: string
): Promise<UploadResult> {
  const validation = validateFile(file);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const storageKey = buildStorageKey(tenantId, category, entityId, file.name);
  const env = import.meta.env.VITE_APP_ENV ?? 'development';

  if (env === 'development') {
    return mockUpload(file, storageKey);
  }
  return productionUpload(file, storageKey);
}

export function getMediaUrl(storageKey: string | null | undefined): string | null {
  if (!storageKey) return null;
  const baseUrl = import.meta.env.VITE_R2_PUBLIC_URL ?? 'https://mock-r2.dev';
  return `${baseUrl}/${storageKey}`;
}
