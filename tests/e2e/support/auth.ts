import { expect, type Page } from "@playwright/test";

import { waitForOtp } from "./mail";

/** Signs in through /login with the emailed 6-digit code. */
export async function signInWithOtp(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Имэйл хаяг").fill(email);
  await page.getByRole("button", { name: "Код авах" }).click();
  await expect(page.getByRole("status")).toContainText(email);

  const code = await waitForOtp(email);
  await page.getByLabel("6 оронтой код").fill(code);
  await page.getByRole("button", { name: "Нэвтрэх" }).click();
}
