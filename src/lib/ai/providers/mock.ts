import type { AppEnv } from "@/lib/env";

import { AiProviderError, type AiProvider, type ReplyInput } from "../adapter";

// Deterministic provider for unit, integration and E2E tests, CI and staging
// (ADR-002). Never used in production: createMockProvider refuses, and
// src/lib/env.ts already rejects AI_PROVIDER=mock with APP_ENV=production.
//
// Markers in the learner message choose the behaviour:
//   [mock:timeout]    the call times out
//   [mock:error]      the provider fails
//   [mock:fail-once]  the first call for this message fails, the next succeeds
//   [mock:invalid]    the provider returns output that fails replySchema
//   [mock:slow]       the reply takes MOCK_SLOW_MS (for concurrency tests)

export const MOCK_SLOW_MS = 800;

const MARKERS = ["timeout", "error", "fail-once", "invalid", "slow"] as const;
type Marker = (typeof MARKERS)[number];

function markersOf(content: string): Set<Marker> {
  return new Set(MARKERS.filter((marker) => content.includes(`[mock:${marker}]`)));
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new AiProviderError("timeout"));
      },
      { once: true },
    );
  });
}

export type MockProvider = AiProvider & {
  /** Provider calls made for one learner message (tests assert "one call"). */
  callCount(messageId: string): number;
};

export function createMockProvider(appEnv: AppEnv): MockProvider {
  if (appEnv === "production") {
    throw new Error("The mock AI provider must not run when APP_ENV=production");
  }
  const calls = new Map<string, number>();

  return {
    name: "mock",
    callCount: (messageId) => calls.get(messageId) ?? 0,
    async reply(input: ReplyInput, { signal }) {
      const count = (calls.get(input.messageId) ?? 0) + 1;
      calls.set(input.messageId, count);

      const learner = input.history.at(-1);
      const markers = markersOf(learner?.content ?? "");
      if (markers.has("slow")) await wait(MOCK_SLOW_MS, signal);
      if (signal.aborted || markers.has("timeout")) throw new AiProviderError("timeout");
      if (markers.has("error")) throw new AiProviderError("provider_error");
      if (markers.has("fail-once") && count === 1) throw new AiProviderError("provider_error");
      if (markers.has("invalid")) return { text: "   " };

      const turn = input.history.filter((t) => t.role === "user").length;
      return {
        text: `Mock reply ${turn} (${input.englishLevel}, ${input.scenario.aiRole}): thank you! Can you tell me more?`,
      };
    },
  };
}
