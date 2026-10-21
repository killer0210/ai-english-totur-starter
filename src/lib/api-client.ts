import type { ErrorBody } from "./errors";

export type ApiResult<T> =
  | { ok: true; data: T }
  // error null = network failure; body = the parsed JSON response, if any.
  | { ok: false; error: ErrorBody["error"] | null; body: unknown };

/** Send JSON to our own API from client components. Same-origin, so the browser sends Origin. */
async function sendJson<T>(
  method: "POST" | "PATCH",
  url: string,
  body: unknown,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: null, body: null };
  }

  const json: unknown = await response.json().catch(() => null);
  if (response.ok) return { ok: true, data: json as T };
  const error = (json as Partial<ErrorBody> | null)?.error ?? null;
  return { ok: false, error, body: json };
}

export function postJson<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  return sendJson<T>("POST", url, body);
}

export function patchJson<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  return sendJson<T>("PATCH", url, body);
}
