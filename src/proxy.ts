import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { isPublicPath, loginPathFor } from "@/lib/auth/paths";
import { getPublicEnv } from "@/lib/env";
import { buildCsp, createNonce } from "@/lib/security/csp";

/**
 * Runs on every page request: per-request CSP nonce, Supabase session
 * refresh (Supabase SSR guide), and redirect to /login for protected pages.
 * API routes are excluded by the matcher and check auth themselves (401).
 */
export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const appEnv = process.env.APP_ENV;
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV === "development",
    // Local and CI runs are served over plain http.
    upgradeInsecureRequests: appEnv === "staging" || appEnv === "production",
  });

  const forward = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    return NextResponse.next({ request: { headers } });
  };

  let response = forward();
  const env = getPublicEnv();
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = forward();
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims() (Supabase SSR guide).
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (!signedIn && !isPublicPath(request.nextUrl.pathname)) {
    const redirect = NextResponse.redirect(
      new URL(loginPathFor(request.nextUrl.pathname, request.nextUrl.search), request.url),
    );
    // Keep any cookies Supabase just wrote (e.g. a cleared expired session).
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
