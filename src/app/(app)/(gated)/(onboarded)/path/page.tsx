import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ScenarioCard, type ScenarioState } from "@/features/path/components/ScenarioCard";
import { getPath } from "@/features/path/data";
import { nextScenario } from "@/features/path/next-scenario";
import { getProfileSettings } from "@/features/profile/data";
import { LOGIN_PATH, SETTINGS_PATH } from "@/lib/auth/paths";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// S05 — learning path for the learner's level: units → scenarios, no locks
// (docs/prd.md FR-03). Starting a conversation from a card arrives in M5.
export default async function PathPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect(LOGIN_PATH);
  const { englishLevel } = await getProfileSettings(supabase, user.id);
  const units = await getPath(supabase, englishLevel);
  // practice_sessions arrive in M5; until then nothing is completed.
  const completed = new Set<string>();
  const next = nextScenario({ englishLevel }, completed, units);

  const t = await getTranslations("path");
  const stateOf = (id: string): ScenarioState =>
    completed.has(id) ? "done" : id === next?.id ? "next" : "todo";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-base text-muted-foreground">
          {t.rich("subtitle", {
            level: englishLevel,
            settings: (chunks) => (
              <Link
                href={SETTINGS_PATH}
                className="rounded-sm text-primary underline underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
        <p className="text-sm text-muted-foreground">{t("comingSoon")}</p>
      </header>

      {units.length === 0 ? (
        <p role="status" className="rounded-xl border bg-surface p-4 text-base">
          {t("empty")}
        </p>
      ) : (
        units.map((unit) => (
          <section
            key={unit.id}
            aria-labelledby={`unit-${unit.id}`}
            className="flex flex-col gap-3"
          >
            <h2 id={`unit-${unit.id}`} className="text-xl font-semibold">
              {t("unitHeading", { position: unit.position, title: unit.titleMn })}
            </h2>
            <ol className="grid gap-3 sm:grid-cols-2">
              {unit.scenarios.map((scenario) => (
                <li key={scenario.id}>
                  <ScenarioCard scenario={scenario} state={stateOf(scenario.id)} />
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
    </main>
  );
}
