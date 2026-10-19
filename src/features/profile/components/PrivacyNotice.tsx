import { useTranslations } from "next-intl";

// docs/security.md §5: remind learners not to type personal information in conversations.
export function PrivacyNotice() {
  const t = useTranslations("privacyNotice");

  return (
    <aside
      aria-label={t("title")}
      className="rounded-xl border bg-surface p-4 text-sm text-foreground"
    >
      <p className="font-medium">{t("title")}</p>
      <p className="mt-1 text-muted-foreground">{t("body")}</p>
    </aside>
  );
}
