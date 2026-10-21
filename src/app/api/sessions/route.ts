import { type NextRequest, NextResponse } from "next/server";

import { decodeSessionsCursor, listSessions, startSession } from "@/features/conversation/data";
import { SESSIONS_PAGE_SIZE, startSessionSchema } from "@/features/conversation/schemas";
import { requireUser } from "@/lib/auth/session";
import { withErrorHandling } from "@/lib/errors";
import { mutation } from "@/lib/route";
import { createRouteClient } from "@/lib/supabase/route";

/** Past conversations, most recent activity first (?cursor= for the next page). */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const { supabase, withCookies } = createRouteClient(request);
  await requireUser(supabase);
  const cursor = decodeSessionsCursor(request.nextUrl.searchParams.get("cursor"));
  const page = await listSessions(supabase, { cursor, limit: SESSIONS_PAGE_SIZE });
  return withCookies(NextResponse.json(page));
});

/** Starts a conversation for a scenario (docs/app_flow.md §4). */
export const POST = mutation(startSessionSchema, async (input, request) => {
  const { supabase, withCookies } = createRouteClient(request);
  const user = await requireUser(supabase);
  const session = await startSession(user.id, input.scenarioId);
  return withCookies(NextResponse.json({ session }, { status: 201 }));
});
