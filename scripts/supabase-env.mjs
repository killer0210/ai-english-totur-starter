// Prints the app's Supabase env vars from the running local stack.
// Usage: node scripts/supabase-env.mjs >> .env.local   (or >> "$GITHUB_ENV" in CI)
//
// The exact field names printed by `supabase status -o json` for the new
// publishable/secret keys could not be confirmed from the docs (шалгах
// шаардлагатай), so several candidates are tried; legacy anon/service_role
// keys are accepted as a fallback because supabase-js treats them alike.
import { execFileSync } from "node:child_process";

const CANDIDATES = {
  NEXT_PUBLIC_SUPABASE_URL: ["API_URL", "api_url"],
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: [
    "PUBLISHABLE_KEY",
    "publishable_key",
    "ANON_KEY",
    "anon_key",
  ],
  SUPABASE_SECRET_KEY: ["SECRET_KEY", "secret_key", "SERVICE_ROLE_KEY", "service_role_key"],
  MAIL_CATCHER_URL: ["MAILPIT_URL", "mailpit_url", "INBUCKET_URL", "inbucket_url"],
};
const DEFAULTS = { MAIL_CATCHER_URL: "http://127.0.0.1:54324" };

const raw = execFileSync("npx", ["supabase", "status", "-o", "json"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});
const status = JSON.parse(raw.slice(raw.indexOf("{")));

const missing = [];
for (const [name, keys] of Object.entries(CANDIDATES)) {
  const field = keys.find((key) => typeof status[key] === "string" && status[key].length > 0);
  const value = field ? status[field] : DEFAULTS[name];
  if (!value) {
    missing.push(name);
    continue;
  }
  if (field && /ANON|SERVICE_ROLE/i.test(field)) {
    console.error(`note: ${name} uses legacy field ${field}`);
  }
  console.log(`${name}=${value}`);
}

if (missing.length > 0) {
  console.error(
    `Could not find ${missing.join(", ")} in \`supabase status -o json\`. Fields: ${Object.keys(status).join(", ")}`,
  );
  process.exit(1);
}
