import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { HISTORY_PATH } from "@/lib/auth/paths";

export default async function TalkNotFound() {
  const t = await getTranslations("talk");
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold">{t("notFoundTitle")}</h1>
      <p className="text-base text-muted-foreground">{t("notFoundBody")}</p>
      <Link href={HISTORY_PATH} className={buttonVariants({ className: "self-start" })}>
        {t("toHistory")}
      </Link>
    </main>
  );
}
