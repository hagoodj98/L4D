import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({
  users: [],
  posts: [],
  nextUserId: 1,
  nextPostId: 1,
}));

function buildJoinRows() {
  return dbState.posts.map((postRow) => {
    const user = dbState.users.find((item) => item.id === postRow.user_id);
    return {
      ...user,
      ...postRow,
    };
  });
}

vi.mock("pg", () => {
  class Client {
    async connect() {
      return true;
    }

    async query(sql, params = []) {
      if (sql.includes("SELECT * FROM users WHERE email = $1")) {
        return {
          rows: dbState.users.filter((user) => user.email === params[0]),
        };
      }

      if (
        sql.includes(
          "INSERT INTO users (display_name, email, password) VALUES ($1, $2, $3) RETURNING *",
        )
      ) {
        const user = {
          id: dbState.nextUserId++,
          display_name: params[0],
          email: params[1],
          password: params[2],
        };
        dbState.users.push(user);
        return { rows: [user] };
      }

      if (sql.includes("SELECT * FROM users WHERE display_name = $1")) {
        return {
          rows: dbState.users.filter((user) => user.display_name === params[0]),
        };
      }

      if (sql.includes("SELECT * FROM users JOIN posts")) {
        if (sql.includes("WHERE user_id = $1")) {
          const userId = params[0];
          return {
            rows: buildJoinRows().filter((row) => row.user_id === userId),
          };
        }

        let rows = buildJoinRows();
        if (sql.includes("ORDER BY created_at DESC")) {
          rows = [...rows].sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at),
          );
        }
        if (sql.includes("ORDER BY created_at ASC")) {
          rows = [...rows].sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at),
          );
        }

        return { rows };
      }

      if (
        sql.includes(
          "INSERT INTO posts (post, user_id, created_at) VALUES ($1, $2, $3)",
        )
      ) {
        const post = {
          id: dbState.nextPostId++,
          post: params[0],
          user_id: params[1],
          created_at: params[2],
        };
        dbState.posts.push(post);
        return { rows: [post] };
      }

      throw new Error(`Unhandled SQL in test mock: ${sql}`);
    }
  }

  return {
    default: {
      Client,
    },
  };
});

process.env.NODE_ENV = "test";

const { default: app } = await import("../index.js");

describe("Auth + forum flows", () => {
  beforeEach(() => {
    dbState.users = [];
    dbState.posts = [];
    dbState.nextUserId = 1;
    dbState.nextPostId = 1;
  });

  it("redirects anonymous user from /forum to /login", async () => {
    const response = await request(app).get("/forum");
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/login");
  });

  it("registers a user and redirects to /forum", async () => {
    const agent = request.agent(app);

    const response = await agent.post("/register").type("form").send({
      username: "user1",
      email: "user1@example.com",
      password: "secret123",
    });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/forum");
    expect(dbState.users).toHaveLength(1);
    expect(dbState.users[0].display_name).toBe("user1");
  });

  it("logs in an existing user and redirects to /forum", async () => {
    const agent = request.agent(app);

    await agent.post("/register").type("form").send({
      username: "user2",
      email: "user2@example.com",
      password: "secret123",
    });

    const loginResponse = await request(app).post("/login").type("form").send({
      username: "user2",
      password: "secret123",
    });

    expect(loginResponse.status).toBe(302);
    expect(loginResponse.headers.location).toBe("/forum");
  });

  it("creates a post for authenticated user and redirects to /forumpost", async () => {
    const agent = request.agent(app);

    await agent.post("/register").type("form").send({
      username: "poster",
      email: "poster@example.com",
      password: "secret123",
    });

    const createPostResponse = await agent.post("/add").type("form").send({
      newPost: "hello test post",
    });

    expect(createPostResponse.status).toBe(302);
    expect(createPostResponse.headers.location).toBe("/forumpost");
    expect(dbState.posts).toHaveLength(1);
    expect(dbState.posts[0].post).toBe("hello test post");
  });

  it("rejects duplicate email on register and redirects to /register", async () => {
    const agent = request.agent(app);

    await agent.post("/register").type("form").send({
      username: "alpha",
      email: "duplicate@example.com",
      password: "secret123",
    });

    const duplicateResponse = await request(app)
      .post("/register")
      .type("form")
      .send({
        username: "beta",
        email: "duplicate@example.com",
        password: "secret456",
      });

    expect(duplicateResponse.status).toBe(302);
    expect(duplicateResponse.headers.location).toBe("/register");
    expect(dbState.users).toHaveLength(1);
  });

  it("fails login with wrong password and redirects to /login-error", async () => {
    await request(app).post("/register").type("form").send({
      username: "wrongpass",
      email: "wrongpass@example.com",
      password: "secret123",
    });

    const loginResponse = await request(app).post("/login").type("form").send({
      username: "wrongpass",
      password: "not-the-password",
    });

    expect(loginResponse.status).toBe(302);
    expect(loginResponse.headers.location).toBe("/login-error");
  });

  it("does not create post when user is unauthenticated", async () => {
    const response = await request(app).post("/add").type("form").send({
      newPost: "should not be created",
    });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/login");
    expect(dbState.posts).toHaveLength(0);
  });
});
