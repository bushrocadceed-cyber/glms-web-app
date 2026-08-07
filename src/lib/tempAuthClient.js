import { createClient } from '@supabase/supabase-js';

// A second, throwaway-purposed Supabase client used only for registerAdmin's
// signUp() call — auth.signUp() always signs in as the account it creates
// on whatever client calls it, so this keeps the acting admin's own session
// on the main `supabase` client untouched. persistSession/autoRefreshToken
// are both off since this client's session is never meant to be used.
//
// Lazily created ONCE and reused for every registerAdmin() call, rather
// than a fresh createClient() per attempt — Supabase logs "Multiple
// GoTrueClient instances detected" once per distinct client created in the
// same tab, so calling createClient() on every submission logged it
// repeatedly. There are still two real clients alive at once (this one and
// the main one) — that part of the warning is an accepted, unavoidable
// trade-off of not hijacking the admin's session — but now it's exactly
// one extra instance for the lifetime of the tab, not one per attempt.
let tempAuthClient = null;

export function getTempAuthClient() {
  if (!tempAuthClient) {
    tempAuthClient = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return tempAuthClient;
}
