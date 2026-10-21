import { z } from "zod";

// Validated configuration. Server and public (NEXT_PUBLIC_*) variables are
// parsed separately: public values are inlined into the browser bundle at
// build time, server values must never reach it. Variables for later
// milestones (Supabase, AI keys, limits) are added here when they are used.

export const APP_ENVS = ["local", "test", "staging", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

type EnvSource = Record<string, string | undefined>;

// Optional integer variable: unset or empty (as copied from .env.example) → default.
const optionalInt = (min: number, max: number, fallback: number) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().min(min).max(max).default(fallback),
  );

export const serverEnvSchema = z
  .object({
    // Fail closed: there is no default, an unset APP_ENV stops the app.
    APP_ENV: z.enum(APP_ENVS),
    AI_PROVIDER: z.string().trim().min(1),
    // Supabase secret key (maps to the service_role Postgres role). Server only.
    SUPABASE_SECRET_KEY: z.string().trim().min(1),
    // Total time budget for one AI reply (docs/trd.md §5). A pending message
    // older than twice this becomes reply_failed (lazy expiry, ADR-003).
    AI_REPLY_DEADLINE_MS: optionalInt(1000, 120_000, 25_000),
    // Learner messages per conversation (docs/prd.md FR-04).
    CONVERSATION_MAX_TURNS: optionalInt(1, 100, 20),
  })
  .refine((env) => !(env.APP_ENV === "production" && env.AI_PROVIDER === "mock"), {
    message: "AI_PROVIDER=mock is not allowed when APP_ENV=production",
    path: ["AI_PROVIDER"],
  });

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url({ protocol: /^https?$/ }),
  NEXT_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  // Supabase publishable key (maps to the anon/authenticated roles; RLS applies).
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type PublicEnv = z.infer<typeof publicEnvSchema>;

export class EnvValidationError extends Error {
  constructor(scope: "server" | "public", issues: z.core.$ZodIssue[]) {
    // Only variable names and rule messages — never the values, which may be secrets.
    const details = issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    super(`Invalid ${scope} environment: ${details}`);
    this.name = "EnvValidationError";
  }
}

export function parseServerEnv(source: EnvSource): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) throw new EnvValidationError("server", result.error.issues);
  return result.data;
}

export function parsePublicEnv(source: EnvSource): PublicEnv {
  const result = publicEnvSchema.safeParse(source);
  if (!result.success) throw new EnvValidationError("public", result.error.issues);
  return result.data;
}

let serverEnv: ServerEnv | undefined;
let publicEnv: PublicEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() must not be called in the browser");
  }
  serverEnv ??= parseServerEnv(process.env);
  return serverEnv;
}

export function getPublicEnv(): PublicEnv {
  // Each NEXT_PUBLIC_* variable must be referenced literally so Next.js can inline it.
  publicEnv ??= parsePublicEnv({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return publicEnv;
}
