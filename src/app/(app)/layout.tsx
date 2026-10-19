import { redirect } from "next/navigation";

import { LOGIN_PATH } from "@/lib/auth/paths";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// Every (app) page needs a session. src/proxy.ts already redirects; this is
// the server-side check that does not depend on the proxy matcher.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  if (!(await getSessionUser(await createClient()))) redirect(LOGIN_PATH);
  return children;
}
