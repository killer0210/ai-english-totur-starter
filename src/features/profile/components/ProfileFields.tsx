"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useId } from "react";

import {
  CONFIDENCE_LEVELS,
  type Confidence,
  DAILY_MINUTES,
  type DailyMinutes,
  ENGLISH_LEVELS,
  type EnglishLevel,
  type Goal,
  GOALS,
} from "../schemas";

// Native checkbox/radio inputs keep keyboard behaviour (Tab, Space, arrow keys)
// and screen-reader semantics; the label is the 44px touch target.
const optionClass =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-input bg-surface px-3 py-2 has-checked:border-primary has-checked:ring-1 has-checked:ring-primary has-focus-visible:ring-3 has-focus-visible:ring-ring/50 has-disabled:cursor-not-allowed has-disabled:opacity-50";
const inputClass = "size-5 shrink-0 accent-primary";

type FieldProps<T> = { value: T; onChange: (value: T) => void; disabled?: boolean };

function Fieldset({
  legend,
  hint,
  children,
}: {
  legend: string;
  hint?: string;
  children: ReactNode;
}) {
  const hintId = useId();
  return (
    <fieldset className="flex flex-col gap-3" aria-describedby={hint ? hintId : undefined}>
      <legend className="mb-1 text-lg font-semibold">{legend}</legend>
      {hint ? (
        <p id={hintId} className="-mt-2 text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {children}
    </fieldset>
  );
}

export function GoalsField({ value, onChange, disabled }: FieldProps<Goal[]>) {
  const t = useTranslations("profileFields.goals");
  const toggle = (goal: Goal, checked: boolean) =>
    onChange(
      checked
        ? GOALS.filter((g) => g === goal || value.includes(g))
        : value.filter((g) => g !== goal),
    );

  return (
    <Fieldset legend={t("legend")} hint={t("hint")}>
      {GOALS.map((goal) => (
        <label key={goal} className={optionClass}>
          <input
            type="checkbox"
            className={inputClass}
            checked={value.includes(goal)}
            onChange={(e) => toggle(goal, e.target.checked)}
            disabled={disabled}
          />
          <span>{t(`options.${goal}`)}</span>
        </label>
      ))}
    </Fieldset>
  );
}

export function DailyMinutesField({ value, onChange, disabled }: FieldProps<DailyMinutes>) {
  const t = useTranslations("profileFields.dailyMinutes");
  const name = useId();

  return (
    <Fieldset legend={t("legend")} hint={t("hint")}>
      {DAILY_MINUTES.map((minutes) => (
        <label key={minutes} className={optionClass}>
          <input
            type="radio"
            name={name}
            className={inputClass}
            checked={value === minutes}
            onChange={() => onChange(minutes)}
            disabled={disabled}
          />
          <span>{t("option", { minutes })}</span>
        </label>
      ))}
    </Fieldset>
  );
}

export function EnglishLevelField({ value, onChange, disabled }: FieldProps<EnglishLevel>) {
  const t = useTranslations("profileFields.englishLevel");
  const name = useId();

  return (
    <Fieldset legend={t("legend")} hint={t("hint")}>
      {ENGLISH_LEVELS.map((level) => (
        <label key={level} className={optionClass}>
          <input
            type="radio"
            name={name}
            className={inputClass}
            checked={value === level}
            onChange={() => onChange(level)}
            disabled={disabled}
          />
          <span className="flex flex-col">
            <span className="font-medium">{t(`options.${level}.title`)}</span>
            <span className="text-sm text-muted-foreground">
              {t(`options.${level}.description`)}
            </span>
          </span>
        </label>
      ))}
    </Fieldset>
  );
}

export function ConfidenceField({ value, onChange, disabled }: FieldProps<Confidence>) {
  const t = useTranslations("profileFields.confidence");
  const name = useId();

  return (
    <Fieldset legend={t("legend")} hint={t("hint")}>
      {CONFIDENCE_LEVELS.map((level) => (
        <label key={level} className={optionClass}>
          <input
            type="radio"
            name={name}
            className={inputClass}
            checked={value === level}
            onChange={() => onChange(level)}
            disabled={disabled}
          />
          <span>{t(`options.${level}`)}</span>
        </label>
      ))}
    </Fieldset>
  );
}
