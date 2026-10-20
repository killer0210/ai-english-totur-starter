import { NextResponse } from "next/server";

import { safeNextPath } from "@/lib/auth/paths";
import { otpVerifySchema } from "@/lib/auth/schemas";
import { AppError, defaultMessageMn } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { mutation } from "@/lib/route";
import { createRouteClient } from "@/lib/supabase/route";

// Expected outcome: a wrong or expired code (Supabase Auth answers both with
// otp_expired). Anything else is a misconfiguration or outage and is logged
// as an error; the client still gets the same OTP_INVALID reply.
const EXPECTED_ERROR_CODES: ReadonlySet<string> = new Set(["otp_expired"]);

/** Verifies the emailed code; on success Supabase writes the session cookies. */
export const POST = mutation(otpVerifySchema, async ({ email, code, next }, request) => {
  const { supabase, withCookies } = createRouteClient(request);
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });

  if (error) {
    if (error.status === 429) {
      throw new AppError("TOO_MANY_REQUESTS", defaultMessageMn("TOO_MANY_REQUESTS"), 429, true);
    }
    // Log only the error code — never the email or the code.
    if (!error.code || !EXPECTED_ERROR_CODES.has(error.code)) {
      logger.error("verify_unexpected_error", {
        status: error.status ?? null,
        code: error.code ?? null,
      });
    }
    throw new AppError("OTP_INVALID", defaultMessageMn("OTP_INVALID"), 400);
  }

  return withCookies(NextResponse.json({ redirectTo: safeNextPath(next) }));
});
