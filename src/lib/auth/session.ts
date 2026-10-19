import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError, defaultMessageMn } from "@/lib/errors";

export type SessionUser = { id: string };

/**
 * The signed-in user, verified with getClaims() (never getSession() on the
 * server — Supabase SSR guide). Returns null when there is no valid session.
 */
export async function getSessionUser(supabase: SupabaseClient): Promise<SessionUser | null> {
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || typeof sub !== "string" || sub.length === 0) return null;
  return { id: sub };
}

export async function requireUser(supabase: SupabaseClient): Promise<SessionUser> {
  const user = await getSessionUser(supabase);
  if (!user) throw new AppError("UNAUTHENTICATED", defaultMessageMn("UNAUTHENTICATED"), 401);
  return user;
}
