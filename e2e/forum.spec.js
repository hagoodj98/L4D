import { expect, test } from "@playwright/test";

// Covers authenticated forum journey: register, create content, react, reply, and logout.

function uniqueSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

test.describe("Forum authenticated flows", () => {
  test("authenticated user can register, post, react, reply, and logout", async ({
    page,
  }) => {
    const suffix = uniqueSuffix();
    const username = `e2e-user-${suffix}`;
    const email = `e2e-${suffix}@example.com`;
    const password = "secret123";
    const postText = `E2E post ${suffix}`;
    const replyText = `E2E reply ${suffix}`;

    await page.goto("/register");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/forum$/);
    await expect(page.getByText("Welcome to the forum")).toBeVisible();

    await page.locator("textarea[name='newPost']").fill(postText);
    await page.getByRole("button", { name: "Submit Post" }).click();
    await expect(page).toHaveURL(/\/forum$/);
    await expect(page.getByText(postText)).toBeVisible();

    const postLikeButton = page.locator("button[id^='likeButton']").first();
    await postLikeButton.click();
    await expect(page).toHaveURL(/\/forum$/);
    await expect(page.locator("button[id^='likeButton']").first()).toHaveClass(
      /reaction-color/,
    );

    await page.locator("button[id^='replyButton']").first().click();
    await page
      .locator("div[id^='replyInputBox'] textarea[name='reply']")
      .first()
      .fill(replyText);
    await page
      .locator("div[id^='replyInputBox'] button[type='submit']")
      .first()
      .click();

    await expect(page).toHaveURL(/\/forum$/);
    await page.locator("button[id^='commentButton']").first().click();
    await expect(page.getByText(replyText)).toBeVisible();

    await page.goto("/logout");
    await expect(page).toHaveURL(/\/login$/);
  });
});
