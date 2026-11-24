import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const ACTIVE_SUPABASE_URL = 'https://qovgglghmiiziinhewtn.supabase.co';
const ACTIVE_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvdmdnbGdobWlpemlpbmhld3RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU1MDc0NTgsImV4cCI6MjExMTA4MzQ1OH0.fQMg7uVOeLFPKc6eO9sQzWELmWzRpi-TjbZb8pQzunA';

const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Ignore stale/legacy Supabase project references that fail with invalid API keys
const isStaleProject = Boolean(envUrl && (envUrl.includes('zczczaychidfqxvwfcca') || envUrl.includes('placeholder')));

const supabaseUrl = (!isStaleProject && envUrl) || ACTIVE_SUPABASE_URL;
const supabaseAnonKey = (!isStaleProject && envKey) || ACTIVE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('placeholder')
);

if (!isSupabaseConfigured) {
  console.error(
    'Missing Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).'
  );
}

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'aigms-auth',
  },
  global: {
    headers: {
      'x-application-name': 'aigms',
    },
  },
});
