import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AgeConfirmationForm } from "@/features/auth/components/AgeConfirmationForm";
import { SignOutButton } from "@/features/auth/components/SignOutButton";
import { getProfileGate } from "@/features/profile/data";
import { HOME_PATH, LOGIN_PATH } from "@/lib/auth/paths";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// S02a — first sign-in: "I am 18 or older" (pilot is 18+ only).
export default async function AgeConfirmationPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect(LOGIN_PATH);
  if ((await getProfileGate(supabase, user.id)).ageConfirmed) redirect(HOME_PATH);

  const t = await getTranslations("ageConfirmation");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-base text-muted-foreground">{t("body")}</p>
      </header>
      <AgeConfirmationForm />
      <section className="flex flex-col gap-3 border-t pt-6">
        <p className="text-sm text-muted-foreground">{t("under18")}</p>
        <SignOutButton />
      </section>
    </main>
  );
}
