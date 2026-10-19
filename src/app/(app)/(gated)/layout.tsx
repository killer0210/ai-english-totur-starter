import { redirect } from "next/navigation";

import { getProfileGate } from "@/features/profile/data";
import { AGE_CONFIRMATION_PATH, LOGIN_PATH } from "@/lib/auth/paths";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// Pages that need the 18+ confirmation (docs/app_flow.md §2). The onboarding
// check joins here in M3.
export default async function GatedLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect(LOGIN_PATH);

  const { ageConfirmed } = await getProfileGate(supabase, user.id);
  if (!ageConfirmed) redirect(AGE_CONFIRMATION_PATH);

  return children;
}
