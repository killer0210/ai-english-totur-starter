import { NextResponse } from "next/server";

import { safeNextPath } from "@/lib/auth/paths";
import { otpVerifySchema } from "@/lib/auth/schemas";
import { AppError, defaultMessageMn } from "@/lib/errors";
import { mutation } from "@/lib/route";
import { createRouteClient } from "@/lib/supabase/route";

/** Verifies the emailed code; on success Supabase writes the session cookies. */
export const POST = mutation(otpVerifySchema, async ({ email, code, next }, request) => {
  const { supabase, withCookies } = createRouteClient(request);
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });

  if (error) {
    if (error.status === 429) {
      throw new AppError("TOO_MANY_REQUESTS", defaultMessageMn("TOO_MANY_REQUESTS"), 429, true);
    }
    throw new AppError("OTP_INVALID", defaultMessageMn("OTP_INVALID"), 400);
  }

  return withCookies(NextResponse.json({ redirectTo: safeNextPath(next) }));
});
