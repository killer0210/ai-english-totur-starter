import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { parsePublicEnv, parseServerEnv } from "./src/lib/env";
import { securityHeaders } from "./src/lib/security/headers";

// Fail fast: the config loads on `next dev`, `next build` and `next start`.
parseServerEnv(process.env);
parsePublicEnv(process.env);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // AGENTS.md is hand-written project guidance; stop `next dev` from appending to it.
  agentRules: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: [...securityHeaders] }];
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
