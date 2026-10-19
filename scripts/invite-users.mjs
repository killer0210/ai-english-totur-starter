// Invite-only pilot: creates Auth users so they can sign in with an email OTP.
// Public sign-up is disabled (supabase/config.toml), so this is the only way in.
// No email is sent here; invitees open /login and request a code themselves.
//
// Usage: node --env-file=.env.local scripts/invite-users.mjs alice@example.com bob@example.com
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const emails = process.argv
  .slice(2)
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

if (!url || !secretKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set.");
  process.exit(1);
}
if (emails.length === 0) {
  console.error("Usage: node --env-file=.env.local scripts/invite-users.mjs <email>...");
  process.exit(1);
}

const admin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let failed = 0;
for (const email of emails) {
  // email_confirm: the invite itself is the confirmation; the profile row is
  // created by the on_auth_user_created trigger.
  const { error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (!error) console.log(`invited: ${email}`);
  else if (error.code === "email_exists") console.log(`already invited: ${email}`);
  else {
    failed += 1;
    console.error(`failed: ${email} (${error.code ?? error.status})`);
  }
}
process.exit(failed > 0 ? 1 : 0);
