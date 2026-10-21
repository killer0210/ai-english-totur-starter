import "server-only";

import { getServerEnv } from "@/lib/env";

import type { AiProvider } from "./adapter";
import { createMockProvider } from "./providers/mock";

let provider: AiProvider | undefined;

/** The provider selected by AI_PROVIDER. Only "mock" exists until M6. */
export function getAiProvider(): AiProvider {
  if (provider) return provider;
  const env = getServerEnv();
  if (env.AI_PROVIDER !== "mock") {
    throw new Error(`Unsupported AI_PROVIDER "${env.AI_PROVIDER}" (only "mock" until M6)`);
  }
  provider = createMockProvider(env.APP_ENV);
  return provider;
}
