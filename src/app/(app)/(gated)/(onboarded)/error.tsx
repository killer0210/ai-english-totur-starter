"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

// Shown when a page in this group fails to load (e.g. the profile read).
export default function OnboardedError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("pageError");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p role="alert" className="text-base text-muted-foreground">
        {t("body")}
      </p>
      <Button type="button" onClick={reset} className="self-start">
        {t("retry")}
      </Button>
    </main>
  );
}
