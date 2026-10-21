import { describe, expect, it } from "vitest";

import {
  MAX_MESSAGE_LENGTH,
  messagesPageSchema,
  sendMessageSchema,
  startSessionSchema,
} from "@/features/conversation/schemas";

const id = "9b2f4a3e-6a8f-4f8e-9a51-3c2d7e1f0a11";

describe("sendMessageSchema", () => {
  it("accepts a message and trims it", () => {
    expect(sendMessageSchema.parse({ clientMessageId: id, content: "  Hello!  " })).toEqual({
      clientMessageId: id,
      content: "Hello!",
    });
  });

  it("rejects an empty or whitespace-only message (testing.md §3 #1)", () => {
    for (const content of ["", "   ", "\n\t "]) {
      expect(sendMessageSchema.safeParse({ clientMessageId: id, content }).success).toBe(false);
    }
  });

  it("accepts exactly 1000 characters and rejects 1001 (testing.md §3 #2)", () => {
    const max = "a".repeat(MAX_MESSAGE_LENGTH);
    expect(sendMessageSchema.safeParse({ clientMessageId: id, content: max }).success).toBe(true);
    const over = sendMessageSchema.safeParse({ clientMessageId: id, content: `${max}a` });
    expect(over.success).toBe(false);
    // Surrounding spaces do not count towards the limit.
    expect(sendMessageSchema.safeParse({ clientMessageId: id, content: ` ${max} ` }).success).toBe(
      true,
    );
  });

  it("requires a UUID clientMessageId", () => {
    expect(sendMessageSchema.safeParse({ content: "Hi" }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ clientMessageId: "abc", content: "Hi" }).success).toBe(
      false,
    );
  });

  it("drops fields it does not know (user_id, role, status)", () => {
    const parsed = sendMessageSchema.parse({
      clientMessageId: id,
      content: "Hi",
      user_id: "someone-else",
      role: "assistant",
    });
    expect(parsed).toEqual({ clientMessageId: id, content: "Hi" });
  });
});

describe("startSessionSchema", () => {
  it("requires a scenario UUID", () => {
    expect(startSessionSchema.safeParse({ scenarioId: id }).success).toBe(true);
    expect(startSessionSchema.safeParse({ scenarioId: "cafe" }).success).toBe(false);
  });
});

describe("messagesPageSchema", () => {
  it("defaults the page size and validates the cursor", () => {
    expect(messagesPageSchema.parse({})).toEqual({ limit: 50 });
    expect(messagesPageSchema.parse({ before: "42", limit: "10" })).toEqual({
      before: 42,
      limit: 10,
    });
    expect(messagesPageSchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(messagesPageSchema.safeParse({ before: "-1" }).success).toBe(false);
  });
});
