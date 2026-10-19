import { getTranslations } from "next-intl/server";

export default async function OnboardedLoading() {
  const t = await getTranslations("common");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-12 sm:px-6">
      <p role="status" className="text-base text-muted-foreground">
        {t("loading")}
      </p>
    </main>
  );
}
