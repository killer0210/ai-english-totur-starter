import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // docs/code_style.md §12: no console.log in production code — use src/lib/logger.ts.
      "no-console": ["error", { allow: ["info", "warn", "error"] }],
      // ADR-005: the service-role client may only be used from feature data modules.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase/admin",
              message: "Service-role writes belong in src/features/<name>/data.ts (ADR-005).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/features/*/data.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    files: ["scripts/**"],
    rules: { "no-console": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
