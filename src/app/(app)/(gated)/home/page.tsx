import { getTranslations } from "next-intl/server";

import { SignOutButton } from "@/features/auth/components/SignOutButton";

// S04 — Home. The "Today" card and progress summary arrive in M12; until
// then this is the signed-in landing point with sign-out.
export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-base text-muted-foreground">{t("body")}</p>
      </header>
      <SignOutButton />
    </main>
  );
}
