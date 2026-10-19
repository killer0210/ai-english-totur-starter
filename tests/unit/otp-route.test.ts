import { AuthApiError } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const SITE_URL = "http://localhost:3000";
const EMAIL = "anu@example.com";

const signInWithOtp = vi.fn();
vi.mock("@/lib/supabase/route", () => ({
  createRouteClient: () => ({ supabase: { auth: { signInWithOtp } } }),
}));

let POST: (request: NextRequest) => Promise<Response>;

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE_URL);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  ({ POST } = await import("@/app/api/auth/otp/route"));
});

afterEach(() => {
  vi.restoreAllMocks();
  signInWithOtp.mockReset();
});

function request() {
  return new NextRequest(new URL("/api/auth/otp", SITE_URL), {
    method: "POST",
    headers: { "content-type": "application/json", origin: SITE_URL },
    body: JSON.stringify({ email: EMAIL }),
  });
}

function authError(code: string, status: number) {
  return new AuthApiError("message", status, code);
}

describe("POST /api/auth/otp logging", () => {
  it.each([
    ["otp_disabled", 422],
    ["over_email_send_rate_limit", 429],
  ])("logs the expected %s as info", async (code, status) => {
    signInWithOtp.mockResolvedValue({ error: authError(code, status) });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: true });
    expect(error).not.toHaveBeenCalled();
    expect(JSON.parse(info.mock.calls[0]?.[0] as string)).toMatchObject({
      level: "info",
      event: "otp_not_sent",
      code,
    });
  });

  it("logs an unexpected error code server-side without the email and replies identically", async () => {
    signInWithOtp.mockResolvedValue({ error: authError("email_provider_disabled", 422) });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: true });
    expect(error).toHaveBeenCalledTimes(1);
    const line = error.mock.calls[0]?.[0] as string;
    expect(JSON.parse(line)).toMatchObject({
      level: "error",
      event: "otp_unexpected_error",
      status: 422,
      code: "email_provider_disabled",
    });
    expect(line).not.toContain(EMAIL);
  });

  it("logs nothing on success", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(request());

    expect(await response.json()).toEqual({ sent: true });
    expect(info).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
