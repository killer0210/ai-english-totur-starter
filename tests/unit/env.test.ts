import { describe, expect, it } from "vitest";

import { EnvValidationError, parsePublicEnv, parseServerEnv } from "@/lib/env";

const server = { APP_ENV: "local", AI_PROVIDER: "mock", SUPABASE_SECRET_KEY: "sb_secret_test" };
const publicVars = {
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};

describe("parseServerEnv", () => {
  it("accepts a valid local configuration", () => {
    expect(parseServerEnv(server)).toEqual(server);
  });

  it("fails closed when APP_ENV is unset or empty", () => {
    const withoutAppEnv = { ...server, APP_ENV: undefined };
    expect(() => parseServerEnv(withoutAppEnv)).toThrow(EnvValidationError);
    expect(() => parseServerEnv(withoutAppEnv)).toThrow(/APP_ENV/);
    expect(() => parseServerEnv({ ...server, APP_ENV: "" })).toThrow(/APP_ENV/);
  });

  it("rejects missing variables and names them", () => {
    expect(() => parseServerEnv({})).toThrow(/APP_ENV/);
    expect(() => parseServerEnv({ ...server, AI_PROVIDER: undefined })).toThrow(/AI_PROVIDER/);
    expect(() => parseServerEnv({ ...server, SUPABASE_SECRET_KEY: undefined })).toThrow(
      /SUPABASE_SECRET_KEY/,
    );
  });

  it("rejects an unknown APP_ENV", () => {
    expect(() => parseServerEnv({ ...server, APP_ENV: "prod" })).toThrow(/APP_ENV/);
  });

  it("rejects an empty AI_PROVIDER", () => {
    expect(() => parseServerEnv({ ...server, AI_PROVIDER: "  " })).toThrow(/AI_PROVIDER/);
  });

  it("fails when the mock provider is used in production", () => {
    expect(() => parseServerEnv({ ...server, APP_ENV: "production" })).toThrow(
      /AI_PROVIDER=mock is not allowed when APP_ENV=production/,
    );
  });

  it.each(["local", "test", "staging"])("allows the mock provider when APP_ENV=%s", (appEnv) => {
    expect(parseServerEnv({ ...server, APP_ENV: appEnv }).AI_PROVIDER).toBe("mock");
  });

  it("allows a real provider in production", () => {
    expect(parseServerEnv({ ...server, APP_ENV: "production", AI_PROVIDER: "real" }).APP_ENV).toBe(
      "production",
    );
  });

  it("does not echo variable values in the error message", () => {
    const secret = "sk-should-not-leak";
    expect(() => parseServerEnv({ ...server, APP_ENV: secret })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining(secret) }),
    );
  });
});

describe("parsePublicEnv", () => {
  it("accepts valid public variables", () => {
    expect(parsePublicEnv(publicVars)).toEqual(publicVars);
  });

  it("rejects a missing or non-http site URL", () => {
    expect(() => parsePublicEnv({ ...publicVars, NEXT_PUBLIC_SITE_URL: undefined })).toThrow(
      /NEXT_PUBLIC_SITE_URL/,
    );
    expect(() => parsePublicEnv({ ...publicVars, NEXT_PUBLIC_SITE_URL: "not a url" })).toThrow(
      EnvValidationError,
    );
    expect(() =>
      parsePublicEnv({ ...publicVars, NEXT_PUBLIC_SITE_URL: "javascript:alert(1)" }),
    ).toThrow(EnvValidationError);
  });

  it("requires the Supabase URL and publishable key", () => {
    expect(() => parsePublicEnv({ ...publicVars, NEXT_PUBLIC_SUPABASE_URL: undefined })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
    expect(() =>
      parsePublicEnv({ ...publicVars, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "" }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  });

  it("validates separately from server variables", () => {
    // The secret key is never part of the public schema.
    expect(parsePublicEnv({ ...publicVars, SUPABASE_SECRET_KEY: "x" })).not.toHaveProperty(
      "SUPABASE_SECRET_KEY",
    );
  });
});
