import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/features/auth/components/SignOutButton";
import { SettingsForm } from "@/features/profile/components/SettingsForm";
import { getProfileSettings } from "@/features/profile/data";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// S11 — settings. Account deletion arrives in M13.
export default async function SettingsPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect(LOGIN_PATH);
  const settings = await getProfileSettings(supabase, user.id);

  const t = await getTranslations("settings");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <SettingsForm initial={settings} />
      <section aria-labelledby="account-heading" className="flex flex-col gap-3 border-t pt-6">
        <h2 id="account-heading" className="text-xl font-semibold">
          {t("accountHeading")}
        </h2>
        <SignOutButton />
      </section>
    </main>
  );
}
