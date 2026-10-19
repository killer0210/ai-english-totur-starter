import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnv, getServerEnv } from "@/lib/env";

/**
 * Write client (ADR-005): Supabase secret key → service_role, bypasses RLS.
 * Import only from src/features/<name>/data.ts (enforced by ESLint), and always
 * filter by the user id taken from the verified session.
 */
export function createAdminClient() {
  return createClient(getPublicEnv().NEXT_PUBLIC_SUPABASE_URL, getServerEnv().SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
