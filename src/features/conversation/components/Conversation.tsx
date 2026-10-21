"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useReducer, useRef, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { postJson } from "@/lib/api-client";
import { HISTORY_PATH, LEARNING_PATH } from "@/lib/auth/paths";

import {
  composerState,
  conversationReducer,
  type ConversationState,
  learnerMessageCount,
  MIN_MESSAGES_FOR_FEEDBACK,
} from "../conversation-state";
import type { ConversationView, SessionState, TurnResult } from "../types";
import { Composer } from "./Composer";
import { MessageBubble } from "./MessageBubble";

type FailedTurn = Omit<TurnResult, "reply">;

function isFailedTurn(body: unknown): body is FailedTurn {
  return typeof body === "object" && body !== null && "message" in body && "session" in body;
}

// S06 — the conversation (docs/app_flow.md §4). The intro is the first AI
// turn (not stored as a message). Every write goes through /api/sessions/*.
export function Conversation({ view }: { view: ConversationView }) {
  const t = useTranslations("talk");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { session } = view;
  const sessionUrl = `/api/sessions/${session.id}`;

  const [state, dispatch] = useReducer(conversationReducer, view, (v): ConversationState => ({
    session: {
      status: v.session.status,
      learnerTurnCount: v.session.learnerTurnCount,
      feedbackStatus: v.session.feedbackStatus,
    },
    messages: v.messages,
    request: "idle",
    blocked: false,
    turnLimitReached: false,
  }));
  const [draft, setDraft] = useState("");
  // One id per draft: re-sending the same text after a network failure reuses
  // it, so the server can recognise the repeat (ADR-003).
  const [clientMessageId, setClientMessageId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  const composer = composerState(state, session.maxTurns);
  const busy = state.request !== "idle";
  const isActive = state.session.status === "active";

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [state.messages.length]);

  function onDraftChange(value: string) {
    setDraft(value);
    setClientMessageId(crypto.randomUUID());
  }

  async function send() {
    const content = draft.trim();
    setError(null);
    dispatch({ type: "send", clientMessageId, content, now: new Date().toISOString() });
    const result = await postJson<TurnResult>(`${sessionUrl}/messages`, {
      clientMessageId,
      content,
    });
    if (result.ok || isFailedTurn(result.body)) {
      const turn = result.ok ? result.data : { ...(result.body as FailedTurn), reply: null };
      dispatch({ type: "turn", result: turn });
      // Saved (with or without a reply): the draft is done.
      setDraft("");
      setClientMessageId(crypto.randomUUID());
      return;
    }
    dispatch({ type: "send_rejected", clientMessageId, code: result.error?.code ?? null });
    if (result.error?.code !== "MESSAGE_BLOCKED" && result.error?.code !== "TURN_LIMIT_REACHED") {
      setError(result.error?.message_mn ?? tCommon("networkError"));
    }
  }

  async function retry(messageId: string) {
    setError(null);
    dispatch({ type: "retry", messageId });
    const result = await postJson<TurnResult>(`${sessionUrl}/messages/${messageId}/retry`, {});
    if (result.ok || isFailedTurn(result.body)) {
      const turn = result.ok ? result.data : { ...(result.body as FailedTurn), reply: null };
      dispatch({ type: "turn", result: turn });
      return;
    }
    dispatch({ type: "retry_rejected", messageId, code: result.error?.code ?? null });
    setError(result.error?.message_mn ?? tCommon("networkError"));
  }

  async function complete() {
    dialogRef.current?.close();
    setError(null);
    dispatch({ type: "complete" });
    const result = await postJson<{ session: SessionState }>(`${sessionUrl}/complete`, {});
    if (result.ok) {
      dispatch({ type: "completed", session: result.data.session });
      requestAnimationFrame(() => doneRef.current?.focus());
      return;
    }
    dispatch({ type: "complete_rejected", code: result.error?.code ?? null });
    setError(result.error?.message_mn ?? tCommon("networkError"));
  }

  function onCompleteClick() {
    if (learnerMessageCount(state) < MIN_MESSAGES_FOR_FEEDBACK) {
      dialogRef.current?.showModal();
    } else {
      void complete();
    }
  }

  const doneMessage =
    state.session.status === "abandoned"
      ? t("abandoned")
      : state.session.feedbackStatus === "skipped"
        ? `${t("completed")} ${t("feedbackSkipped")}`
        : `${t("completed")} ${t("feedbackSoon")}`;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t("turns", { count: state.session.learnerTurnCount, max: session.maxTurns })}
        </p>
        {isActive ? (
          <Button
            variant="outline"
            onClick={onCompleteClick}
            disabled={busy || composer === "pending"}
          >
            {state.request === "completing" ? t("completing") : t("complete")}
          </Button>
        ) : null}
      </div>

      <ol aria-label={t("logLabel")} className="flex flex-col gap-3">
        {session.scenario ? (
          <MessageBubble
            role="assistant"
            content={session.scenario.introEn}
            speakerLabel={t("aiSpeaker")}
          />
        ) : null}
        {state.messages.map((message) => (
          <MessageBubble
            key={message.id}
            role={message.role}
            content={message.content}
            status={message.status}
            speakerLabel={message.role === "user" ? t("youSpeaker") : t("aiSpeaker")}
            onRetry={isActive ? () => void retry(message.id) : undefined}
            retryDisabled={busy}
          />
        ))}
      </ol>
      <div ref={endRef} />

      {/* New replies and refusals are announced; the log itself is not live. */}
      <div aria-live="polite" className="sr-only">
        {state.messages.at(-1)?.role === "assistant" ? state.messages.at(-1)?.content : ""}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {isActive ? (
        <Composer
          state={composer}
          draft={draft}
          maxTurns={session.maxTurns}
          onDraftChange={onDraftChange}
          onSend={() => void send()}
          onRefresh={() => router.refresh()}
        />
      ) : (
        <div
          ref={doneRef}
          tabIndex={-1}
          role="status"
          className="flex flex-col gap-3 rounded-xl border bg-surface p-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <p className="text-base">{doneMessage}</p>
          <div className="flex flex-wrap gap-2">
            <Link href={LEARNING_PATH} className={buttonVariants()}>
              {t("toPath")}
            </Link>
            <Link href={HISTORY_PATH} className={buttonVariants({ variant: "outline" })}>
              {t("toHistory")}
            </Link>
          </div>
        </div>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby="complete-dialog-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border bg-surface p-6 text-foreground backdrop:bg-black/50"
      >
        <h2 id="complete-dialog-title" className="text-lg font-semibold">
          {t("confirmTitle")}
        </h2>
        <p className="mt-2 text-base text-muted-foreground">{t("confirmBody")}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button autoFocus onClick={() => dialogRef.current?.close()}>
            {t("confirmContinue")}
          </Button>
          <Button variant="outline" onClick={() => void complete()}>
            {t("confirmFinish")}
          </Button>
        </div>
      </dialog>
    </div>
  );
}
