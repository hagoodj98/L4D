import { expect, test } from "@playwright/test";

function uniqueSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

async function registerUser(page, username, email) {
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("secret123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/forum$/);
}

async function createNotificationScenario(browser, suffix) {
  const user1Name = `e2e-notif-user1-${suffix}`;
  const user97Name = `e2e-notif-user97-${suffix}`;
  const user1Email = `${user1Name}@example.com`;
  const user97Email = `${user97Name}@example.com`;
  const postText = `Notification post ${suffix}`;

  const user1Context = await browser.newContext();
  const user97Context = await browser.newContext();
  const user1Page = await user1Context.newPage();
  const user97Page = await user97Context.newPage();

  await registerUser(user1Page, user1Name, user1Email);

  const postResult = await user1Page.evaluate(
    async ({ postText }) => {
      const response = await fetch("/add-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPost: postText }),
      });

      return response.json();
    },
    { postText },
  );

  expect(postResult.success).toBe(true);
  const postId = String(postResult.post.id);

  await registerUser(user97Page, user97Name, user97Email);
  await user97Page.goto("/forum");

  const likeResponse = await user97Page.request.post("/post-reaction", {
    data: {
      post_id: postId,
      reaction_type: "like",
    },
  });

  expect(likeResponse.status()).toBe(200);

  return {
    user1Context,
    user97Context,
    user1Page,
    user97Page,
    user1Name,
    user97Name,
    postId,
    postText,
  };
}

async function waitForUnreadNotification(page) {
  await expect
    .poll(
      async () => {
        const text = await page.locator("#notificationCountText").textContent();
        return Number(text?.trim() || 0);
      },
      { timeout: 25_000 },
    )
    .toBeGreaterThan(0);
}

test.describe("Notification SSE flows", () => {
  test.describe.configure({ timeout: 60_000 });

  test("persists notification updates between two users", async ({
    browser,
  }) => {
    const suffix = uniqueSuffix();
    const { user1Context, user97Context, user1Page, user97Name, postId, postText } =
      await createNotificationScenario(browser, suffix);

    try {
      await waitForUnreadNotification(user1Page);

      const reloadedState = await user1Page.evaluate(async () => {
        const response = await fetch("/check-notifications-reloaded");
        return response.json();
      });

      expect(reloadedState.notifications.length).toBeGreaterThan(0);

      await user1Page.reload();
      await expect(user1Page.locator("#notificationCountText")).not.toHaveText(
        "",
      );
      await expect(user1Page.locator("#notificationsDropdown")).toContainText(
        user97Name,
      );
      await expect(
        user1Page.locator(".notification-link a .notification-source-post").first(),
      ).toHaveText(`"${postText.slice(0, 20)}..."`);
    } finally {
      await user1Context.close();
      await user97Context.close();
    }
  });

  test("marks notifications as read when the bell is clicked and keeps them read after refresh", async ({
    browser,
  }) => {
    const suffix = uniqueSuffix();
    const { user1Context, user97Context, user1Page, user97Name, postId, postText } =
      await createNotificationScenario(browser, suffix);

    try {
      await waitForUnreadNotification(user1Page);

      const notificationItems = user1Page.locator(".notification-link");
      await expect(notificationItems.first()).toHaveClass(/unread-indicator/);

      const readNotificationsRequest = user1Page.waitForResponse(
        (response) =>
          response.url().includes("/read-notifications") &&
          response.request().method() === "POST",
      );

      await user1Page.locator("button.bell-button").click();
      await readNotificationsRequest;

      await expect(user1Page.locator("#notificationCountText")).toHaveText("0");
      await expect(
        user1Page.locator("#notificationCountContainer"),
      ).toHaveClass(/notification-count-container-hidden/);

      await user1Page.reload();
      await expect(user1Page.locator("#notificationsDropdown")).toContainText(
        user97Name,
      );
      await expect(
        user1Page.locator(".notification-link a .notification-source-post").first(),
      ).toHaveText(`"${postText.slice(0, 20)}..."`);
      await expect(notificationItems.first()).not.toHaveClass(
        /unread-indicator/,
      );
      await expect(user1Page.locator("#notificationCountText")).toHaveText("");
      expect(postId).toBeTruthy();
    } finally {
      await user1Context.close();
      await user97Context.close();
    }
  });
});
