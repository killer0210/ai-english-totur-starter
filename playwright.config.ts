import { defineConfig, devices } from "@playwright/test";

// Local runs read Supabase keys from .env.local; CI sets them in the environment.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local.
}

// E2E_PORT lets a local run avoid a dev server already on :3000. The build must
// use the same NEXT_PUBLIC_SITE_URL (it is inlined at build time).
const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE_URL = `http://localhost:${PORT}`;

// Runs against the production build (`npm run build` first) and the local
// Supabase stack (`npm run db:start`).
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: BASE_URL,
    // Never reuse a server already on the port: it may be a dev server or a
    // stale build with other env. Playwright then fails with "<url> is already
    // used"; stop that server or pick another E2E_PORT.
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      ...(process.env as Record<string, string>),
      APP_ENV: "test",
      AI_PROVIDER: "mock",
      NEXT_PUBLIC_SITE_URL: BASE_URL,
    },
  },
});
