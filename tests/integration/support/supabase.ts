import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

const noSession = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

export const env = {
  siteUrl: () => process.env.NEXT_PUBLIC_SITE_URL!,
  supabaseUrl: () => process.env.NEXT_PUBLIC_SUPABASE_URL!,
  publishableKey: () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  secretKey: () => process.env.SUPABASE_SECRET_KEY!,
};

export function adminClient(): SupabaseClient {
  return createClient(env.supabaseUrl(), env.secretKey(), { auth: noSession });
}

/** Client with the public (publishable) key — what a browser could use directly. */
export function anonClient(): SupabaseClient {
  return createClient(env.supabaseUrl(), env.publishableKey(), { auth: noSession });
}

export function uniqueEmail(label: string): string {
  return `int-${label}-${randomUUID().slice(0, 8)}@example.com`;
}

/**
 * Test-only user with a password so tests can sign in without the mail
 * catcher. (The app itself only offers email OTP.)
 */
export async function createUser(label: string) {
  const email = uniqueEmail(label);
  const password = `Pw-${randomUUID()}`;
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser returned no user");
  return { id: data.user.id, email, password };
}

export async function signedInClient(email: string, password: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

export async function deleteUser(id: string): Promise<void> {
  await adminClient().auth.admin.deleteUser(id);
}

export async function findUserByEmail(email: string) {
  const admin = adminClient();
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((u) => u.email === email);
    if (match || data.users.length < 1000) return match ?? null;
  }
}

export function jsonRequest(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(new URL(path, env.siteUrl()), {
    method: "POST",
    headers: { "content-type": "application/json", origin: env.siteUrl(), ...headers },
    body: JSON.stringify(body),
  });
}
