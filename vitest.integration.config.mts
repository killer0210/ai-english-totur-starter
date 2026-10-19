import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const path = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Integration tests run against the local Supabase stack (`npm run db:start`).
export default defineConfig({
  resolve: {
    alias: {
      "@": path("./src"),
      // `server-only` throws outside a React Server bundle; route handlers are
      // imported directly here, so replace it with an empty module.
      "server-only": path("./tests/integration/support/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/integration/support/setup.ts"],
    // Tests share one database; run files one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
