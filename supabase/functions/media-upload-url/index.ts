// ============================================================
// Supabase Edge Function: media-upload-url
// Generates short-lived presigned Cloudflare R2 upload URLs
// after verifying caller JWT, role authorization, MIME type,
// and file size (<= 20 MB).
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { S3Client, PutObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3.650.0';
import { getSignedUrl } from 'https://esm.sh/@aws-sdk/s3-request-presigner@3.650.0';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'application/pdf',
]);

const MAX_BYTES = 20 * 1024 * 1024;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authHeader = req.headers.get('Authorization');

  if (!authHeader || !supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !authData?.user) {
    return new Response(JSON.stringify({ error: 'Invalid authentication token' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);
  const { data: profileRow } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle();

  const body = await req.json().catch(() => ({}));
  const storageKey = String(body.storageKey ?? '').trim();
  const category = String(body.category ?? '').trim();
  const contentType = String(body.contentType ?? '').trim();
  const fileSize = Number(body.fileSize ?? 0);

  if (!storageKey || !ALLOWED_TYPES.has(contentType) || fileSize <= 0 || fileSize > MAX_BYTES) {
    return new Response(JSON.stringify({ error: 'Invalid storageKey, contentType, or fileSize' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const staffRoles = ['super_admin', 'operations_admin', 'supplier_manager', 'field_team', 'driver', 'd3_technical_admin'];
  const isStaff = Boolean(profileRow && staffRoles.includes(profileRow.role));
  if (!isStaff && category !== 'payment-proofs') {
    return new Response(JSON.stringify({ error: 'Forbidden: participants may only upload payment proofs' }), {
      status: 403,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const accountId = Deno.env.get('R2_ACCOUNT_ID');
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
  const bucketName = Deno.env.get('R2_BUCKET_NAME') || 'aigms-media';
  const publicBaseUrl = (Deno.env.get('R2_PUBLIC_URL') || '').replace(/\/$/, '');

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return new Response(
      JSON.stringify({
        error: 'Cloudflare R2 server secrets (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) are not configured.',
      }),
      { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: storageKey,
    ContentType: contentType,
    ContentLength: fileSize,
  });

  const presignedPutUrl = await getSignedUrl(s3, command, { expiresIn: 600 });
  return new Response(
    JSON.stringify({
      presignedPutUrl,
      storageKey,
      publicUrl: publicBaseUrl ? `${publicBaseUrl}/${storageKey}` : null,
    }),
    { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
  );
});
