import request from "supertest";
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

describe("Forum content flows", () => {
  beforeEach(() => {
    resetDbState();
  });

  it("creates a post for authenticated user and redirects to /forumpost", async () => {
    const agent = await registerAndLogin(app, {
      username: "poster",
      email: "poster@example.com",
    });

    await addPost(agent, "hello test post", dbState);

    expect(dbState.posts).toHaveLength(1);
    expect(dbState.posts[0].post).toBe("hello test post");
  });

  it("does not create post when user is unauthenticated", async () => {
    const response = await request(app).post("/add").type("form").send({
      newPost: "should not be created",
    });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/login");
    expect(dbState.posts).toHaveLength(0);
  });

  it("creates a reply and renders it in /forumpost", async () => {
    const agent = await registerAndLogin(app, {
      username: "replier",
      email: "replier@example.com",
    });

    const post = await addPost(agent, "post with replies", dbState);
    await addReply(agent, post.id, "this is a test reply", dbState);

    expect(dbState.replies).toHaveLength(1);

    const forumResponse = await agent.get("/forumpost");
    expect(forumResponse.status).toBe(200);
    expect(forumResponse.text).toContain("this is a test reply");
  });

  it("renders comment icon and toggle target IDs for reply reveal", async () => {
    const agent = await registerAndLogin(app, {
      username: "toggleuser",
      email: "toggleuser@example.com",
    });

    const post = await addPost(agent, "toggle test post", dbState);
    const forumResponse = await agent.get("/forumpost");

    expect(forumResponse.status).toBe(200);
    expect(forumResponse.text).toContain(`id="commentButton${post.id}"`);
    expect(forumResponse.text).toContain(`id="commentInputBox${post.id}"`);
    expect(forumResponse.text).toContain('$(".comment").on("click"');
    expect(forumResponse.text).toContain(
      '$("#commentInputBox" + commentId).toggle()',
    );
  });
});
