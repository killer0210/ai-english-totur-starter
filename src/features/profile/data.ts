import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError, defaultMessageMn } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export type ProfileGate = { ageConfirmed: boolean };

/** Read through the user-session client: RLS returns only the user's own row. */
export async function getProfileGate(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileGate> {
  const { data, error } = await supabase
    .from("profiles")
    .select("age_confirmed_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    logger.error("profile_read_failed", { userId, code: error.code });
    throw new AppError("INTERNAL", defaultMessageMn("INTERNAL"), 500);
  }
  return { ageConfirmed: Boolean(data?.age_confirmed_at) };
}

/** Single-row write (ADR-005): service role, scoped to the verified user id. */
export async function confirmAge(userId: string): Promise<void> {
  const { data, error } = await createAdminClient()
    .from("profiles")
    .update({ age_confirmed_at: new Date().toISOString() })
    .eq("id", userId)
    .is("age_confirmed_at", null)
    .select("id");
  if (error) {
    logger.error("age_confirmation_failed", { userId, code: error.code });
    throw new AppError("INTERNAL", defaultMessageMn("INTERNAL"), 500);
  }
  if (data.length === 0) {
    // Either already confirmed (idempotent success) or the profile is missing.
    const { data: existing } = await createAdminClient()
      .from("profiles")
      .select("age_confirmed_at")
      .eq("id", userId)
      .maybeSingle();
    if (!existing) {
      logger.error("profile_missing", { userId });
      throw new AppError("NOT_FOUND", defaultMessageMn("NOT_FOUND"), 404);
    }
  }
}
