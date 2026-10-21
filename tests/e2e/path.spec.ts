import { expect, type Page, test } from "@playwright/test";

import { expectNoHorizontalOverflow, expectNoSevereAxeViolations } from "./support/a11y";
import { signInWithOtp } from "./support/auth";
import { deleteUser, inviteUser, setProfile } from "./support/users";

const A1_TITLES = [
  "Шинэ ангийнхантайгаа танилцах",
  "Кафед уух юм захиалах",
  "Дэлгүүрээс юм худалдаж авах",
  "Зам асуух",
];
const B1_TITLES = [
  "Ажлын ярилцлага",
  "Нислэг хойшилсон үед",
  "Солилцооны хөтөлбөрийн ярилцлага",
  "Хурал дээр санал бодлоо хэлэх",
];

async function expectPath(page: Page, level: string, titles: string[]) {
  await expect(page).toHaveURL(/\/path$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Сургалтын зам");
  await expect(page.getByText(`Таны түвшин: ${level}.`)).toBeVisible();
  const cards = page.getByRole("main").getByRole("article");
  await expect(cards.getByRole("heading", { level: 3 })).toHaveText(titles);
  // The first scenario is "next"; no locks: every card has its own start button.
  await expect(page.getByRole("main").getByText("Дараагийн")).toHaveCount(1);
  await expect(cards.first()).toContainText("Дараагийн");
  await expect(cards.getByRole("link")).toHaveCount(0);
  await expect(cards.getByRole("button", { name: "Яриа эхлүүлэх" })).toHaveCount(titles.length);
}

test("an onboarded user sees the path for their level; changing the level in settings changes it", async ({
  page,
}, testInfo) => {
  const user = await inviteUser(`path-${testInfo.project.name}`);
  try {
    await setProfile(user.id, {
      age_confirmed_at: new Date().toISOString(),
      onboarding_completed_at: new Date().toISOString(),
      english_level: "A1",
    });
    await signInWithOtp(page, user.email);
    await expect(page).toHaveURL(/\/home$/);

    await page.getByRole("link", { name: "Сургалтын зам руу орох" }).click();
    await expectPath(page, "A1", A1_TITLES);
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Бүлэг 1. Өдөр тутмын анхны яриа",
    ]);
    await expectNoSevereAxeViolations(page);
    await expectNoHorizontalOverflow(page);

    await page.getByRole("link", { name: "тохиргооноос" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await page.getByRole("radio", { name: /^B1/ }).check();
    await page.getByRole("button", { name: "Хадгалах" }).click();
    await expect(page.getByText("Хадгалагдлаа.")).toBeVisible();

    await page.getByRole("navigation").getByRole("link", { name: "Зам" }).click();
    await expectPath(page, "B1", B1_TITLES);
    for (const title of A1_TITLES) await expect(page.getByText(title)).toHaveCount(0);
  } finally {
    await deleteUser(user.id);
  }
});

test("a signed-out visitor is sent to /login from /path", async ({ page }) => {
  await page.goto("/path");
  await expect(page).toHaveURL(/\/login\?next=%2Fpath$/);
});
