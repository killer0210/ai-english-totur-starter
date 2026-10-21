import { createClient } from "@supabase/supabase-js";

import { loadContent, syncContent } from "../../src/features/path/content-sync.ts";

// The path pages need content in the database: sync content/ exactly as
// `npm run content:sync` does (idempotent; usually no changes).
export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("E2E needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY");
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await syncContent(admin, await loadContent("content"));
}
