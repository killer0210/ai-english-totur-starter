import { NextResponse } from "next/server";

import { confirmAge } from "@/features/profile/data";
import { HOME_PATH } from "@/lib/auth/paths";
import { ageConfirmationSchema } from "@/lib/auth/schemas";
import { requireUser } from "@/lib/auth/session";
import { mutation } from "@/lib/route";
import { createRouteClient } from "@/lib/supabase/route";

/** Records the 18+ confirmation for the signed-in user (pilot is 18+ only). */
export const POST = mutation(ageConfirmationSchema, async (_input, request) => {
  const { supabase, withCookies } = createRouteClient(request);
  const user = await requireUser(supabase);
  await confirmAge(user.id);
  return withCookies(NextResponse.json({ redirectTo: HOME_PATH }));
});
