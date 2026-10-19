import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { waitForOtp } from "./support/mail";
import { deleteUser, inviteUser } from "./support/users";

test("an unauthenticated visit to a protected route redirects to /login", async ({ page }) => {
  await page.goto("/home");
  await expect(page).toHaveURL(/\/login\?next=%2Fhome$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Нэвтрэх");
});

test("the landing page links to /login", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Нэвтрэх" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`/login has no critical or serious axe violations (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/login");
    const results = await new AxeBuilder({ page }).analyze();
    const severe = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(severe.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}

test("an invalid email shows an inline error without sending", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Имэйл хаяг").fill("not-an-email");
  await page.getByRole("button", { name: "Код авах" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Имэйл хаягаа шалгаад дахин оруулна уу.",
  );
});

test("an invited user signs in with an email code, confirms 18+, and signs out", async ({
  page,
}, testInfo) => {
  const user = await inviteUser(testInfo.project.name);
  try {
    await page.goto("/login");
    await page.getByLabel("Имэйл хаяг").fill(user.email);
    await page.getByRole("button", { name: "Код авах" }).click();
    await expect(page.getByRole("status")).toContainText(user.email);

    const code = await waitForOtp(user.email);
    await page.getByLabel("6 оронтой код").fill(code);
    await page.getByRole("button", { name: "Нэвтрэх" }).click();

    // First sign-in: 18+ confirmation (docs/app_flow.md §2).
    await expect(page).toHaveURL(/\/age-confirmation$/);
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === "critical" || v.impact === "serious"),
    ).toEqual([]);
    await page.getByLabel("Би 18 ба түүнээс дээш настай").check();
    await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Тавтай морил!");

    await page.getByRole("button", { name: "Гарах" }).click();
    await expect(page).toHaveURL(/\/$/);

    // The session is gone: protected pages redirect again.
    await page.goto("/home");
    await expect(page).toHaveURL(/\/login\?next=%2Fhome$/);
  } finally {
    await deleteUser(user.id);
  }
});

test("a wrong code shows a recoverable error", async ({ page }, testInfo) => {
  const user = await inviteUser(`wrong-${testInfo.project.name}`);
  try {
    await page.goto("/login");
    await page.getByLabel("Имэйл хаяг").fill(user.email);
    await page.getByRole("button", { name: "Код авах" }).click();
    await waitForOtp(user.email);

    await page.getByLabel("6 оронтой код").fill("000000");
    await page.getByRole("button", { name: "Нэвтрэх" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Код таарахгүй");
    await expect(page.getByLabel("6 оронтой код")).toBeEnabled();
  } finally {
    await deleteUser(user.id);
  }
});
