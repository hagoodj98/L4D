import request from "supertest";
import { expect } from "vitest";

export async function registerAndLogin(
  app,
  { username, email, password = "secret123" },
) {
  const agent = request.agent(app);
  const response = await agent.post("/auth/register").type("form").send({
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
    .post("/forum/response-body/add-post")
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
    .post("/forum/response-body/add-comment")
    .set("Content-Type", "application/json")
    .send({
      post_id: String(postId),
      comment_post: content,
    });

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  return response.body.comment || dbState.replies[dbState.replies.length - 1];
}

export async function addSubReply(agent, replyId, content, dbState) {
  const response = await agent
    .post("/forum/response-body/add-reply")
    .set("Content-Type", "application/json")
    .send({
      reply_id: String(replyId),
      comment_post: content,
    });

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  expect(response.body.subReply).toBe(true);

  return (
    response.body.reply ||
    dbState.repliesFinalTier[dbState.repliesFinalTier.length - 1]
  );
}
