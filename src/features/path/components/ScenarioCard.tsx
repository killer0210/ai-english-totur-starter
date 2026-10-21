import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import type { PathScenario } from "../next-scenario";
import { StartScenarioButton } from "./StartScenarioButton";

export type ScenarioState = "done" | "next" | "todo";

const badgeClass = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium";

// docs/design_system.md §5: title, level, goal, state (done / next). The state
// is shown with text and an icon, not colour alone. The button starts a new
// conversation for the scenario.
export function ScenarioCard({
  scenario,
  state,
}: {
  scenario: PathScenario;
  state: ScenarioState;
}) {
  const t = useTranslations("path");

  return (
    <article
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-surface p-4",
        state === "next" && "border-primary ring-1 ring-primary",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn(badgeClass, "border text-foreground")}>
          <span className="sr-only">{t("levelLabel")} </span>
          {scenario.englishLevel}
        </span>
        {state === "next" ? (
          <span className={cn(badgeClass, "bg-primary text-primary-foreground")}>
            <span aria-hidden="true">→</span>
            {t("stateNext")}
          </span>
        ) : null}
        {state === "done" ? (
          <span className={cn(badgeClass, "border border-success text-success")}>
            <span aria-hidden="true">✓</span>
            {t("stateDone")}
          </span>
        ) : null}
      </div>
      <h3 id={`scenario-${scenario.id}`} className="text-lg font-semibold">
        {scenario.titleMn}
      </h3>
      <p className="flex-1 text-base text-muted-foreground">{scenario.goalMn}</p>
      <StartScenarioButton scenarioId={scenario.id} describedBy={`scenario-${scenario.id}`} />
    </article>
  );
}
