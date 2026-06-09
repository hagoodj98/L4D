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
    await expect(page.locator(".forum-post-content").first()).toContainText(
      postText,
    );

    const postLikeButton = page.locator("button[id^='likeButton']").first();
    await postLikeButton.click();
    await expect(postLikeButton).toHaveClass(/reaction-color/);

    await page.reload();
    const targetPostCard = page
      .locator(".forum-post-card", { hasText: postText })
      .first();
    await expect(targetPostCard).toBeVisible();

    await targetPostCard.locator("button.reply").click();
    const replyTextarea = targetPostCard.locator(
      "div[id^='replyInputBox'] textarea[name='reply']",
    );
    await expect(replyTextarea).toBeVisible();
    await replyTextarea.fill(replyText);
    await expect(replyTextarea).toHaveValue(replyText);

    await page.goto("/logout");
    await expect(page).toHaveURL(/\/login$/);
  });
});
