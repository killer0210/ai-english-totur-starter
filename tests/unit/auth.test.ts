import { describe, expect, it } from "vitest";

import { isPublicPath, loginPathFor, safeNextPath } from "@/lib/auth/paths";
import { ageConfirmationSchema, otpRequestSchema, otpVerifySchema } from "@/lib/auth/schemas";

describe("otpRequestSchema", () => {
  it("trims and lower-cases the email", () => {
    expect(otpRequestSchema.parse({ email: "  Anu@Example.COM " })).toEqual({
      email: "anu@example.com",
    });
  });

  it.each(["", "not-an-email", "a@", "@b.com", `${"x".repeat(250)}@example.com`])(
    "rejects %j",
    (email) => {
      expect(otpRequestSchema.safeParse({ email }).success).toBe(false);
    },
  );
});

describe("otpVerifySchema", () => {
  it("accepts a 6-digit code and strips spaces", () => {
    expect(otpVerifySchema.parse({ email: "a@b.com", code: "123 456" })).toEqual({
      email: "a@b.com",
      code: "123456",
    });
  });

  it.each(["12345", "1234567", "12a456", "", "١٢٣٤٥٦"])("rejects code %j", (code) => {
    expect(otpVerifySchema.safeParse({ email: "a@b.com", code }).success).toBe(false);
  });

  it("keeps an optional next path", () => {
    expect(otpVerifySchema.parse({ email: "a@b.com", code: "123456", next: "/home" }).next).toBe(
      "/home",
    );
  });
});

describe("ageConfirmationSchema", () => {
  it("requires confirmed: true", () => {
    expect(ageConfirmationSchema.safeParse({ confirmed: true }).success).toBe(true);
    expect(ageConfirmationSchema.safeParse({ confirmed: false }).success).toBe(false);
    expect(ageConfirmationSchema.safeParse({}).success).toBe(false);
  });
});

describe("isPublicPath", () => {
  it("allows only the landing and login pages without a session", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/home")).toBe(false);
    expect(isPublicPath("/age-confirmation")).toBe(false);
    expect(isPublicPath("/login/extra")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths with their query", () => {
    expect(safeNextPath("/home")).toBe("/home");
    expect(safeNextPath("/words?state=new")).toBe("/words?state=new");
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["absolute URL", "https://evil.example/home"],
    ["protocol-relative", "//evil.example"],
    ["backslash trick", "/\\evil.example"],
    ["relative path", "home"],
    ["the login page itself", "/login"],
  ])("falls back for %s", (_label, next) => {
    expect(safeNextPath(next)).toBe("/home");
  });
});

describe("loginPathFor", () => {
  it("encodes the requested path as next", () => {
    expect(loginPathFor("/home")).toBe("/login?next=%2Fhome");
    expect(loginPathFor("/words", "?q=go")).toBe("/login?next=%2Fwords%3Fq%3Dgo");
  });
});
