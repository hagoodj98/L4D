import request from "supertest";
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

describe("Forum content flows", () => {
  beforeEach(() => {
    resetDbState();
  });

  it("creates a post for authenticated user using JSON response", async () => {
    const agent = await registerAndLogin(app, {
      username: "poster",
      email: "poster@example.com",
    });

    const post = await addPost(agent, "hello test post", dbState);

    expect(dbState.posts).toHaveLength(1);
    expect(dbState.posts[0].post).toBe("hello test post");
    expect(post.post).toBe("hello test post");
  });

  it("does not create post when user is unauthenticated", async () => {
    const response = await request(app)
      .post("/forum/response-body/add-post")
      .type("form")
      .send({
        newPost: "should not be created",
      });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/auth/login");
    expect(dbState.posts).toHaveLength(0);
  });

  it("creates a reply and renders it in /forum/pagination", async () => {
    const agent = await registerAndLogin(app, {
      username: "replier",
      email: "replier@example.com",
    });

    const post = await addPost(agent, "post with replies", dbState);
    const reply = await addReply(
      agent,
      post.id,
      "this is a test reply",
      dbState,
    );

    expect(dbState.replies).toHaveLength(1);
    expect(reply.comment_post).toBe("this is a test reply");

    const paginationResponse = await agent.get("/forum/pagination?page=1");
    expect(paginationResponse.status).toBe(200);
    expect(
      paginationResponse.body.listAllContent[0].replies[0].comment_post,
    ).toBe("this is a test reply");
  });

  it("renders comment toggle handlers and target IDs in forum script", async () => {
    const agent = await registerAndLogin(app, {
      username: "toggleuser",
      email: "toggleuser@example.com",
    });

    const post = await addPost(agent, "toggle test post", dbState);
    const forumResponse = await agent.get("/forum");

    expect(forumResponse.status).toBe(200);
    expect(forumResponse.text).toContain("showAllReplies(");
    expect(forumResponse.text).toContain("toggleReplyBox(");
    expect(forumResponse.text).toContain("create-comment-for-post-");
    expect(post.id).toBeGreaterThan(0);
  });

  it("creates a nested sub-reply and includes it in forum pagination data", async () => {
    const agent = await registerAndLogin(app, {
      username: "nesteduser",
      email: "nesteduser@example.com",
    });

    const post = await addPost(agent, "nested reply post", dbState);
    const reply = await addReply(agent, post.id, "parent reply", dbState);
    const subReply = await addSubReply(
      agent,
      reply.id,
      "nested child reply",
      dbState,
    );

    expect(dbState.repliesFinalTier).toHaveLength(1);
    expect(subReply.comment_post).toBe("nested child reply");

    const paginationResponse = await agent.get("/forum/pagination?page=1");
    expect(paginationResponse.status).toBe(200);
    expect(
      paginationResponse.body.listAllContent[0].replies[0].replies_final_tier[0]
        .comment_post,
    ).toBe("nested child reply");
    expect(
      paginationResponse.body.listAllContent[0].replies[0].reply_count,
    ).toBe(1);
  });
});
