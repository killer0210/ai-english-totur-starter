import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { decodeSessionsCursor, listSessions } from "@/features/conversation/data";
import { SESSIONS_PAGE_SIZE } from "@/features/conversation/schemas";
import { HISTORY_PATH, LEARNING_PATH, LOGIN_PATH, talkPath } from "@/lib/auth/paths";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

// S07a — past conversations, most recent activity first (docs/app_flow.md §1).
export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  const supabase = await createClient();
  if (!(await getSessionUser(supabase))) redirect(LOGIN_PATH);

  const { cursor } = await searchParams;
  const { sessions, nextCursor } = await listSessions(supabase, {
    cursor: decodeSessionsCursor(typeof cursor === "string" ? cursor : null),
    limit: SESSIONS_PAGE_SIZE,
  });
  const t = await getTranslations("history");
  const format = await getFormatter();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      {sessions.length === 0 ? (
        <div role="status" className="flex flex-col gap-3 rounded-xl border bg-surface p-4">
          <p className="text-base">{t("empty")}</p>
          <Link href={LEARNING_PATH} className={buttonVariants({ className: "self-start" })}>
            {t("emptyLink")}
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {sessions.map((session) => (
            <li key={session.id}>
              <article className="flex flex-col gap-2 rounded-xl border bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-medium",
                      session.status === "active" && "border-primary text-primary",
                    )}
                  >
                    {t(`status.${session.status}`)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {t("turns", { count: session.learnerTurnCount })}
                  </span>
                </div>
                <h2 className="text-lg font-semibold">
                  {session.scenarioTitleMn ?? t("unknownScenario")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("lastActivity", {
                    date: format.dateTime(new Date(session.lastActivityAt), {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Asia/Ulaanbaatar",
                    }),
                  })}
                </p>
                <Link
                  href={talkPath(session.id)}
                  className={buttonVariants({
                    variant: session.status === "active" ? "default" : "outline",
                    className: "self-start",
                  })}
                >
                  {session.status === "active" ? t("continue") : t("view")}
                  <span className="sr-only">
                    : {session.scenarioTitleMn ?? t("unknownScenario")}
                  </span>
                </Link>
              </article>
            </li>
          ))}
        </ul>
      )}

      {nextCursor ? (
        <Link
          href={`${HISTORY_PATH}?cursor=${encodeURIComponent(nextCursor)}`}
          className={buttonVariants({ variant: "outline", className: "self-start" })}
        >
          {t("more")}
        </Link>
      ) : null}
    </main>
  );
}
