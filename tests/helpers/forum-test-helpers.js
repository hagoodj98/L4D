import request from "supertest";
import { expect } from "vitest";

export async function registerAndLogin(
  app,
  { username, email, password = "secret123" },
) {
  const agent = request.agent(app);
  const response = await agent.post("/register").type("form").send({
    username,
    email,
    password,
  });

  expect(response.status).toBe(302);
  expect(response.headers.location).toBe("/forum");

  return agent;
}

export async function addPost(agent, content, dbState) {
  const response = await agent
    .post("/add-post")
    .set("Content-Type", "application/json")
    .send({
      newPost: content,
    });

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  return response.body.post || dbState.posts[dbState.posts.length - 1];
}

export async function addReply(agent, postId, content, dbState) {
  const response = await agent
    .post("/add-reply")
    .set("Content-Type", "application/json")
    .send({
      post_id: String(postId),
      comment_post: content,
    });

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  return response.body.reply || dbState.replies[dbState.replies.length - 1];
}
