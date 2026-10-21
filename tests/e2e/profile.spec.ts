import { expect, type Page, test } from "@playwright/test";

import { expectNoHorizontalOverflow, expectNoSevereAxeViolations } from "./support/a11y";
import { signInWithOtp } from "./support/auth";
import { deleteUser, inviteUser, readProfile, setProfile } from "./support/users";

/** Presses Tab until the named button has focus (keyboard only). */
async function tabToButton(page: Page, name: string) {
  const target = page.getByRole("button", { name });
  for (let i = 0; i < 12; i += 1) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

test("onboarding works with the keyboard only and passes axe", async ({ page }, testInfo) => {
  const user = await inviteUser(`kbd-${testInfo.project.name}`);
  try {
    await setProfile(user.id, { age_confirmed_at: new Date().toISOString() });
    await signInWithOtp(page, user.email);
    await expect(page).toHaveURL(/\/onboarding$/);

    await expectNoSevereAxeViolations(page);
    await expectNoHorizontalOverflow(page);

    // Step 1: goals (checkboxes) — Tab to the first option, Space to check it.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("checkbox", { name: "Ажил" })).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page.getByRole("checkbox", { name: "Ажил" })).toBeChecked();
    await tabToButton(page, "Үргэлжлүүлэх");
    await page.keyboard.press("Enter");

    // Step 2: daily minutes (radio group, default 10) — arrow to 20.
    await expect(page.getByText("Алхам 2/4")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("radio", { name: "10 минут" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("radio", { name: "20 минут" })).toBeChecked();
    await tabToButton(page, "Үргэлжлүүлэх");
    await page.keyboard.press("Enter");

    // Step 3: level (default A2) — arrow to B1; the descriptions are visible.
    await expect(page.getByText("Алхам 3/4")).toBeFocused();
    await expect(page.getByText("Танил сэдвээр харьцангуй чөлөөтэй ярьж")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("radio", { name: /^A2/ })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("radio", { name: /^B1/ })).toBeChecked();
    await tabToButton(page, "Үргэлжлүүлэх");
    await page.keyboard.press("Enter");

    // Step 4: confidence (default 3) — arrow to 4, then finish.
    await expect(page.getByText("Алхам 4/4")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("radio", { name: /^3/ })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("radio", { name: /^4/ })).toBeChecked();
    await tabToButton(page, "Дуусгах");
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/home$/);
    expect(await readProfile(user.id)).toMatchObject({
      goals: ["work"],
      daily_minutes_goal: 20,
      english_level: "B1",
      baseline_confidence: 4,
    });
  } finally {
    await deleteUser(user.id);
  }
});

test("settings open from the header, pass axe, and changes persist after reload", async ({
  page,
}, testInfo) => {
  const user = await inviteUser(`settings-${testInfo.project.name}`);
  try {
    await setProfile(user.id, {
      age_confirmed_at: new Date().toISOString(),
      onboarding_completed_at: new Date().toISOString(),
      baseline_confidence: 3,
    });
    await signInWithOtp(page, user.email);
    await expect(page).toHaveURL(/\/home$/);

    await page.getByRole("link", { name: "Тохиргоо" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Тохиргоо");
    await expectNoSevereAxeViolations(page);
    await expectNoHorizontalOverflow(page);

    await page.getByRole("radio", { name: /^B1/ }).check();
    await page.getByRole("checkbox", { name: "Аялал" }).check();
    await page.getByRole("radio", { name: "5 минут" }).check();
    await page.getByRole("radio", { name: /^5 —/ }).check();
    await page.getByRole("button", { name: "Хадгалах" }).click();
    await expect(page.getByText("Хадгалагдлаа.")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("radio", { name: /^B1/ })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Аялал" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "5 минут" })).toBeChecked();
    await expect(page.getByRole("radio", { name: /^5 —/ })).toBeChecked();
    expect(await readProfile(user.id)).toMatchObject({
      english_level: "B1",
      goals: ["travel"],
      daily_minutes_goal: 5,
      baseline_confidence: 5,
    });

    // Settings are still behind onboarding: no redirect back to it.
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/home$/);
  } finally {
    await deleteUser(user.id);
  }
});

test("a signed-in user who has not onboarded is sent to /onboarding from Home and Settings", async ({
  page,
}, testInfo) => {
  const user = await inviteUser(`gate-${testInfo.project.name}`);
  try {
    await setProfile(user.id, { age_confirmed_at: new Date().toISOString() });
    await signInWithOtp(page, user.email);
    await expect(page).toHaveURL(/\/onboarding$/);
    for (const path of ["/home", "/settings"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/onboarding$/);
    }
  } finally {
    await deleteUser(user.id);
  }
});
