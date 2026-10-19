import { describe, expect, it } from "vitest";

import { buildCsp, createNonce } from "@/lib/security/csp";
import { securityHeaders } from "@/lib/security/headers";

describe("buildCsp", () => {
  it("is strict in production builds", () => {
    const csp = buildCsp({ nonce: "abc", isDev: false, upgradeInsecureRequests: true });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).toContain("style-src 'self' 'nonce-abc'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("allows eval and inline styles only in development", () => {
    const csp = buildCsp({ nonce: "abc", isDev: true, upgradeInsecureRequests: false });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});

describe("createNonce", () => {
  it("returns a fresh value each time", () => {
    expect(createNonce()).not.toBe(createNonce());
  });
});

describe("securityHeaders", () => {
  it("includes the headers required by docs/security.md §6", () => {
    const keys = securityHeaders.map((h) => h.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "Strict-Transport-Security",
        "X-Content-Type-Options",
        "Referrer-Policy",
        "Permissions-Policy",
      ]),
    );
  });
});
