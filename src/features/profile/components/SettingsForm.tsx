"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { patchJson } from "@/lib/api-client";

import type { ProfileSettings } from "../schemas";
import { ConfidenceField, DailyMinutesField, EnglishLevelField, GoalsField } from "./ProfileFields";

type Status = "idle" | "saving" | "saved";

export function SettingsForm({ initial }: { initial: ProfileSettings }) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [values, setValues] = useState<ProfileSettings>(initial);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const saving = status === "saving";
  const set =
    <K extends keyof ProfileSettings>(key: K) =>
    (value: ProfileSettings[K]) => {
      setStatus("idle");
      setValues((current) => ({ ...current, [key]: value }));
    };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError(null);
    setStatus("saving");
    const result = await patchJson<{ profile: ProfileSettings }>("/api/profile", values);
    if (!result.ok) {
      setStatus("idle");
      setError(result.error?.message_mn ?? tCommon("networkError"));
      return;
    }
    setValues(result.data.profile);
    setStatus("saved");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8" noValidate>
      <EnglishLevelField
        value={values.englishLevel}
        onChange={set("englishLevel")}
        disabled={saving}
      />
      <GoalsField value={values.goals} onChange={set("goals")} disabled={saving} />
      <DailyMinutesField
        value={values.dailyMinutesGoal}
        onChange={set("dailyMinutesGoal")}
        disabled={saving}
      />
      <ConfidenceField
        value={values.baselineConfidence}
        onChange={set("baselineConfidence")}
        disabled={saving}
      />

      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={saving} className="w-full">
          {saving ? t("saving") : t("save")}
        </Button>
        <div aria-live="polite">
          {status === "saved" ? <p className="text-sm text-success">{t("saved")}</p> : null}
        </div>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
