import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { OnboardingForm } from "@/features/profile/components/OnboardingForm";
import { getProfileGate } from "@/features/profile/data";
import { HOME_PATH, LOGIN_PATH } from "@/lib/auth/paths";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// S03 — onboarding, shown once after the 18+ step (docs/app_flow.md §2).
export default async function OnboardingPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect(LOGIN_PATH);
  if ((await getProfileGate(supabase, user.id)).onboardingCompleted) redirect(HOME_PATH);

  const t = await getTranslations("onboarding");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-base text-muted-foreground">{t("subtitle")}</p>
      </header>
      <OnboardingForm />
    </main>
  );
}
