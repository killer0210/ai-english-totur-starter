import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { HOME_PATH, LEARNING_PATH, SETTINGS_PATH } from "@/lib/auth/paths";

// Top bar for signed-in pages. Settings opens from the profile icon
// (docs/design_system.md §5, MobileNav); the bottom MobileNav arrives with its
// destination pages, so the path link sits here until then.
export async function AppHeader() {
  const t = await getTranslations("appHeader");

  return (
    <header className="border-b bg-surface">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
        <Link
          href={HOME_PATH}
          className="flex min-h-11 items-center rounded-lg font-semibold text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {t("brand")}
        </Link>
        <nav aria-label={t("nav")} className="flex items-center gap-1">
          <Link
            href={LEARNING_PATH}
            className="flex min-h-11 items-center rounded-lg px-3 text-base font-medium text-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {t("path")}
          </Link>
          <Link
            href={SETTINGS_PATH}
            aria-label={t("settings")}
            className="flex size-11 items-center justify-center rounded-full text-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>
          </Link>
        </nav>
      </div>
    </header>
  );
}
