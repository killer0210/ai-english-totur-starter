// Syncs content/ (units.json, scenarios/*.json) into the database (D-11).
// Same script for local and hosted Supabase; idempotent, never deletes
// (src/features/path/content-sync.ts).
//
// Usage: npm run content:sync   (reads .env.local if present; hosted: set
// NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in the environment)
import { createClient } from "@supabase/supabase-js";

import { ContentError, loadContent, syncContent } from "../src/features/path/content-sync.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set.");
  process.exit(1);
}

try {
  const content = await loadContent("content");
  const drafts = [content.units, ...content.scenarios].filter((f) => f.review_status === "draft");
  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const changes = await syncContent(admin, content);
  for (const change of changes) console.log(change);
  console.log(
    `content: ${content.scenarios.length} scenarios, ${changes.length === 0 ? "no changes" : `${changes.length} changes`}`,
  );
  if (drafts.length > 0) {
    console.warn(
      `note: ${drafts.length} content files are review_status "draft" (not teacher-reviewed)`,
    );
  }
} catch (error) {
  console.error(error instanceof ContentError ? error.message : error);
  process.exit(1);
}
