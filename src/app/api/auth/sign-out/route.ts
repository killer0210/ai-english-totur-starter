import { NextResponse } from "next/server";
import { z } from "zod";

import { logger } from "@/lib/logger";
import { mutation } from "@/lib/route";
import { createRouteClient } from "@/lib/supabase/route";

/** Signs out this device and clears the session cookies. */
export const POST = mutation(z.object({}), async (_input, request) => {
  const { supabase, withCookies } = createRouteClient(request);
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) logger.warn("sign_out_failed", { status: error.status ?? null });
  return withCookies(NextResponse.json({ signedOut: true }));
});
