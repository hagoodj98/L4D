import { expect, test } from "@playwright/test";

// Covers authenticated forum journey: register, create content, react, reply, and logout.

function uniqueSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function firstTierRepliesButton(page, id) {
  return page
    .locator(
      `button#postcommentButton-${id}[onclick*="showAllReplies(${id}, true, false"]`,
    )
    .first();
}

function secondTierRepliesButton(page, id) {
  return page
    .locator(
      `button#commentButton-${id}[onclick*="showAllReplies(${id}, false, false"]`,
    )
    .first();
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

    await page.reload();
    const targetPostCard = page
      .locator(".forum-post-card", { hasText: postText })
      .first();
    await expect(targetPostCard).toBeVisible();

    await targetPostCard.locator("button.reply").click();
    const replyTextarea = targetPostCard.locator(
      "div[id^='create-comment-for-post'] textarea[name='reply']",
    );
    await expect(replyTextarea).toBeVisible();
    await replyTextarea.fill(replyText);
    await expect(replyTextarea).toHaveValue(replyText);

    await page.goto("/logout");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("authenticated user can create a nested reply to a reply", async ({
    page,
  }) => {
    const suffix = uniqueSuffix();
    const username = `e2e-nested-${suffix}`;
    const email = `e2e-nested-${suffix}@example.com`;
    const password = "secret123";
    const postText = `Nested E2E post ${suffix}`;
    const replyText = `Nested E2E reply ${suffix}`;
    const subReplyText = `Nested E2E sub reply ${suffix}`;

    await page.goto("/register");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/forum$/);

    await page.locator("textarea[name='newPost']").fill(postText);
    await page.getByRole("button", { name: "Submit Post" }).click();

    const postCard = page
      .locator(".forum-post-card", { hasText: postText })
      .first();
    await expect(postCard).toBeVisible();

    await postCard.locator("button.reply").first().click();
    const postReplyTextarea = postCard.locator(
      "div[id^='create-comment-for-post'] textarea[name='reply']",
    );
    await expect(postReplyTextarea).toBeVisible();
    await postReplyTextarea.fill(replyText);
    await postCard.getByRole("button", { name: "Submit" }).click();

    const postId = await postCard
      .locator("input[name='post_id']")
      .first()
      .getAttribute("value");
    const cleanPostId = postId?.trim();

    const replyResult = await page.evaluate(
      async ({ postId, replyText }) => {
        const response = await fetch("/add-reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ post_id: postId, comment_post: replyText }),
        });
        return response.json();
      },
      { postId, replyText },
    );

    expect(replyResult.success).toBe(true);
    expect(replyResult.reply.id).toBeTruthy();

    const replyId = replyResult.reply.id;

    const subReplyResult = await page.evaluate(
      async ({ replyId, subReplyText }) => {
        const response = await fetch("/add-reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reply_id: replyId,
            comment_post: subReplyText,
          }),
        });
        return response.json();
      },
      { replyId, subReplyText },
    );

    expect(subReplyResult.success).toBe(true);
    expect(subReplyResult.subReply).toBe(true);

    await page.reload();
    await firstTierRepliesButton(page, cleanPostId).click();
    await secondTierRepliesButton(page, replyId).click();
    await expect(page.getByText(subReplyText)).toBeVisible();
    await expect(page.locator(`#replyCount-for-comment-${replyId}`)).toHaveText(
      "1",
    );
  });

  test("authenticated user can react to a final-tier reply", async ({
    page,
  }) => {
    const suffix = uniqueSuffix();
    const username = `e2e-final-react-${suffix}`;
    const email = `e2e-final-react-${suffix}@example.com`;
    const password = "secret123";
    const postText = `Final reply reaction post ${suffix}`;
    const replyText = `Final reply reaction reply ${suffix}`;
    const subReplyText = `Final reply reaction sub reply ${suffix}`;

    await page.goto("/register");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/forum$/);

    await page.locator("textarea[name='newPost']").fill(postText);
    await page.getByRole("button", { name: "Submit Post" }).click();

    const postCard = page
      .locator(".forum-post-card", { hasText: postText })
      .first();
    await expect(postCard).toBeVisible();

    await postCard.locator("button.reply").click();
    const postReplyTextarea = postCard.locator(
      "div[id^='create-comment-for-post'] textarea[name='reply']",
    );
    await expect(postReplyTextarea).toBeVisible();
    await postReplyTextarea.fill(replyText);
    await postCard.getByRole("button", { name: "Submit" }).click();

    const postId = (
      await postCard
        .locator("input[name='post_id']")
        .first()
        .getAttribute("value")
    )?.trim();

    const replyResult = await page.evaluate(
      async ({ postId, replyText }) => {
        const response = await fetch("/add-reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ post_id: postId, comment_post: replyText }),
        });
        return response.json();
      },
      { postId, replyText },
    );

    const replyId = replyResult.reply.id;
    const subReplyResult = await page.evaluate(
      async ({ replyId, subReplyText }) => {
        const response = await fetch("/add-reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reply_id: replyId,
            comment_post: subReplyText,
          }),
        });
        return response.json();
      },
      { replyId, subReplyText },
    );

    const subReplyId = subReplyResult.reply.id;

    await page.reload();
    await firstTierRepliesButton(page, postId).click();
    await secondTierRepliesButton(page, replyId).click();

    const finalReplyLikeButton = page.locator(`#replyLikeButton-${subReplyId}`);
    await expect(finalReplyLikeButton).toBeVisible();
    await finalReplyLikeButton.click();

    await expect(finalReplyLikeButton).toHaveClass(/reaction-color/);
    await expect(page.locator(`#replyLikeCount-${subReplyId}`)).toHaveText("1");
  });

  test("authenticated user can toggle off a final-tier like reaction", async ({
    page,
  }) => {
    const suffix = uniqueSuffix();
    const username = `e2e-final-toggle-${suffix}`;
    const email = `e2e-final-toggle-${suffix}@example.com`;
    const password = "secret123";
    const postText = `Final reply toggle post ${suffix}`;
    const replyText = `Final reply toggle reply ${suffix}`;
    const subReplyText = `Final reply toggle sub reply ${suffix}`;

    await page.goto("/register");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/forum$/);

    await page.locator("textarea[name='newPost']").fill(postText);
    await page.getByRole("button", { name: "Submit Post" }).click();

    const postCard = page
      .locator(".forum-post-card", { hasText: postText })
      .first();
    await expect(postCard).toBeVisible();

    await postCard.locator("button.reply").click();
    const postReplyTextarea = postCard.locator(
      "div[id^='create-comment-for-post'] textarea[name='reply']",
    );
    await expect(postReplyTextarea).toBeVisible();
    await postReplyTextarea.fill(replyText);
    await postCard.getByRole("button", { name: "Submit" }).click();

    const postId = (
      await postCard
        .locator("input[name='post_id']")
        .first()
        .getAttribute("value")
    )?.trim();

    const replyResult = await page.evaluate(
      async ({ postId, replyText }) => {
        const response = await fetch("/add-reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ post_id: postId, comment_post: replyText }),
        });
        return response.json();
      },
      { postId, replyText },
    );
    const replyId = replyResult.reply.id;

    const subReplyResult = await page.evaluate(
      async ({ replyId, subReplyText }) => {
        const response = await fetch("/add-reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reply_id: replyId,
            comment_post: subReplyText,
          }),
        });
        return response.json();
      },
      { replyId, subReplyText },
    );
    const subReplyId = subReplyResult.reply.id;

    await page.reload();
    await firstTierRepliesButton(page, postId).click();
    await secondTierRepliesButton(page, replyId).click();

    const finalReplyLikeButton = page.locator(`#replyLikeButton-${subReplyId}`);
    await expect(finalReplyLikeButton).toBeVisible();
    await finalReplyLikeButton.click();
    await expect(finalReplyLikeButton).toHaveClass(/reaction-color/);

    await finalReplyLikeButton.click();
    await expect(finalReplyLikeButton).not.toHaveClass(/reaction-color/);
    await expect(page.locator(`#replyLikeCount-${subReplyId}`)).toHaveText("0");
  });

  test("authenticated user can dislike a final-tier reply", async ({
    page,
  }) => {
    const suffix = uniqueSuffix();
    const username = `e2e-final-dislike-${suffix}`;
    const email = `e2e-final-dislike-${suffix}@example.com`;
    const password = "secret123";
    const postText = `Final reply dislike post ${suffix}`;
    const replyText = `Final reply dislike reply ${suffix}`;
    const subReplyText = `Final reply dislike sub reply ${suffix}`;

    await page.goto("/register");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/forum$/);

    await page.locator("textarea[name='newPost']").fill(postText);
    await page.getByRole("button", { name: "Submit Post" }).click();

    const postCard = page
      .locator(".forum-post-card", { hasText: postText })
      .first();
    await expect(postCard).toBeVisible();

    await postCard.locator("button.reply").click();
    const postReplyTextarea = postCard.locator(
      "div[id^='create-comment-for-post'] textarea[name='reply']",
    );
    await expect(postReplyTextarea).toBeVisible();
    await postReplyTextarea.fill(replyText);
    await postCard.getByRole("button", { name: "Submit" }).click();

    const postId = (
      await postCard
        .locator("input[name='post_id']")
        .first()
        .getAttribute("value")
    )?.trim();

    const replyResult = await page.evaluate(
      async ({ postId, replyText }) => {
        const response = await fetch("/add-reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ post_id: postId, comment_post: replyText }),
        });
        return response.json();
      },
      { postId, replyText },
    );
    const replyId = replyResult.reply.id;

    const subReplyResult = await page.evaluate(
      async ({ replyId, subReplyText }) => {
        const response = await fetch("/add-reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reply_id: replyId,
            comment_post: subReplyText,
          }),
        });
        return response.json();
      },
      { replyId, subReplyText },
    );
    const subReplyId = subReplyResult.reply.id;

    await page.reload();
    await firstTierRepliesButton(page, postId).click();
    await secondTierRepliesButton(page, replyId).click();

    const finalReplyDislikeButton = page.locator(
      `#replyDislikeButton-${subReplyId}`,
    );
    await expect(finalReplyDislikeButton).toBeVisible();
    await finalReplyDislikeButton.click();

    await expect(finalReplyDislikeButton).toHaveClass(/reaction-color/);
    await expect(page.locator(`#replyDislikeCount-${subReplyId}`)).toHaveText(
      "1",
    );
  });
});
