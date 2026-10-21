import { conversationDeps } from "@/features/conversation/config";
import { turnResponse } from "@/features/conversation/responses";
import { emptyBodySchema, idSchema } from "@/features/conversation/schemas";
import { retryMessage } from "@/features/conversation/service";
import { requireUser } from "@/lib/auth/session";
import { AppError, defaultMessageMn } from "@/lib/errors";
import { mutation } from "@/lib/route";
import { createRouteClient } from "@/lib/supabase/route";

/** Asks again for the reply to a reply_failed learner message. */
export const POST = mutation(
  emptyBodySchema,
  async (
    _input,
    request,
    { params }: RouteContext<"/api/sessions/[id]/messages/[messageId]/retry">,
  ) => {
    const { supabase, withCookies } = createRouteClient(request);
    const user = await requireUser(supabase);
    const { id, messageId } = await params;
    const sessionId = idSchema.safeParse(id);
    const message = idSchema.safeParse(messageId);
    if (!sessionId.success || !message.success) {
      throw new AppError("NOT_FOUND", defaultMessageMn("NOT_FOUND"), 404);
    }
    const result = await retryMessage(conversationDeps(), {
      userId: user.id,
      sessionId: sessionId.data,
      messageId: message.data,
    });
    return withCookies(turnResponse(result));
  },
);
