import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file, then restart the dev server.'
  );
}

// Fail loudly if a secret/service_role key ever ends up here — that key bypasses
// Row Level Security entirely and must never reach frontend code.
if (supabaseAnonKey.startsWith('sb_secret_')) {
  throw new Error(
    'SECURITY: VITE_SUPABASE_ANON_KEY is a Supabase SECRET key. Never expose a secret/service_role key to the frontend. Use the "anon" / "publishable" key from Project Settings → API instead.'
  );
}

if (supabaseAnonKey.startsWith('eyJ')) {
  const payload = JSON.parse(atob(supabaseAnonKey.split('.')[1]));
  if (payload.role === 'service_role') {
    throw new Error(
      'SECURITY: VITE_SUPABASE_ANON_KEY is a service_role JWT. Never expose a service_role key to the frontend. Use the "anon" / "public" key from Project Settings → API instead.'
    );
  }
} else if (!supabaseAnonKey.startsWith('sb_publishable_')) {
  throw new Error(
    'VITE_SUPABASE_ANON_KEY does not look like a valid Supabase key (expected a JWT starting with "eyJ" or a key starting with "sb_publishable_"). Copy the anon/public key from Project Settings → API, then restart the dev server.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
