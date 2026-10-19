import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("E2E needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Creates an invited (OTP-only) user, as scripts/invite-users.mjs does. */
export async function inviteUser(label: string) {
  const email = `e2e-${label}-${randomUUID().slice(0, 8)}@example.com`;
  const { data, error } = await admin().auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser returned no user");
  return { id: data.user.id, email };
}

export async function setProfile(id: string, values: Record<string, unknown>) {
  const { error } = await admin().from("profiles").update(values).eq("id", id);
  if (error) throw error;
}

export async function readProfile(id: string) {
  const { data, error } = await admin()
    .from("profiles")
    .select(
      "english_level, goals, daily_minutes_goal, baseline_confidence, onboarding_completed_at",
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteUser(id: string) {
  await admin().auth.admin.deleteUser(id);
}
