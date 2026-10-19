import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import { assertAllowedOrigin, isAllowedOrigin } from "@/lib/origin";

const SITE = "http://localhost:3000";

describe("isAllowedOrigin", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE", "post"])(
    "accepts the site origin for %s",
    (method) => {
      expect(isAllowedOrigin(method, "http://localhost:3000", SITE)).toBe(true);
    },
  );

  it("rejects a missing Origin on state-changing requests", () => {
    expect(isAllowedOrigin("POST", null, SITE)).toBe(false);
  });

  it.each([
    ["another host", "https://evil.example"],
    ["another port", "http://localhost:3001"],
    ["another scheme", "https://localhost:3000"],
    ["a lookalike subdomain", "http://localhost:3000.evil.example"],
    ["the literal null origin", "null"],
    ["garbage", "not a url"],
  ])("rejects %s", (_label, origin) => {
    expect(isAllowedOrigin("POST", origin, SITE)).toBe(false);
  });

  it("ignores a trailing path on the configured site URL", () => {
    expect(isAllowedOrigin("POST", "https://app.example", "https://app.example/base/")).toBe(true);
  });

  it.each(["GET", "HEAD", "OPTIONS"])("does not require an Origin for %s", (method) => {
    expect(isAllowedOrigin(method, null, SITE)).toBe(true);
  });
});

describe("assertAllowedOrigin", () => {
  it("throws a 403 AppError for a cross-site POST", () => {
    const request = new Request(`${SITE}/api/x`, {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });
    expect(() => assertAllowedOrigin(request, SITE)).toThrow(
      expect.objectContaining({ code: "FORBIDDEN", status: 403 }),
    );
    expect(() => assertAllowedOrigin(request, SITE)).toThrow(AppError);
  });

  it("passes a same-origin POST", () => {
    const request = new Request(`${SITE}/api/x`, { method: "POST", headers: { origin: SITE } });
    expect(() => assertAllowedOrigin(request, SITE)).not.toThrow();
  });
});
