import { z } from "zod";

// Allowed values mirror the profiles table constraints (docs/backend_schema.md §2.1).
export const GOALS = ["work", "school", "travel", "daily"] as const;
export const DAILY_MINUTES = [5, 10, 20] as const;
export const ENGLISH_LEVELS = ["A1", "A2", "B1"] as const;
export const CONFIDENCE_LEVELS = [1, 2, 3, 4, 5] as const;

export type Goal = (typeof GOALS)[number];
export type DailyMinutes = (typeof DAILY_MINUTES)[number];
export type EnglishLevel = (typeof ENGLISH_LEVELS)[number];
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export type ProfileSettings = {
  goals: Goal[];
  dailyMinutesGoal: DailyMinutes;
  englishLevel: EnglishLevel;
  baselineConfidence: Confidence;
};

// docs/prd.md FR-02: every onboarding question has a default.
export const PROFILE_DEFAULTS: ProfileSettings = {
  goals: [],
  dailyMinutesGoal: 10,
  englishLevel: "A2",
  baselineConfidence: 3,
};

const goals = z
  .array(z.enum(GOALS))
  .refine((values) => new Set(values).size === values.length, "Duplicate goal");
const dailyMinutesGoal = z.literal(DAILY_MINUTES);
const englishLevel = z.enum(ENGLISH_LEVELS);
const baselineConfidence = z.literal(CONFIDENCE_LEVELS);

/** POST /api/onboarding. Missing answers take the defaults; unknown fields are rejected. */
export const onboardingSchema = z.strictObject({
  goals: goals.default(PROFILE_DEFAULTS.goals),
  dailyMinutesGoal: dailyMinutesGoal.default(PROFILE_DEFAULTS.dailyMinutesGoal),
  englishLevel: englishLevel.default(PROFILE_DEFAULTS.englishLevel),
  baselineConfidence: baselineConfidence.default(PROFILE_DEFAULTS.baselineConfidence),
});

/** PATCH /api/profile. Only these four fields are writable; at least one is required. */
export const profileUpdateSchema = z
  .strictObject({
    goals: goals.optional(),
    dailyMinutesGoal: dailyMinutesGoal.optional(),
    englishLevel: englishLevel.optional(),
    baselineConfidence: baselineConfidence.optional(),
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined), "Empty update");

export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
