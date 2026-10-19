import { redirect } from "next/navigation";

import { AppHeader } from "@/components/AppHeader";
import { getProfileGate } from "@/features/profile/data";
import { LOGIN_PATH, ONBOARDING_PATH } from "@/lib/auth/paths";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// Pages that need completed onboarding (docs/app_flow.md §2). The parent
// (gated) layout has already required the 18+ confirmation.
export default async function OnboardedLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect(LOGIN_PATH);

  const { onboardingCompleted } = await getProfileGate(supabase, user.id);
  if (!onboardingCompleted) redirect(ONBOARDING_PATH);

  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
