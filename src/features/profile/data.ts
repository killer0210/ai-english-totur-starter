import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError, defaultMessageMn } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  type OnboardingInput,
  PROFILE_DEFAULTS,
  type ProfileSettings,
  type ProfileUpdate,
} from "./schemas";

export type ProfileGate = { ageConfirmed: boolean; onboardingCompleted: boolean };

type ProfileRow = {
  goals: ProfileSettings["goals"];
  daily_minutes_goal: ProfileSettings["dailyMinutesGoal"];
  english_level: ProfileSettings["englishLevel"];
  baseline_confidence: ProfileSettings["baselineConfidence"] | null;
};

const SETTINGS_COLUMNS = "goals, daily_minutes_goal, english_level, baseline_confidence";

function internalError(): AppError {
  return new AppError("INTERNAL", defaultMessageMn("INTERNAL"), 500);
}

function toSettings(row: ProfileRow): ProfileSettings {
  return {
    goals: row.goals,
    dailyMinutesGoal: row.daily_minutes_goal,
    englishLevel: row.english_level,
    baselineConfidence: row.baseline_confidence ?? PROFILE_DEFAULTS.baselineConfidence,
  };
}

// The only columns a user can change. onboarding_completed_at, age_confirmed_at
// and display_name are never taken from input.
function toColumns(input: ProfileUpdate): Partial<ProfileRow> {
  const columns: Partial<ProfileRow> = {};
  if (input.goals !== undefined) columns.goals = input.goals;
  if (input.dailyMinutesGoal !== undefined) columns.daily_minutes_goal = input.dailyMinutesGoal;
  if (input.englishLevel !== undefined) columns.english_level = input.englishLevel;
  if (input.baselineConfidence !== undefined) {
    columns.baseline_confidence = input.baselineConfidence;
  }
  return columns;
}

/** Read through the user-session client: RLS returns only the user's own row. */
export async function getProfileGate(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileGate> {
  const { data, error } = await supabase
    .from("profiles")
    .select("age_confirmed_at, onboarding_completed_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    logger.error("profile_read_failed", { userId, code: error.code });
    throw internalError();
  }
  return {
    ageConfirmed: Boolean(data?.age_confirmed_at),
    onboardingCompleted: Boolean(data?.onboarding_completed_at),
  };
}

/** The four editable settings, read through the user-session client (RLS). */
export async function getProfileSettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileSettings> {
  const { data, error } = await supabase
    .from("profiles")
    .select(SETTINGS_COLUMNS)
    .eq("id", userId)
    .maybeSingle<ProfileRow>();
  if (error) {
    logger.error("profile_read_failed", { userId, code: error.code });
    throw internalError();
  }
  if (!data) {
    logger.error("profile_missing", { userId });
    throw new AppError("NOT_FOUND", defaultMessageMn("NOT_FOUND"), 404);
  }
  return toSettings(data);
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
    throw internalError();
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

/**
 * Saves the onboarding answers and sets onboarding_completed_at (server time).
 * Requires the 18+ confirmation. Idempotent: once completed, a repeat call
 * changes nothing (later edits go through updateProfile).
 */
export async function completeOnboarding(userId: string, input: OnboardingInput): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .update({ ...toColumns(input), onboarding_completed_at: new Date().toISOString() })
    .eq("id", userId)
    .not("age_confirmed_at", "is", null)
    .is("onboarding_completed_at", null)
    .select("id");
  if (error) {
    logger.error("onboarding_failed", { userId, code: error.code });
    throw internalError();
  }
  if (data.length > 0) return;

  const { data: existing } = await admin
    .from("profiles")
    .select("age_confirmed_at")
    .eq("id", userId)
    .maybeSingle();
  if (!existing) {
    logger.error("profile_missing", { userId });
    throw new AppError("NOT_FOUND", defaultMessageMn("NOT_FOUND"), 404);
  }
  if (!existing.age_confirmed_at) {
    throw new AppError("FORBIDDEN", defaultMessageMn("FORBIDDEN"), 403);
  }
  // Already completed: idempotent success.
}

/** Settings edit (ADR-005). Only after onboarding; returns the saved values. */
export async function updateProfile(
  userId: string,
  input: ProfileUpdate,
): Promise<ProfileSettings> {
  const { data, error } = await createAdminClient()
    .from("profiles")
    .update(toColumns(input))
    .eq("id", userId)
    .not("onboarding_completed_at", "is", null)
    .select(SETTINGS_COLUMNS)
    .returns<ProfileRow[]>();
  if (error) {
    logger.error("profile_update_failed", { userId, code: error.code });
    throw internalError();
  }
  const row = data[0];
  if (!row) throw new AppError("FORBIDDEN", defaultMessageMn("FORBIDDEN"), 403);
  return toSettings(row);
}
