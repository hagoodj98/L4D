import request from "supertest";
import { describe, expect, it } from "vitest";

process.env.NODE_ENV = "test";

const { default: app } = await import("../index.js");

describe("OAuth route wiring", () => {
  it("redirects /auth/google to Google OAuth", async () => {
    const response = await request(app).get("/auth/google");
    const oauthUrl = new URL(response.headers.location);

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("google");
    expect(oauthUrl.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/auth/google/forum",
    );
  });

  it("redirects /auth/twitch to Twitch OAuth", async () => {
    const response = await request(app).get("/auth/twitch");
    const oauthUrl = new URL(response.headers.location);

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("twitch");
    expect(oauthUrl.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/auth/twitch/forum",
    );
  });

  it("redirects /auth/discord to Discord OAuth", async () => {
    const response = await request(app).get("/auth/discord");
    const oauthUrl = new URL(response.headers.location);

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("discord");
    expect(oauthUrl.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/auth/discord/forum",
    );
  });

  it("redirects /auth/google/forum to Google OAuth when no callback params are present", async () => {
    const response = await request(app).get("/auth/google/forum");

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("google");
  });

  it("redirects /auth/twitch/forum to Twitch OAuth when no callback params are present", async () => {
    const response = await request(app).get("/auth/twitch/forum");

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("twitch");
  });

  it("redirects /auth/discord/forum to Discord OAuth when no callback params are present", async () => {
    const response = await request(app).get("/auth/discord/forum");

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("discord");
  });

  it("redirects /auth/google/forum to /login when provider returns an error", async () => {
    const response = await request(app).get(
      "/auth/google/forum?error=access_denied",
    );

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/login");
  });

  it("redirects /auth/twitch/forum to /login when provider returns an error", async () => {
    const response = await request(app).get(
      "/auth/twitch/forum?error=access_denied",
    );

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/login");
  });

  it("redirects /auth/discord/forum to /login when provider returns an error", async () => {
    const response = await request(app).get(
      "/auth/discord/forum?error=access_denied",
    );

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/login");
  });
});
