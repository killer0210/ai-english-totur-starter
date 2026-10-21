import { describe, expect, it } from "vitest";

import { AiProviderError, type ReplyInput } from "@/lib/ai/adapter";
import { createMockProvider, MOCK_SLOW_MS } from "@/lib/ai/providers/mock";
import { replySchema } from "@/lib/ai/schemas";

function input(content: string, messageId = "m1"): ReplyInput {
  return {
    messageId,
    englishLevel: "A1",
    scenario: { aiRole: "barista", userRole: "customer", roleContext: "Cafe.", introEn: "Hi!" },
    history: [
      { role: "assistant", content: "Hi!" },
      { role: "user", content },
    ],
  };
}

const open = () => ({ signal: new AbortController().signal });

describe("mock AI provider", () => {
  it("refuses to run when APP_ENV=production", () => {
    expect(() => createMockProvider("production")).toThrow(/APP_ENV=production/);
    for (const env of ["local", "test", "staging"] as const) {
      expect(() => createMockProvider(env)).not.toThrow();
    }
  });

  it("is deterministic and its reply passes replySchema", async () => {
    const provider = createMockProvider("test");
    const a = await provider.reply(input("Hello"), open());
    const b = await createMockProvider("test").reply(input("Hello"), open());
    expect(a).toEqual(b);
    expect(replySchema.safeParse(a).success).toBe(true);
    expect(provider.callCount("m1")).toBe(1);
  });

  it("simulates a timeout, a provider error and invalid output", async () => {
    const provider = createMockProvider("test");
    await expect(provider.reply(input("[mock:timeout] hi"), open())).rejects.toMatchObject({
      kind: "timeout",
    });
    await expect(provider.reply(input("[mock:error] hi"), open())).rejects.toBeInstanceOf(
      AiProviderError,
    );
    const invalid = await provider.reply(input("[mock:invalid] hi"), open());
    expect(replySchema.safeParse(invalid).success).toBe(false);
  });

  it("fails only the first call of a [mock:fail-once] message", async () => {
    const provider = createMockProvider("test");
    await expect(provider.reply(input("[mock:fail-once] hi", "m7"), open())).rejects.toMatchObject({
      kind: "provider_error",
    });
    await expect(
      provider.reply(input("[mock:fail-once] hi", "m7"), open()),
    ).resolves.toHaveProperty("text");
    expect(provider.callCount("m7")).toBe(2);
  });

  it("a slow reply is cut off by the deadline signal", async () => {
    const provider = createMockProvider("test");
    const signal = AbortSignal.timeout(20);
    await expect(provider.reply(input("[mock:slow] hi"), { signal })).rejects.toMatchObject({
      kind: "timeout",
    });
    expect(MOCK_SLOW_MS).toBeGreaterThan(20);
  });
});
