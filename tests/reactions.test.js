import { beforeEach, describe, expect, it } from "vitest";
import { dbState, resetDbState, setupPgMock } from "./helpers/forum-mock.js";
import {
  addPost,
  addReply,
  registerAndLogin,
} from "./helpers/forum-test-helpers.js";

setupPgMock();
process.env.NODE_ENV = "test";

const { default: app } = await import("../index.js");

describe("Reaction flows", () => {
  beforeEach(() => {
    resetDbState();
  });

  it("applies reaction color class for post likes", async () => {
    const agent = await registerAndLogin(app, {
      username: "reactor",
      email: "reactor@example.com",
    });

    const post = await addPost(agent, "reaction target", dbState);

    const reactResponse = await agent
      .post("/post-reaction")
      .type("form")
      .send({
        post_id: String(post.id),
        reaction: "like",
      });

    expect(reactResponse.status).toBe(302);
    expect(reactResponse.headers.location).toBe("/forum");

    const forumResponse = await agent.get("/forum");
    expect(forumResponse.status).toBe(200);
    expect(forumResponse.text).toContain(
      `id="likeButton${post.id}"\n                  class="postButton reaction-color"`,
    );
  });

  it("applies reaction color class for reply dislikes", async () => {
    const agent = await registerAndLogin(app, {
      username: "replyreactor",
      email: "replyreactor@example.com",
    });

    const post = await addPost(agent, "post for reply reaction", dbState);
    const reply = await addReply(agent, post.id, "reply to react to", dbState);

    const reactResponse = await agent
      .post("/post-reaction")
      .type("form")
      .send({
        comment_post_id: String(reply.id),
        reaction_comment: "dislike",
      });

    expect(reactResponse.status).toBe(302);
    expect(reactResponse.headers.location).toBe("/forum");

    const forumResponse = await agent.get("/forum");
    expect(forumResponse.status).toBe(200);
    expect(forumResponse.text).toContain('class="postButton reaction-color"');
  });

  it("toggles off post like when clicked twice", async () => {
    const agent = await registerAndLogin(app, {
      username: "togglelike",
      email: "togglelike@example.com",
    });

    const post = await addPost(agent, "toggle like post", dbState);

    await agent
      .post("/post-reaction")
      .type("form")
      .send({
        post_id: String(post.id),
        reaction: "like",
      });

    let forumResponse = await agent.get("/forum");
    expect(forumResponse.status).toBe(200);
    expect(forumResponse.text).toMatch(
      new RegExp(
        `id="likeButton${post.id}"\\s+class="postButton reaction-color"`,
      ),
    );

    await agent
      .post("/post-reaction")
      .type("form")
      .send({
        post_id: String(post.id),
        reaction: "like",
      });

    expect(dbState.postReactions).toHaveLength(0);

    forumResponse = await agent.get("/forum");
    expect(forumResponse.status).toBe(200);
    expect(forumResponse.text).toMatch(
      new RegExp(`id="likeButton${post.id}"\\s+class="postButton\\s*"`),
    );
  });

  it("toggles off reply dislike when clicked twice", async () => {
    const agent = await registerAndLogin(app, {
      username: "togglereply",
      email: "togglereply@example.com",
    });

    const post = await addPost(agent, "post for reply toggle", dbState);
    const reply = await addReply(
      agent,
      post.id,
      "reply dislike toggle",
      dbState,
    );

    await agent
      .post("/post-reaction")
      .type("form")
      .send({
        comment_post_id: String(reply.id),
        reaction_comment: "dislike",
      });

    let forumResponse = await agent.get("/forum");
    expect(forumResponse.status).toBe(200);
    expect(forumResponse.text).toContain('class="postButton reaction-color"');

    await agent
      .post("/post-reaction")
      .type("form")
      .send({
        comment_post_id: String(reply.id),
        reaction_comment: "dislike",
      });

    expect(dbState.commentReactions).toHaveLength(0);

    forumResponse = await agent.get("/forum");
    expect(forumResponse.status).toBe(200);
    expect(forumResponse.text).not.toContain(
      'class="postButton reaction-color"',
    );
  });
});
