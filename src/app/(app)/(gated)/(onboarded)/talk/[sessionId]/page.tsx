import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { Conversation } from "@/features/conversation/components/Conversation";
import { conversationConfig } from "@/features/conversation/config";
import { getConversation } from "@/features/conversation/data";
import { idSchema } from "@/features/conversation/schemas";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// S06 — conversation. Read with the user-session client: another user's
// session id is simply not found (RLS).
export default async function TalkPage({ params }: PageProps<"/talk/[sessionId]">) {
  const supabase = await createClient();
  if (!(await getSessionUser(supabase))) redirect(LOGIN_PATH);

  const id = idSchema.safeParse((await params).sessionId);
  if (!id.success) notFound();
  const config = conversationConfig();
  // A conversation has at most 2 × maxTurns messages, so one page holds it all.
  const view = await getConversation(supabase, id.data, {
    limit: config.maxTurns * 2,
    maxTurns: config.maxTurns,
    staleMs: config.staleMs,
  });
  if (!view) notFound();

  const t = await getTranslations("talk");
  const last = view.messages.at(-1);
  // Remount the client state when a refresh brings newer server data.
  const version = `${view.session.status}:${last?.id ?? ""}:${last?.status ?? ""}`;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">
          {view.session.scenario?.titleMn ?? t("logLabel")}
        </h1>
        {view.session.scenario ? (
          <p className="text-sm text-muted-foreground">
            {t("levelLabel")}: {view.session.scenario.englishLevel}
          </p>
        ) : null}
      </header>
      <Conversation key={version} view={view} />
    </main>
  );
}
