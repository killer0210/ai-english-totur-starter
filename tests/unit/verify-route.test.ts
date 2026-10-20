import { AuthApiError } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const SITE_URL = "http://localhost:3000";
const EMAIL = "anu@example.com";
const CODE = "123456";

const verifyOtp = vi.fn();
vi.mock("@/lib/supabase/route", () => ({
  createRouteClient: () => ({
    supabase: { auth: { verifyOtp } },
    withCookies: (response: Response) => response,
  }),
}));

let POST: (request: NextRequest) => Promise<Response>;

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE_URL);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  ({ POST } = await import("@/app/api/auth/verify/route"));
});

afterEach(() => {
  vi.restoreAllMocks();
  verifyOtp.mockReset();
});

function request() {
  return new NextRequest(new URL("/api/auth/verify", SITE_URL), {
    method: "POST",
    headers: { "content-type": "application/json", origin: SITE_URL },
    body: JSON.stringify({ email: EMAIL, code: CODE }),
  });
}

function authError(code: string, status: number) {
  return new AuthApiError("message", status, code);
}

describe("POST /api/auth/verify logging", () => {
  it("does not log a wrong or expired code", async () => {
    verifyOtp.mockResolvedValue({ error: authError("otp_expired", 403) });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("OTP_INVALID");
    expect(error).not.toHaveBeenCalled();
  });

  it("logs an unexpected error code server-side without the email and replies identically", async () => {
    verifyOtp.mockResolvedValueOnce({ error: authError("otp_expired", 403) });
    const expected = await POST(request());

    verifyOtp.mockResolvedValueOnce({ error: authError("unexpected_failure", 500) });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await POST(request());

    expect(response.status).toBe(expected.status);
    expect(await response.json()).toEqual(await expected.json());
    expect(error).toHaveBeenCalledTimes(1);
    const line = error.mock.calls[0]?.[0] as string;
    expect(JSON.parse(line)).toMatchObject({
      level: "error",
      event: "verify_unexpected_error",
      status: 500,
      code: "unexpected_failure",
    });
    expect(line).not.toContain(EMAIL);
    expect(line).not.toContain(CODE);
  });

  it("logs nothing on success", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(error).not.toHaveBeenCalled();
  });
});
