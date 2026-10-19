import { AppError, defaultMessageMn } from "./errors";

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF protection (docs/security.md §6): a state-changing request must carry
 * an Origin header equal to the site's own origin. A missing Origin is rejected.
 */
export function isAllowedOrigin(method: string, origin: string | null, siteUrl: string): boolean {
  if (!STATE_CHANGING_METHODS.has(method.toUpperCase())) return true;
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(siteUrl).origin;
  } catch {
    return false;
  }
}

export function assertAllowedOrigin(request: Request, siteUrl: string): void {
  if (!isAllowedOrigin(request.method, request.headers.get("origin"), siteUrl)) {
    throw new AppError("FORBIDDEN", defaultMessageMn("FORBIDDEN"), 403);
  }
}
