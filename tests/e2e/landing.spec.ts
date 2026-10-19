import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __cspViolations: string[];
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      window.__cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
});

test("renders the Mongolian landing page", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "mn");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Англиар ярихаас бүү ай");
  await expect(page.getByRole("listitem")).toHaveCount(5);
});

test("has no horizontal overflow", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`has no critical or serious axe violations (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/");
    const results = await new AxeBuilder({ page }).analyze();
    const severe = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(severe.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}

test("sends the security headers", async ({ page }) => {
  const response = await page.goto("/");
  const headers = response?.headers() ?? {};

  const csp = headers["content-security-policy"] ?? "";
  expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(csp).not.toContain("unsafe-inline");
  expect(csp).not.toContain("unsafe-eval");
  expect(csp).toContain("frame-ancestors 'none'");

  expect(headers["strict-transport-security"]).toContain("max-age=");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("microphone=()");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("applies a fresh nonce to scripts and records no CSP violations", async ({ page }) => {
  const first = await page.goto("/");
  const nonce = first?.headers()["content-security-policy"]?.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toBeTruthy();

  const scriptNonces = await page.evaluate(() =>
    Array.from(document.querySelectorAll("script")).map((s) => s.nonce),
  );
  expect(scriptNonces.length).toBeGreaterThan(0);
  expect(new Set(scriptNonces)).toEqual(new Set([nonce]));

  await page.waitForLoadState("networkidle");
  expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);

  const second = await page.goto("/");
  const nextNonce = second?.headers()["content-security-policy"]?.match(/'nonce-([^']+)'/)?.[1];
  expect(nextNonce).not.toBe(nonce);
});

test("loads a font face covering Mongolian Ө and Ү", async ({ page }) => {
  await page.goto("/");
  const covered = await page.evaluate(async () => {
    await document.fonts.ready;
    // Ө = U+04E8, Ү = U+04AE; both inside the cyrillic-ext subset (U+0460–052F).
    return Array.from(document.fonts).some(
      (face) => face.status === "loaded" && /U\+460-52F/i.test(face.unicodeRange),
    );
  });
  expect(covered).toBe(true);
});
