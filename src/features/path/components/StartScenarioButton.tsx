"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { SessionState } from "@/features/conversation/types";
import { postJson } from "@/lib/api-client";
import { talkPath } from "@/lib/auth/paths";

/** Starts a conversation for the scenario and opens /talk/[sessionId]. */
export function StartScenarioButton({
  scenarioId,
  describedBy,
}: {
  scenarioId: string;
  /** id of the card title, so each button is announced with its scenario. */
  describedBy: string;
}) {
  const t = useTranslations("path");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (starting) return;
    setError(null);
    setStarting(true);
    const result = await postJson<{ session: SessionState }>("/api/sessions", { scenarioId });
    if (!result.ok) {
      setStarting(false);
      setError(result.error?.message_mn ?? tCommon("networkError"));
      return;
    }
    router.push(talkPath(result.data.session.id));
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={() => void start()} disabled={starting} aria-describedby={describedBy}>
        {starting ? t("starting") : t("start")}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
