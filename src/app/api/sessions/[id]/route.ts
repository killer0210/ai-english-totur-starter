import { type NextRequest, NextResponse } from "next/server";

import { conversationConfig } from "@/features/conversation/config";
import { getConversation } from "@/features/conversation/data";
import { idSchema, messagesPageSchema } from "@/features/conversation/schemas";
import { requireUser } from "@/lib/auth/session";
import { AppError, defaultMessageMn, withErrorHandling } from "@/lib/errors";
import { createRouteClient } from "@/lib/supabase/route";

/** A conversation and one page of its messages (?before=<seq>&limit=<n>). */
export const GET = withErrorHandling(
  async (request: NextRequest, { params }: RouteContext<"/api/sessions/[id]">) => {
    const { supabase, withCookies } = createRouteClient(request);
    await requireUser(supabase);
    const id = idSchema.safeParse((await params).id);
    const notFound = new AppError("NOT_FOUND", defaultMessageMn("NOT_FOUND"), 404);
    if (!id.success) throw notFound;
    const page = messagesPageSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const config = conversationConfig();
    const view = await getConversation(supabase, id.data, {
      ...page,
      maxTurns: config.maxTurns,
      staleMs: config.staleMs,
    });
    if (!view) throw notFound;
    return withCookies(NextResponse.json(view));
  },
);
