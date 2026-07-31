import { expect, test } from "@playwright/test";
/* global document, MouseEvent, ensureNotificationsDropdownTitle, createTextForNotificationType, createNotificationElement */

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

async function createTwoUserScenario(browser, suffix, scope) {
  const ownerName = `e2e-notif-owner-${scope}-${suffix}`;
  const actorName = `e2e-notif-actor-${scope}-${suffix}`;
  const ownerEmail = `${ownerName}@example.com`;
  const actorEmail = `${actorName}@example.com`;

  const ownerContext = await browser.newContext();
  const actorContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const actorPage = await actorContext.newPage();

  await registerUser(ownerPage, ownerName, ownerEmail);
  await registerUser(actorPage, actorName, actorEmail);

  return {
    ownerContext,
    actorContext,
    ownerPage,
    actorPage,
    ownerName,
    actorName,
  };
}

async function createPost(page, postText) {
  const result = await page.evaluate(
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

  expect(result.success).toBe(true);
  return result.post;
}

async function addCommentToPost(page, postId, commentText) {
  const result = await page.evaluate(
    async ({ postId, commentText }) => {
      const response = await fetch("/add-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: String(postId),
          comment_post: commentText,
        }),
      });
      return response.json();
    },
    { postId, commentText },
  );

  expect(result.success).toBe(true);
  return result.reply;
}

async function addReplyToComment(page, commentId, replyText) {
  const result = await page.evaluate(
    async ({ commentId, replyText }) => {
      const response = await fetch("/add-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reply_id: String(commentId),
          comment_post: replyText,
        }),
      });
      return response.json();
    },
    { commentId, replyText },
  );

  expect(result.success).toBe(true);
  expect(result.subReply).toBe(true);
  return result.reply;
}

