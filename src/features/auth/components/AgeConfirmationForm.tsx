"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/api-client";

export function AgeConfirmationForm() {
  const t = useTranslations("ageConfirmation");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const ids = { checkbox: useId(), error: useId() };

  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed || submitting) return;
    setError(null);
    setSubmitting(true);
    const result = await postJson<{ redirectTo: string }>("/api/age-confirmation", {
      confirmed: true,
    });
    if (!result.ok) {
      setSubmitting(false);
      setError(result.error?.message_mn ?? tCommon("networkError"));
      return;
    }
    router.replace(result.data.redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label
        htmlFor={ids.checkbox}
        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-input bg-surface px-3"
      >
        <input
          id={ids.checkbox}
          type="checkbox"
          className="size-5 accent-primary"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          disabled={submitting}
        />
        <span>{t("checkbox")}</span>
      </label>

      {error ? (
        <p id={ids.error} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={!confirmed || submitting} className="w-full">
        {submitting ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
