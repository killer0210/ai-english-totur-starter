// Loads .env.local when present (CI sets the variables directly). Next.js
// skips .env.local when NODE_ENV=test, so it is read explicitly here.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local — rely on the process environment.
}

const required = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  throw new Error(
    `Integration tests need ${missing.join(", ")}. Start Supabase (npm run db:start) and run npm run db:env >> .env.local.`,
  );
}
