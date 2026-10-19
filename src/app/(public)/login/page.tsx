import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { LoginForm } from "@/features/auth/components/LoginForm";
import { safeNextPath } from "@/lib/auth/paths";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type Props = { searchParams: Promise<{ next?: string | string[] }> };

// S02 — email → 6-digit code. Invite-only (no public sign-up).
export default async function LoginPage({ searchParams }: Props) {
  const { next: rawNext } = await searchParams;
  const next = typeof rawNext === "string" ? safeNextPath(rawNext) : undefined;

  if (await getSessionUser(await createClient())) redirect(next ?? safeNextPath(null));

  const t = await getTranslations("login");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-base text-muted-foreground">{t("subtitle")}</p>
        <p className="text-sm text-muted-foreground">{t("inviteOnly")}</p>
      </header>
      <LoginForm next={next} />
      <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
        {t("backHome")}
      </Link>
    </main>
  );
}
