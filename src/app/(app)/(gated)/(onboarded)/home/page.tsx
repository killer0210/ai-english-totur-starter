import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { SignOutButton } from "@/features/auth/components/SignOutButton";
import { LEARNING_PATH } from "@/lib/auth/paths";

// S04 — Home. The "Today" card and progress summary arrive in M12; until
// then this is the signed-in landing point with the path link and sign-out.
export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-base text-muted-foreground">{t("body")}</p>
      </header>
      <Link href={LEARNING_PATH} className={buttonVariants({ className: "self-start" })}>
        {t("pathLink")}
      </Link>
      <SignOutButton />
    </main>
  );
}
