import { type NextRequest, NextResponse } from "next/server";

import { buildCsp, createNonce } from "@/lib/security/csp";

/** Runs on every page request: per-request CSP nonce (Next.js CSP guide). */
export function proxy(request: NextRequest) {
  const nonce = createNonce();
  const appEnv = process.env.APP_ENV;
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV === "development",
    // Local and CI runs are served over plain http.
    upgradeInsecureRequests: appEnv === "staging" || appEnv === "production",
  });

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
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
