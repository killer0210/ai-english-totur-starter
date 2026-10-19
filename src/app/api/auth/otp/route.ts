import { otpRequestSchema } from "@/lib/auth/schemas";
import { AppError, defaultMessageMn } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { mutation } from "@/lib/route";
import { createRouteClient } from "@/lib/supabase/route";

// Supabase Auth error code for the per-IP request limit (applies to every
// email alike, so it does not reveal whether an account exists).
const IP_RATE_LIMIT_CODE = "over_request_rate_limit";
// Expected outcomes: email not invited (shouldCreateUser: false) and the
// per-email send limit. Anything else (e.g. email_provider_disabled) is a
// misconfiguration or outage and is logged as an error.
const EXPECTED_ERROR_CODES: ReadonlySet<string> = new Set([
  "otp_disabled",
  "over_email_send_rate_limit",
]);

/**
 * Sends a 6-digit sign-in code. Invite-only: `shouldCreateUser: false`, and
 * the answer is identical whether or not the email is invited.
 */
export const POST = mutation(otpRequestSchema, async ({ email }, request) => {
  const { supabase } = createRouteClient(request);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  if (error) {
    if (error.code === IP_RATE_LIMIT_CODE) {
      throw new AppError("TOO_MANY_REQUESTS", defaultMessageMn("TOO_MANY_REQUESTS"), 429, true);
    }
    // Not invited, per-email rate limit, or another Auth error: same reply as
    // success. Log only the error code — never the email.
    const meta = { status: error.status ?? null, code: error.code ?? null };
    if (error.code && EXPECTED_ERROR_CODES.has(error.code)) logger.info("otp_not_sent", meta);
    else logger.error("otp_unexpected_error", meta);
  }

  return Response.json({ sent: true });
});
