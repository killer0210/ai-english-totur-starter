import type { EnglishLevel } from "@/features/profile/schemas";

export type PathScenario = {
  id: string;
  slug: string;
  position: number;
  titleMn: string;
  goalMn: string;
  englishLevel: EnglishLevel;
};

export type PathUnit = {
  id: string;
  englishLevel: EnglishLevel;
  position: number;
  titleMn: string;
  scenarios: PathScenario[];
};

/**
 * "Next scenario" (docs/prd.md FR-03): the first active scenario at the
 * learner's level, in unit then scenario order, without a completed session.
 * `content` holds active rows only. Returns null when every scenario is done
 * or the level has no content; the "suggest the earliest completed one again"
 * fallback belongs to the Today card (M12).
 */
export function nextScenario(
  profile: { englishLevel: EnglishLevel },
  completedScenarioIds: ReadonlySet<string>,
  content: readonly PathUnit[],
): PathScenario | null {
  const units = content
    .filter((unit) => unit.englishLevel === profile.englishLevel)
    .toSorted((a, b) => a.position - b.position);
  for (const unit of units) {
    const scenarios = unit.scenarios.toSorted((a, b) => a.position - b.position);
    const next = scenarios.find((scenario) => !completedScenarioIds.has(scenario.id));
    if (next) return next;
  }
  return null;
}
