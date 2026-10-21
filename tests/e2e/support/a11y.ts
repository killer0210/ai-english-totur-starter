import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export async function expectNoSevereAxeViolations(page: Page) {
  for (const colorScheme of ["light", "dark"] as const) {
    // Reload so no light→dark color transition is mid-flight when axe runs.
    await page.emulateMedia({ colorScheme });
    await page.reload();
    const results = await new AxeBuilder({ page }).analyze();
    const severe = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(
      severe.map(
        (v) =>
          `${colorScheme} ${v.id}: ${v.nodes.map((n) => n.failureSummary ?? n.html).join(" | ")}`,
      ),
    ).toEqual([]);
  }
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}
