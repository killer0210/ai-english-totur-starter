import { NextResponse } from "next/server";

import { conversationConfig } from "@/features/conversation/config";
import { emptyBodySchema, idSchema } from "@/features/conversation/schemas";
import { complete } from "@/features/conversation/service";
import { requireUser } from "@/lib/auth/session";
import { AppError, defaultMessageMn } from "@/lib/errors";
import { mutation } from "@/lib/route";
import { createRouteClient } from "@/lib/supabase/route";

/** Ends the conversation (idempotent). Feedback is generated from M7. */
export const POST = mutation(
  emptyBodySchema,
  async (_input, request, { params }: RouteContext<"/api/sessions/[id]/complete">) => {
    const { supabase, withCookies } = createRouteClient(request);
    const user = await requireUser(supabase);
    const id = idSchema.safeParse((await params).id);
    if (!id.success) throw new AppError("NOT_FOUND", defaultMessageMn("NOT_FOUND"), 404);
    const session = await complete(conversationConfig(), { userId: user.id, sessionId: id.data });
    return withCookies(NextResponse.json({ session }));
  },
);
