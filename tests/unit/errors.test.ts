import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  AppError,
  defaultMessageMn,
  ERROR_CODES,
  type ErrorBody,
  toErrorResponse,
  withErrorHandling,
} from "@/lib/errors";

async function body(response: Response): Promise<ErrorBody> {
  return (await response.json()) as ErrorBody;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("toErrorResponse", () => {
  it("maps an AppError to its status and JSON body", async () => {
    const response = toErrorResponse(
      new AppError("DAILY_LIMIT_REACHED", "Өнөөдрийн хязгаар дууслаа", 429, false),
    );
    expect(response.status).toBe(429);
    expect(await body(response)).toEqual({
      error: {
        code: "DAILY_LIMIT_REACHED",
        message_mn: "Өнөөдрийн хязгаар дууслаа",
        retryable: false,
      },
    });
  });

  it("keeps the retryable flag", async () => {
    const response = toErrorResponse(
      new AppError("AI_UNAVAILABLE", defaultMessageMn("AI_UNAVAILABLE"), 503, true),
    );
    expect((await body(response)).error.retryable).toBe(true);
  });

  it("maps a ZodError to VALIDATION_FAILED (400)", async () => {
    const result = z.object({ content: z.string().min(1) }).safeParse({ content: "" });
    if (result.success) throw new Error("expected a validation failure");
    const response = toErrorResponse(result.error);
    expect(response.status).toBe(400);
    expect((await body(response)).error.code).toBe("VALIDATION_FAILED");
  });

  it("hides unknown errors behind a generic 500", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = toErrorResponse(new Error("db password=hunter2 at line 3"));
    const json = await body(response);

    expect(response.status).toBe(500);
    expect(json.error).toEqual({
      code: "INTERNAL",
      message_mn: defaultMessageMn("INTERNAL"),
      retryable: false,
    });
    expect(JSON.stringify(json)).not.toContain("hunter2");
    expect(log).toHaveBeenCalledOnce();
  });
});

describe("withErrorHandling", () => {
  it("returns the handler response when nothing is thrown", async () => {
    const handler = withErrorHandling(async () => Response.json({ ok: true }));
    const response = await handler();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("converts a thrown AppError and passes arguments through", async () => {
    const handler = withErrorHandling(async (id: string) => {
      throw new AppError("NOT_FOUND", `${id}`, 404);
    });
    const response = await handler("abc");
    expect(response.status).toBe(404);
    expect(await body(response)).toEqual({
      error: { code: "NOT_FOUND", message_mn: "abc", retryable: false },
    });
  });
});

describe("messages", () => {
  it("has a Mongolian default message for every error code", () => {
    for (const code of ERROR_CODES) {
      expect(defaultMessageMn(code)).toMatch(/\S/);
    }
  });
});
