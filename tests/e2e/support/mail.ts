// Reads the sign-in code from the local Supabase email catcher (port 54324).
// The CLI config calls it [local_smtp]; whether it serves the Mailpit or the
// Inbucket HTTP API could not be confirmed from the docs (шалгах шаардлагатай),
// so both are tried.

const BASE = process.env.MAIL_CATCHER_URL ?? "http://127.0.0.1:54324";
const CODE = /\b(\d{6})\b/;

async function fromMailpit(email: string): Promise<string | null> {
  const search = await fetch(`${BASE}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
  if (!search.ok) return null;
  const { messages } = (await search.json()) as { messages?: { ID: string }[] };
  const latest = messages?.[0];
  if (!latest) return null;
  const message = await fetch(`${BASE}/api/v1/message/${latest.ID}`);
  if (!message.ok) return null;
  const { Text, HTML } = (await message.json()) as { Text?: string; HTML?: string };
  return (Text ?? HTML ?? "").match(CODE)?.[1] ?? null;
}

async function fromInbucket(email: string): Promise<string | null> {
  const mailbox = email.split("@")[0] ?? email;
  const list = await fetch(`${BASE}/api/v1/mailbox/${encodeURIComponent(mailbox)}`);
  if (!list.ok) return null;
  const messages = (await list.json()) as { id: string }[];
  const latest = messages.at(-1);
  if (!latest) return null;
  const message = await fetch(`${BASE}/api/v1/mailbox/${encodeURIComponent(mailbox)}/${latest.id}`);
  if (!message.ok) return null;
  const { body } = (await message.json()) as { body?: { text?: string; html?: string } };
  return (body?.text ?? body?.html ?? "").match(CODE)?.[1] ?? null;
}

export async function waitForOtp(email: string, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const code =
      (await fromMailpit(email).catch(() => null)) ?? (await fromInbucket(email).catch(() => null));
    if (code) return code;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No sign-in code for ${email} at ${BASE} within ${timeoutMs} ms`);
}
