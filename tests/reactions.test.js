import { beforeEach, describe, expect, it } from "vitest";
import { dbState, resetDbState, setupPgMock } from "./helpers/forum-mock.js";
import {
  addPost,
  addReply,
  addSubReply,
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
      .set("Content-Type", "application/json")
      .send({
        post_id: post.id,
        reaction_type: "like",
      });

    expect(reactResponse.status).toBe(200);
    expect(reactResponse.body.reaction_type).toBe("like");
    expect(dbState.postReactions).toHaveLength(1);
    expect(dbState.postReactions[0].reaction_type).toBe("like");
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
      .set("Content-Type", "application/json")
      .send({
        comment_post_id: reply.id,
        reaction_type: "dislike",
      });

    expect(reactResponse.status).toBe(200);
    expect(reactResponse.body.reaction_type).toBe("dislike_comment");
    expect(dbState.commentReactions).toHaveLength(1);
    expect(dbState.commentReactions[0].reaction_type).toBe("dislike");
  });

  it("toggles off post like when clicked twice", async () => {
    const agent = await registerAndLogin(app, {
      username: "togglelike",
      email: "togglelike@example.com",
    });

    const post = await addPost(agent, "toggle like post", dbState);

    await agent
      .post("/post-reaction")
      .set("Content-Type", "application/json")
      .send({
        post_id: post.id,
        reaction_type: "like",
      });

    expect(dbState.postReactions).toHaveLength(1);

    const secondResponse = await agent
      .post("/post-reaction")
      .set("Content-Type", "application/json")
      .send({
        post_id: post.id,
        reaction_type: "like",
      });

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.reaction_type).toBe("like_removed");
    expect(dbState.postReactions).toHaveLength(0);
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
      .set("Content-Type", "application/json")
      .send({
        comment_post_id: reply.id,
        reaction_type: "dislike",
      });

    expect(dbState.commentReactions).toHaveLength(1);

    const secondResponse = await agent
      .post("/post-reaction")
      .set("Content-Type", "application/json")
      .send({
        comment_post_id: reply.id,
        reaction_type: "dislike",
      });

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.reaction_type).toBe("dislike_removed_comment");
    expect(dbState.commentReactions).toHaveLength(0);
  });

  it("applies and toggles reactions for final-tier replies", async () => {
    const agent = await registerAndLogin(app, {
      username: "finalreactor",
      email: "finalreactor@example.com",
    });

    const post = await addPost(agent, "post for final reply reaction", dbState);
    const reply = await addReply(agent, post.id, "reply to branch", dbState);
    const finalReply = await addSubReply(
      agent,
      reply.id,
      "final reply target",
      dbState,
    );

    const reactResponse = await agent
      .post("/post-reaction")
      .set("Content-Type", "application/json")
      .send({
        final_reply_id: finalReply.id,
        reaction_type: "like",
      });

    expect(reactResponse.status).toBe(200);
    expect(reactResponse.body.reaction_type).toBe("like_final_reply");
    expect(dbState.finalReplyReactions).toHaveLength(1);
    expect(dbState.finalReplyReactions[0].reaction_type).toBe("like");

    const secondResponse = await agent
      .post("/post-reaction")
      .set("Content-Type", "application/json")
      .send({
        final_reply_id: finalReply.id,
        reaction_type: "like",
      });

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.reaction_type).toBe("like_removed_final_reply");
    expect(dbState.finalReplyReactions).toHaveLength(0);
  });
});
