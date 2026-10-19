import { NextResponse } from "next/server";

import { completeOnboarding } from "@/features/profile/data";
import { onboardingSchema } from "@/features/profile/schemas";
import { HOME_PATH } from "@/lib/auth/paths";
import { requireUser } from "@/lib/auth/session";
import { mutation } from "@/lib/route";
import { createRouteClient } from "@/lib/supabase/route";

/** Saves the onboarding answers and marks onboarding complete (docs/prd.md FR-02). */
export const POST = mutation(onboardingSchema, async (input, request) => {
  const { supabase, withCookies } = createRouteClient(request);
  const user = await requireUser(supabase);
  await completeOnboarding(user.id, input);
  return withCookies(NextResponse.json({ redirectTo: HOME_PATH }));
});
