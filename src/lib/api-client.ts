import type { ErrorBody } from "./errors";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ErrorBody["error"] | null }; // null = network failure

/** POST JSON to our own API from client components. Same-origin, so the browser sends Origin. */
export async function postJson<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: null };
  }

  const json: unknown = await response.json().catch(() => null);
  if (response.ok) return { ok: true, data: json as T };
  const error = (json as Partial<ErrorBody> | null)?.error ?? null;
  return { ok: false, error };
}
