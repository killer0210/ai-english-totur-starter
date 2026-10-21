import { conversationDeps } from "@/features/conversation/config";
import { turnResponse } from "@/features/conversation/responses";
import { idSchema, sendMessageSchema } from "@/features/conversation/schemas";
import { sendMessage } from "@/features/conversation/service";
import { requireUser } from "@/lib/auth/session";
import { AppError, defaultMessageMn } from "@/lib/errors";
import { mutation } from "@/lib/route";
import { createRouteClient } from "@/lib/supabase/route";

/** Sends a learner message and returns the AI reply (ADR-003). */
export const POST = mutation(
  sendMessageSchema,
  async (input, request, { params }: RouteContext<"/api/sessions/[id]/messages">) => {
    const { supabase, withCookies } = createRouteClient(request);
    const user = await requireUser(supabase);
    const id = idSchema.safeParse((await params).id);
    if (!id.success) throw new AppError("NOT_FOUND", defaultMessageMn("NOT_FOUND"), 404);
    const result = await sendMessage(conversationDeps(), {
      userId: user.id,
      sessionId: id.data,
      clientMessageId: input.clientMessageId,
      content: input.content,
    });
    return withCookies(turnResponse(result));
  },
);
