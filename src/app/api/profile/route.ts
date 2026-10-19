import { NextResponse } from "next/server";

import { updateProfile } from "@/features/profile/data";
import { profileUpdateSchema } from "@/features/profile/schemas";
import { requireUser } from "@/lib/auth/session";
import { mutation } from "@/lib/route";
import { createRouteClient } from "@/lib/supabase/route";

/** Settings: level, goals, daily minutes, speaking confidence (docs/prd.md FR-09). */
export const PATCH = mutation(profileUpdateSchema, async (input, request) => {
  const { supabase, withCookies } = createRouteClient(request);
  const user = await requireUser(supabase);
  const profile = await updateProfile(user.id, input);
  return withCookies(NextResponse.json({ profile }));
});
