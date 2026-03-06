import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDbState, setupPgMock } from "./helpers/forum-mock.js";

setupPgMock();
process.env.NODE_ENV = "test";

const { default: app } = await import("../index.js");

describe("Auth and register error messages", () => {
  beforeEach(() => {
    resetDbState();
  });

  it("shows zod validation messages on login page", async () => {
    const agent = request.agent(app);

    const loginResponse = await agent.post("/login").type("form").send({
      username: "ab",
      password: "123",
    });

    expect(loginResponse.status).toBe(302);
    expect(loginResponse.headers.location).toBe("/login");

    const loginPage = await agent.get("/login");
    expect(loginPage.status).toBe(200);
    expect(loginPage.text).toContain(
      "Username must be at least 3 characters long",
    );
    expect(loginPage.text).toContain(
      "Password must be at least 6 characters long",
    );
  });

  it("shows user-not-found message on login page", async () => {
    const agent = request.agent(app);

    const loginResponse = await agent.post("/login").type("form").send({
      username: "nouser",
      password: "secret123",
    });

    expect(loginResponse.status).toBe(302);
    expect(loginResponse.headers.location).toBe("/login");

    const loginPage = await agent.get("/login");
    expect(loginPage.status).toBe(200);
    expect(loginPage.text).toContain("User not found");
  });

  it("shows incorrect password message on login page", async () => {
    const agent = request.agent(app);

    await agent.post("/register").type("form").send({
      username: "existinguser",
      email: "existing@example.com",
      password: "secret123",
    });

    await agent.get("/logout");

    const loginResponse = await agent.post("/login").type("form").send({
      username: "existinguser",
      password: "wrongpass",
    });

    expect(loginResponse.status).toBe(302);
    expect(loginResponse.headers.location).toBe("/login");

    const loginPage = await agent.get("/login");
    expect(loginPage.status).toBe(200);
    expect(loginPage.text).toContain("Incorrect password");
  });

  it("shows duplicate user info on register and clears it after one view", async () => {
    const agent = request.agent(app);

    await agent.post("/register").type("form").send({
      username: "dupuser",
      email: "dup@example.com",
      password: "secret123",
    });

    await agent.get("/logout");

    const duplicateResponse = await agent.post("/register").type("form").send({
      username: "dupuser",
      email: "dup@example.com",
      password: "secret123",
    });

    expect(duplicateResponse.status).toBe(302);
    expect(duplicateResponse.headers.location).toBe("/register");

    const firstRegisterPage = await agent.get("/register");
    expect(firstRegisterPage.status).toBe(200);
    expect(firstRegisterPage.text).toContain(
      "You typed an email or username that already exists, try a new one!",
    );

    const secondRegisterPage = await agent.get("/register");
    expect(secondRegisterPage.status).toBe(200);
    expect(secondRegisterPage.text).not.toContain(
      "You typed an email or username that already exists, try a new one!",
    );
  });
});
