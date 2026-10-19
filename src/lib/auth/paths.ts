// Route access rules shared by src/proxy.ts and the auth screens.

export const LOGIN_PATH = "/login";
export const AGE_CONFIRMATION_PATH = "/age-confirmation";
export const HOME_PATH = "/home";

const PUBLIC_PATHS = new Set(["/", LOGIN_PATH]);

/** Pages anyone may open. Everything else the proxy sees requires a session. */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

/**
 * Returns `next` only if it is a same-site path (prevents open redirects),
 * otherwise the fallback.
 */
export function safeNextPath(next: string | null | undefined, fallback = HOME_PATH): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  try {
    // Reject anything that would resolve to another origin.
    const base = "http://internal.invalid";
    const url = new URL(next, base);
    if (url.origin !== base) return fallback;
    if (url.pathname === LOGIN_PATH) return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

export function loginPathFor(pathname: string, search = ""): string {
  const next = safeNextPath(`${pathname}${search}`, "");
  return next ? `${LOGIN_PATH}?next=${encodeURIComponent(next)}` : LOGIN_PATH;
}