async function waitForNotification(ownerPage, expected) {
  await expect
    .poll(
      async () =>
        ownerPage.evaluate(async (target) => {
          const response = await fetch("/check-notifications-reloaded", {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          });
          const payload = await response.json();
          return payload.notifications.some((notification) => {
            const notificationType =
              notification.notificationType ?? notification.notification_type;
            const userName = notification.userName ?? notification.user_name;
            const reactionType =
              notification.reactionType ?? notification.reaction_type;
            const postId = notification.postID ?? notification.post_id;
            const commentId = notification.commentID ?? notification.comment_id;
            const replyId = notification.replyID ?? notification.reply_id;

            if (target.type && notificationType !== target.type) {
              return false;
            }

            if (target.userName && userName !== target.userName) {
              return false;
            }

            if (
              Object.prototype.hasOwnProperty.call(target, "reactionType") &&
              !(target.reactionType === null
                ? reactionType == null
                : reactionType === target.reactionType)
            ) {
              return false;
            }

            if (target.postId && String(postId) !== String(target.postId)) {
              return false;
            }

            if (
              target.commentId &&
              String(commentId) !== String(target.commentId)
            ) {
              return false;
            }

            if (target.replyId && String(replyId) !== String(target.replyId)) {
              return false;
            }

            return true;
          });
        }, expected),
      { timeout: 25_000 },
    )
    .toBe(true);
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

  test("clicking a notification route scrolls to the targeted final reply and highlights it temporarily", async ({
    browser,
  }) => {
    const suffix = uniqueSuffix();
    const { ownerContext, actorContext, ownerPage, actorPage, actorName } =
      await createTwoUserScenario(browser, suffix, "route");

    try {
      const post = await createPost(ownerPage, `route post ${suffix}`);
      const ownerComment = await addCommentToPost(
        ownerPage,
        post.id,
        `route comment ${suffix}`,
      );
      const ownerFinalReply = await addReplyToComment(
        ownerPage,
        ownerComment.id,
        `route final reply ${suffix}`,
      );

      const finalReplyReactionResponse = await actorPage.request.post(
        "/post-reaction",
        {
          data: {
            final_reply_id: String(ownerFinalReply.id),
            reaction_type: "like",
          },
        },
      );
      expect(finalReplyReactionResponse.status()).toBe(200);

      await waitForNotification(ownerPage, {
        type: "replies_down",
        userName: actorName,
        reactionType: "like",
        replyId: ownerFinalReply.id,
      });

      await ownerPage.reload();

      await ownerPage.evaluate(
        ({ postId, commentId, replyId, actor }) => {
          const dropdown = document.getElementById("notificationsDropdown");
          if (!dropdown) return;
          ensureNotificationsDropdownTitle(dropdown);

          const notification = {
            notificationType: "replies_down",
            userName: actor,
            reactionType: "like",
            sourcePost: `route final reply ${replyId}`,
            postID: postId,
            commentID: commentId,
            replyID: replyId,
            onPage: `1/${postId}/${commentId}/${replyId}`,
            createdAt: new Date().toISOString(),
            wasRead: false,
          };

          const { likeComment, commentPost, replyPost, likePost, likeReply } =
            createTextForNotificationType(notification);

          createNotificationElement(
            notification,
            likeComment,
            commentPost,
            replyPost,
            likePost,
            likeReply,
            dropdown,
            false,
          );

          const links = dropdown.querySelectorAll(".notification-link a");
          const injectedLink = links[links.length - 1];
          injectedLink?.dispatchEvent(
            new MouseEvent("click", { bubbles: true }),
          );
        },
        {
          postId: post.id,
          commentId: ownerComment.id,
          replyId: ownerFinalReply.id,
          actor: actorName,
        },
      );

      const targetReply = ownerPage
        .locator(`[id="anchor/${ownerFinalReply.id}"]`)
        .first();

      await expect.poll(async () => ownerPage.url()).toContain("/forum?page=1");
      await expect
        .poll(async () =>
          targetReply.evaluate((node) => node.classList.contains("highlight")),
        )
        .toBe(true);
      await expect
        .poll(async () =>
          targetReply.evaluate((node) => node.classList.contains("highlight")),
        )
        .toBe(false);
    } finally {
      await ownerContext.close();
      await actorContext.close();
    }
  });

  test("persists notification updates between two users", async ({
    browser,
  }) => {
    const suffix = uniqueSuffix();
    const { user1Context, user97Context, user1Page, user97Name, postText } =
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
        user1Page
          .locator(".notification-link a .notification-source-post")
          .first(),
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
    const {
      user1Context,
      user97Context,
      user1Page,
      user97Name,
      postId,
      postText,
    } = await createNotificationScenario(browser, suffix);

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
        user1Page
          .locator(".notification-link a .notification-source-post")
          .first(),
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

  test("notifies post owner when another user reacts to and comments on the post", async ({
    browser,
  }) => {
    const suffix = uniqueSuffix();
    const { ownerContext, actorContext, ownerPage, actorPage, actorName } =
      await createTwoUserScenario(browser, suffix, "post");

    const postText = `post notifications ${suffix}`;

    try {
      const post = await createPost(ownerPage, postText);

      const postReactionResponse = await actorPage.request.post(
        "/post-reaction",
        {
          data: {
            post_id: String(post.id),
            reaction_type: "like",
          },
        },
      );
      expect(postReactionResponse.status()).toBe(200);

      const comment = await addCommentToPost(
        actorPage,
        post.id,
        `comment on post ${suffix}`,
      );
      expect(comment.id).toBeTruthy();

      await waitForNotification(ownerPage, {
        type: "posts_down",
        userName: actorName,
        reactionType: "like",
        postId: post.id,
      });

      await waitForNotification(ownerPage, {
        type: "posts_down",
        userName: actorName,
        reactionType: null,
        postId: post.id,
      });

      await ownerPage.reload();
      await expect(ownerPage.locator("#notificationsDropdown")).toContainText(
        `${actorName} liked your post`,
      );
      await expect(ownerPage.locator("#notificationsDropdown")).toContainText(
        `${actorName} commented on your post`,
      );
      await expect(ownerPage.locator("#notificationsDropdown")).toContainText(
        `"${postText.slice(0, 20)}..."`,
      );
    } finally {
      await ownerContext.close();
      await actorContext.close();
    }
  });

  test("notifies comment owner when another user reacts to and replies to the comment", async ({
    browser,
  }) => {
    const suffix = uniqueSuffix();
    const { ownerContext, actorContext, ownerPage, actorPage, actorName } =
      await createTwoUserScenario(browser, suffix, "comment");

    const postText = `comment base post ${suffix}`;
    const ownerCommentText = `owner comment ${suffix}`;

    try {
      const post = await createPost(ownerPage, postText);
      const ownerComment = await addCommentToPost(
        ownerPage,
        post.id,
        ownerCommentText,
      );

      const commentReactionResponse = await actorPage.request.post(
        "/post-reaction",
        {
          data: {
            comment_post_id: String(ownerComment.id),
            reaction_type: "like",
          },
        },
      );
      expect(commentReactionResponse.status()).toBe(200);

      const reply = await addReplyToComment(
        actorPage,
        ownerComment.id,
        `reply to comment ${suffix}`,
      );
      expect(reply.id).toBeTruthy();

      await waitForNotification(ownerPage, {
        type: "comments_down",
        userName: actorName,
        reactionType: "like",
        commentId: ownerComment.id,
      });

      await waitForNotification(ownerPage, {
        type: "comments_down",
        userName: actorName,
        reactionType: null,
        commentId: ownerComment.id,
      });

      await ownerPage.reload();
      await expect(ownerPage.locator("#notificationsDropdown")).toContainText(
        `${actorName} liked your comment`,
      );
      await expect(ownerPage.locator("#notificationsDropdown")).toContainText(
        `${actorName} replied to your comment`,
      );
      await expect(ownerPage.locator("#notificationsDropdown")).toContainText(
        `"${ownerCommentText.slice(0, 20)}..."`,
      );
    } finally {
      await ownerContext.close();
      await actorContext.close();
    }
  });

  test("notifies reply owner when another user reacts to the reply", async ({
    browser,
  }) => {
    const suffix = uniqueSuffix();
    const { ownerContext, actorContext, ownerPage, actorPage, actorName } =
      await createTwoUserScenario(browser, suffix, "reply");

    try {
      const post = await createPost(ownerPage, `reply base post ${suffix}`);
      const ownerComment = await addCommentToPost(
        ownerPage,
        post.id,
        `owner comment for reply ${suffix}`,
      );
      const ownerFinalReply = await addReplyToComment(
        ownerPage,
        ownerComment.id,
        `owner final reply ${suffix}`,
      );

      const finalReplyReactionResponse = await actorPage.request.post(
        "/post-reaction",
        {
          data: {
            final_reply_id: String(ownerFinalReply.id),
            reaction_type: "dislike",
          },
        },
      );
      expect(finalReplyReactionResponse.status()).toBe(200);

      await waitForNotification(ownerPage, {
        type: "replies_down",
        userName: actorName,
        reactionType: "dislike",
        replyId: ownerFinalReply.id,
      });

      await ownerPage.reload();
      await expect(ownerPage.locator("#notificationsDropdown")).toContainText(
        `${actorName} disliked your reply`,
      );
      await expect(ownerPage.locator("#notificationsDropdown")).toContainText(
        `"${`owner final reply ${suffix}`.slice(0, 20)}..."`,
      );
    } finally {
      await ownerContext.close();
      await actorContext.close();
    }
  });
});
