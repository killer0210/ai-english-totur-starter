import { expect, type Locator, type Page, test } from "@playwright/test";

import { expectNoHorizontalOverflow, expectNoSevereAxeViolations } from "./support/a11y";
import { signInWithOtp } from "./support/auth";
import { createSessionFor, deleteUser, inviteUser, setProfile } from "./support/users";

// M5: conversation with the mock AI (docs/testing.md §4 E5; E2 without
// feedback). Every action is done with the keyboard: focus, then Enter.

const SCENARIO = "Шинэ ангийнхантайгаа танилцах";
const INTRO = "Hi! I'm Emma. I'm new in this class. What's your name?";

async function press(locator: Locator) {
  await locator.focus();
  await locator.press("Enter");
}

async function type(page: Page, text: string) {
  const input = page.getByLabel("Англиар бичих");
  await input.focus();
  await page.keyboard.type(text);
}

async function sendMessage(page: Page, text: string) {
  await type(page, text);
  await press(page.getByRole("button", { name: "Илгээх" }));
}

const log = (page: Page) => page.getByRole("list", { name: "Яриа" });

async function signInOnboarded(page: Page, label: string) {
  const user = await inviteUser(label);
  await setProfile(user.id, {
    age_confirmed_at: new Date().toISOString(),
    onboarding_completed_at: new Date().toISOString(),
    english_level: "A1",
  });
  await signInWithOtp(page, user.email);
  await expect(page).toHaveURL(/\/home$/);
  return user;
}

async function startFromPath(page: Page) {
  await press(page.getByRole("navigation").getByRole("link", { name: "Зам" }));
  await expect(page).toHaveURL(/\/path$/);
  const card = page.getByRole("article").filter({ hasText: SCENARIO });
  await press(card.getByRole("button", { name: "Яриа эхлүүлэх" }));
  await expect(page).toHaveURL(/\/talk\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(SCENARIO);
  await expect(log(page)).toContainText(INTRO);
}

test("start a scenario, talk, recover from an AI error with Retry, and complete", async ({
  page,
}, testInfo) => {
  const user = await signInOnboarded(page, `talk-${testInfo.project.name}`);
  try {
    await startFromPath(page);
    await expectNoSevereAxeViolations(page);
    await expectNoHorizontalOverflow(page);

    await sendMessage(page, "Hi Emma, my name is Bat.");
    await expect(log(page)).toContainText("Mock reply 1");
    await sendMessage(page, "I like music and football.");
    await expect(log(page)).toContainText("Mock reply 2");
    await expect(page.getByText("2/20 мессеж")).toBeVisible();

    // The mock provider fails this message once: saved, no reply, composer locked.
    await sendMessage(page, "[mock:fail-once] I am from Ulaanbaatar.");
    await expect(log(page)).toContainText("Таны мессеж хадгалагдсан. Хариу ирсэнгүй.");
    await expect(page.getByLabel("Англиар бичих")).toBeDisabled();
    await expect(page.getByText("«Дахин оролдох»-оор аваад үргэлжлүүлээрэй")).toBeVisible();

    // After a reload the saved state comes from the server; axe on the error state.
    await expectNoSevereAxeViolations(page);
    await expect(log(page)).toContainText("Таны мессеж хадгалагдсан. Хариу ирсэнгүй.");

    await press(page.getByRole("button", { name: "Дахин оролдох" }));
    await expect(log(page)).toContainText("Mock reply 3");
    await expect(page.getByText("Таны мессеж хадгалагдсан. Хариу ирсэнгүй.")).toHaveCount(0);
    await expect(page.getByLabel("Англиар бичих")).toBeEnabled();

    await press(page.getByRole("button", { name: "Дуусгах" }));
    const done = page.getByRole("status").filter({ hasText: "Энэ яриа дууссан." });
    await expect(done).toContainText("Ярианы дараах feedback удахгүй нэмэгдэнэ.");
    await expect(done).toBeFocused();
    await expect(page.getByLabel("Англиар бичих")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await press(page.getByRole("link", { name: "Сургалтын зам руу" }));
    await expect(page.getByRole("article").filter({ hasText: SCENARIO })).toContainText("Хийсэн");

    await press(page.getByRole("navigation").getByRole("link", { name: "Яриа" }));
    await expect(page).toHaveURL(/\/history$/);
    const item = page.getByRole("article").filter({ hasText: SCENARIO });
    await expect(item).toContainText("Дууссан");
    await expect(item).toContainText("3 мессеж");
    await expectNoSevereAxeViolations(page);
  } finally {
    await deleteUser(user.id);
  }
});

test("completing with fewer than 3 messages warns first and then ends without feedback", async ({
  page,
}, testInfo) => {
  const user = await signInOnboarded(page, `talk-short-${testInfo.project.name}`);
  try {
    await startFromPath(page);
    await sendMessage(page, "Hello!");
    await expect(log(page)).toContainText("Mock reply 1");

    await press(page.getByRole("button", { name: "Дуусгах" }));
    const dialog = page.getByRole("dialog", {
      name: "Feedback авахын тулд дор хаяж 3 мессеж бичнэ үү",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Үргэлжлүүлэх" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await expect(page.getByLabel("Англиар бичих")).toBeEnabled();

    await press(page.getByRole("button", { name: "Дуусгах" }));
    await press(dialog.getByRole("button", { name: "Feedback-гүйгээр дуусгах" }));
    await expect(page.getByRole("status").filter({ hasText: "Энэ яриа дууссан." })).toContainText(
      "3-аас цөөн мессежтэй тул энэ ярианд feedback байхгүй.",
    );

    // Unfinished vs. finished in the history list.
    await press(page.getByRole("link", { name: "Өмнөх яриа" }));
    await expect(page.getByRole("article").filter({ hasText: SCENARIO })).toContainText("Дууссан");
  } finally {
    await deleteUser(user.id);
  }
});

test("another user's session, or an unknown id, shows not found (E6)", async ({
  page,
}, testInfo) => {
  const owner = await inviteUser(`talk-owner-${testInfo.project.name}`);
  const user = await signInOnboarded(page, `talk-404-${testInfo.project.name}`);
  try {
    const foreign = await createSessionFor(owner.id, "introduce-yourself");
    for (const id of [foreign, "00000000-0000-4000-8000-000000000000", "not-a-uuid"]) {
      await page.goto(`/talk/${id}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Яриа олдсонгүй");
      await expect(page.getByText(INTRO)).toHaveCount(0);
    }
  } finally {
    await deleteUser(user.id);
    await deleteUser(owner.id);
  }
});
