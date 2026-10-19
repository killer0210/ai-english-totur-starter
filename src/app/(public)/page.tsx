import { getTranslations } from "next-intl/server";

const FEATURES = ["partner", "corrections", "missions", "path", "progress"] as const;

// S01 — landing page.
export default async function LandingPage() {
  const t = await getTranslations("landing");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-12 px-4 py-12 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-4">
        <p className="text-sm font-medium text-primary">{t("brand")}</p>
        <h1 className="text-2xl font-semibold">{t("headline")}</h1>
        <p className="max-w-[70ch] text-base text-muted-foreground">{t("lead")}</p>
      </header>

      <section aria-labelledby="features-heading" className="flex flex-col gap-4">
        <h2 id="features-heading" className="text-xl font-semibold">
          {t("featuresHeading")}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((key) => (
            <li key={key} className="rounded-xl border bg-card p-4 text-card-foreground">
              <h3 className="font-medium">{t(`features.${key}.title`)}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(`features.${key}.description`)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="pilot-heading"
        className="rounded-xl border bg-card p-4 text-card-foreground"
      >
        <h2 id="pilot-heading" className="font-medium">
          {t("pilot.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("pilot.body")}</p>
      </section>

      <footer className="text-sm text-muted-foreground">{t("disclaimer")}</footer>
    </main>
  );
}
