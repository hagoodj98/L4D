import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { dbState, resetDbState, setupPgMock } from "./helpers/forum-mock.js";
import { registerAndLogin } from "./helpers/forum-test-helpers.js";

setupPgMock();
process.env.NODE_ENV = "test";

const { default: app } = await import("../index.js");

describe("Auth flows", () => {
  beforeEach(() => {
    resetDbState();
  });

  it("allows anonymous user to view /forum", async () => {
    const response = await request(app).get("/forum");
    expect(response.status).toBe(200);
  });

  it("registers a user and redirects to /forum", async () => {
    await registerAndLogin(app, {
      username: "user1",
      email: "user1@example.com",
    });

    expect(dbState.users).toHaveLength(1);
    expect(dbState.users[0].display_name).toBe("user1");
  });

  it("logs in an existing user and redirects to /forum", async () => {
    const agent = await registerAndLogin(app, {
      username: "user2",
      email: "user2@example.com",
    });
    await agent.get("/logout");

    const loginResponse = await request(app).post("/login").type("form").send({
      username: "user2",
      password: "secret123",
    });

    expect(loginResponse.status).toBe(302);
    expect(loginResponse.headers.location).toBe("/forum");
  });

  it("rejects duplicate email on register and redirects to /register", async () => {
    await registerAndLogin(app, {
      username: "alpha",
      email: "duplicate@example.com",
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
    await registerAndLogin(app, {
      username: "wrongpass",
      email: "wrongpass@example.com",
    });

    const loginResponse = await request(app).post("/login").type("form").send({
      username: "wrongpass",
      password: "not-the-password",
    });

    expect(loginResponse.status).toBe(302);
    expect(loginResponse.headers.location).toBe("/login");
  });
});
