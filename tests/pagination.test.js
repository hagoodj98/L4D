import { beforeEach, describe, expect, it } from "vitest";
import { dbState, resetDbState, setupPgMock } from "./helpers/forum-mock.js";
import { addPost, registerAndLogin } from "./helpers/forum-test-helpers.js";

setupPgMock();
process.env.NODE_ENV = "test";

const { default: app } = await import("../index.js");

describe("Forum pagination", () => {
  beforeEach(() => {
    resetDbState();
  });

  async function seedPosts(agent, total = 6) {
    for (let index = 1; index <= total; index += 1) {
      await addPost(agent, `pagination-post-${index}`, dbState);
      dbState.posts[dbState.posts.length - 1].created_at = new Date(
        `2026-01-01T00:00:0${index}Z`,
      );
    }
  }

  it("returns only the first 4 newest posts on page 1", async () => {
    const agent = await registerAndLogin(app, {
      username: "paginator1",
      email: "paginator1@example.com",
    });

    await seedPosts(agent, 6);

    const response = await agent.get("/forum/pagination?page=1");

    expect(response.status).toBe(200);
    const rows = response.body.listAllContent;
    expect(rows).toHaveLength(4);
    expect(rows[0].post).toBe("pagination-post-6");
    expect(rows[1].post).toBe("pagination-post-5");
    expect(rows[2].post).toBe("pagination-post-4");
    expect(rows[3].post).toBe("pagination-post-3");

    expect(rows.map((row) => row.post)).not.toContain("pagination-post-2");
    expect(rows.map((row) => row.post)).not.toContain("pagination-post-1");
  });

  it("returns the remaining posts on page 2 and renders page links", async () => {
    const agent = await registerAndLogin(app, {
      username: "paginator2",
      email: "paginator2@example.com",
    });

    await seedPosts(agent, 6);

    const response = await agent.get("/forum/pagination?page=2");

    expect(response.status).toBe(200);
    const rows = response.body.listAllContent;
    expect(rows).toHaveLength(2);
    expect(rows[0].post).toBe("pagination-post-2");
    expect(rows[1].post).toBe("pagination-post-1");

    const forumResponse = await agent.get("/forum?page=2");
    expect(forumResponse.status).toBe(200);
    expect(forumResponse.text).toContain("handlePagination(1)");
    expect(forumResponse.text).toContain("handlePagination(2)");
  });
});
