import type { NextRequest } from "next/server";
import type { z } from "zod";

import { getPublicEnv } from "./env";
import { AppError, defaultMessageMn, withErrorHandling } from "./errors";
import { assertAllowedOrigin } from "./origin";

/**
 * Wrapper for every state-changing Route Handler:
 * Origin check (CSRF) → JSON body validated with Zod → handler → errors as JSON.
 */
export function mutation<Schema extends z.ZodType>(
  schema: Schema,
  handler: (input: z.infer<Schema>, request: NextRequest) => Promise<Response>,
): (request: NextRequest) => Promise<Response> {
  return withErrorHandling(async (request: NextRequest) => {
    assertAllowedOrigin(request, getPublicEnv().NEXT_PUBLIC_SITE_URL);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("VALIDATION_FAILED", defaultMessageMn("VALIDATION_FAILED"), 400);
    }
    return handler(schema.parse(body), request);
  });
}
