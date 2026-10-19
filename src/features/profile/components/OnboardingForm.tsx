"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/api-client";

import { PROFILE_DEFAULTS, type ProfileSettings } from "../schemas";
import { ConfidenceField, DailyMinutesField, EnglishLevelField, GoalsField } from "./ProfileFields";
import { PrivacyNotice } from "./PrivacyNotice";

// docs/prd.md FR-02: goals → daily minutes → level → confidence; every step has a default.
const STEP_COUNT = 4;

export function OnboardingForm() {
  const t = useTranslations("onboarding");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const stepLabel = useRef<HTMLParagraphElement>(null);
  const changedStep = useRef(false);

  const [step, setStep] = useState(0);
  const [values, setValues] = useState<ProfileSettings>(PROFILE_DEFAULTS);
  const [status, setStatus] = useState<"idle" | "submitting" | "redirecting">("idle");
  const [error, setError] = useState<string | null>(null);

  // Move focus to the step label when the step changes (not on first render),
  // so keyboard and screen-reader users start at the new question.
  useEffect(() => {
    if (changedStep.current) stepLabel.current?.focus();
  }, [step]);

  const busy = status !== "idle";
  const isLast = step === STEP_COUNT - 1;
  const set =
    <K extends keyof ProfileSettings>(key: K) =>
    (value: ProfileSettings[K]) =>
      setValues((current) => ({ ...current, [key]: value }));

  function goTo(next: number) {
    changedStep.current = true;
    setError(null);
    setStep(next);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!isLast) {
      goTo(step + 1);
      return;
    }
    setError(null);
    setStatus("submitting");
    const result = await postJson<{ redirectTo: string }>("/api/onboarding", values);
    if (!result.ok) {
      setStatus("idle");
      setError(result.error?.message_mn ?? tCommon("networkError"));
      return;
    }
    setStatus("redirecting");
    router.replace(result.data.redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <PrivacyNotice />

      <p
        ref={stepLabel}
        tabIndex={-1}
        className="text-sm font-medium text-muted-foreground focus-visible:outline-none"
      >
        {t("progress", { step: step + 1, total: STEP_COUNT })}
      </p>

      {step === 0 ? (
        <GoalsField value={values.goals} onChange={set("goals")} disabled={busy} />
      ) : null}
      {step === 1 ? (
        <DailyMinutesField
          value={values.dailyMinutesGoal}
          onChange={set("dailyMinutesGoal")}
          disabled={busy}
        />
      ) : null}
      {step === 2 ? (
        <EnglishLevelField
          value={values.englishLevel}
          onChange={set("englishLevel")}
          disabled={busy}
        />
      ) : null}
      {step === 3 ? (
        <ConfidenceField
          value={values.baselineConfidence}
          onChange={set("baselineConfidence")}
          disabled={busy}
        />
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {status === "redirecting" ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t("redirecting")}
        </p>
      ) : null}

      <div className="flex gap-3">
        {step > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={busy}
            onClick={() => goTo(step - 1)}
          >
            {t("back")}
          </Button>
        ) : null}
        <Button type="submit" className="flex-1" disabled={busy}>
          {isLast ? (status === "submitting" ? t("finishing") : t("finish")) : t("next")}
        </Button>
      </div>
    </form>
  );
}
