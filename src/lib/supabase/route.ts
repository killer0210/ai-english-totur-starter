import { type CookieOptions, createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

import { getPublicEnv } from "@/lib/env";

type PendingCookie = { name: string; value: string; options: CookieOptions };

/**
 * User-session client for Route Handlers, built from the incoming request so
 * handlers can be called directly in integration tests. Auth cookies written
 * by Supabase (sign-in, refresh, sign-out) are applied with `withCookies`.
 */
export function createRouteClient(request: NextRequest) {
  const env = getPublicEnv();
  const pending: PendingCookie[] = [];
  const cacheHeaders: Record<string, string> = {};

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const cookie of cookiesToSet) {
            request.cookies.set(cookie.name, cookie.value);
            pending.push(cookie);
          }
          // Responses that set auth cookies must not be cached.
          Object.assign(cacheHeaders, headers);
        },
      },
    },
  );

  function withCookies<T extends NextResponse>(response: T): T {
    for (const { name, value, options } of pending) response.cookies.set(name, value, options);
    for (const [key, value] of Object.entries(cacheHeaders)) response.headers.set(key, value);
    return response;
  }

  return { supabase, withCookies };
}
