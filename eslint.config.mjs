import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ADR-005: the service-role client may only be used from feature data modules.
const adminImport = {
  name: "@/lib/supabase/admin",
  message: "Service-role writes belong in src/features/<name>/data.ts (ADR-005).",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // docs/code_style.md §12: no console.log in production code — use src/lib/logger.ts.
      "no-console": ["error", { allow: ["info", "warn", "error"] }],
      "no-restricted-imports": [
        "error",
        {
          paths: [adminImport],
          patterns: [
            {
              group: ["**/ai/providers/anthropic*", "**/ai/providers/openai*"],
              message:
                "Real AI providers are used only by the provider eval until M6 wires the chosen one (Q-12).",
            },
          ],
        },
      ],
    },
  },
  {
    // The provider eval (npm run eval:providers) and its tests may use them.
    files: ["scripts/**", "tests/**"],
    rules: { "no-restricted-imports": ["error", { paths: [adminImport] }] },
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
