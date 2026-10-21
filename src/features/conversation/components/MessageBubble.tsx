import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ClientMessage } from "../conversation-state";

// docs/design_system.md §5: AI on the left (surface), learner on the right
// (light primary). A learner message shows whether it is being sent, waiting
// for a reply, or saved without a reply (+ Retry). Plain text only.
export function MessageBubble({
  role,
  content,
  status = "ok",
  speakerLabel,
  onRetry,
  retryDisabled = false,
}: {
  role: ClientMessage["role"];
  content: string;
  status?: ClientMessage["status"];
  /** Screen-reader name of the speaker, e.g. "AI ярилцагч (barista)". */
  speakerLabel: string;
  onRetry?: () => void;
  retryDisabled?: boolean;
}) {
  const t = useTranslations("talk");
  const isUser = role === "user";

  return (
    <li className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl border px-4 py-2 text-base break-words whitespace-pre-wrap sm:max-w-[75%]",
          isUser ? "rounded-br-sm border-primary/30 bg-primary/10" : "rounded-bl-sm bg-surface",
        )}
      >
        <span className="sr-only">{speakerLabel}: </span>
        {content}
      </div>
      {isUser && status === "sending" ? (
        <p className="text-sm text-muted-foreground">{t("statusSending")}</p>
      ) : null}
      {isUser && status === "pending" ? (
        <p className="text-sm text-muted-foreground">{t("statusPending")}</p>
      ) : null}
      {isUser && status === "reply_failed" ? (
        <div className="flex flex-col items-end gap-2">
          <p className="text-sm text-foreground">{t("replyFailed")}</p>
          {onRetry ? (
            <Button variant="outline" onClick={onRetry} disabled={retryDisabled}>
              {t("retry")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
