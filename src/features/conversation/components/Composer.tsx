"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useId } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ComposerState } from "../conversation-state";
import { MAX_MESSAGE_LENGTH } from "../schemas";

// docs/design_system.md §5 Composer: disabled while sending; locked with the
// reason while a reply is pending or failed; 1000-character limit.
export function Composer({
  state,
  draft,
  maxTurns,
  onDraftChange,
  onSend,
  onRefresh,
}: {
  state: ComposerState;
  draft: string;
  maxTurns: number;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onRefresh: () => void;
}) {
  const t = useTranslations("talk");
  const inputId = useId();
  const counterId = useId();
  const reasonId = useId();

  const length = draft.trim().length;
  const tooLong = length > MAX_MESSAGE_LENGTH;
  const locked = state !== "idle" && state !== "sending";
  const canSend = state === "idle" && length > 0 && !tooLong;

  const reason =
    state === "pending"
      ? t("lockedPending")
      : state === "reply_failed"
        ? t("lockedReplyFailed")
        : state === "blocked"
          ? t("lockedBlocked")
          : state === "turn_limit"
            ? t("turnLimit", { max: maxTurns })
            : null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSend) onSend();
  }

  if (state === "completed") return null;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2" noValidate>
      <label htmlFor={inputId} className="text-sm font-medium">
        {t("composerLabel")}
      </label>
      <textarea
        id={inputId}
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder={t("composerPlaceholder")}
        rows={3}
        disabled={locked}
        readOnly={state === "sending"}
        aria-invalid={tooLong || undefined}
        aria-describedby={cn(counterId, reason && reasonId)}
        className="min-h-24 w-full resize-y rounded-lg border border-input bg-surface px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={counterId} className="text-sm text-muted-foreground">
          {tooLong
            ? t("tooLong", { max: MAX_MESSAGE_LENGTH, over: length - MAX_MESSAGE_LENGTH })
            : t("counter", { count: length, max: MAX_MESSAGE_LENGTH })}
        </p>
        <Button type="submit" disabled={!canSend}>
          {state === "sending" ? t("sending") : t("send")}
        </Button>
      </div>
      <div aria-live="polite">
        {reason ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-surface p-3">
            <p id={reasonId} className="text-sm">
              {reason}
            </p>
            {state === "pending" || state === "blocked" ? (
              <Button type="button" variant="outline" onClick={onRefresh}>
                {t("refresh")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </form>
  );
}
