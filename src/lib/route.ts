import type { NextRequest } from "next/server";
import type { z } from "zod";

import { getPublicEnv } from "./env";
import { AppError, defaultMessageMn, withErrorHandling } from "./errors";
import { assertAllowedOrigin } from "./origin";

/**
 * Wrapper for every state-changing Route Handler:
 * Origin check (CSRF) → JSON body validated with Zod → handler → errors as JSON.
 * `context` is the Route Handler context (dynamic `params`), passed through.
 */
export function mutation<Schema extends z.ZodType, Context = unknown>(
  schema: Schema,
  handler: (input: z.infer<Schema>, request: NextRequest, context: Context) => Promise<Response>,
): (request: NextRequest, context?: Context) => Promise<Response> {
  return withErrorHandling(async (request: NextRequest, context?: Context) => {
    assertAllowedOrigin(request, getPublicEnv().NEXT_PUBLIC_SITE_URL);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_FAILED", defaultMessageMn("VALIDATION_FAILED"), 400);
    }
    // Next.js always passes the context; it is optional only for direct calls in tests.
    return handler(schema.parse(body), request, context as Context);
  });
}
