import request from "supertest";
import { describe, it, expect } from "vitest";
import app from "../index.js";

describe("Express app", () => {
  it("GET / should return 200", async () => {
    const response = await request(app).get("/");
    expect(response.status).toBe(200);
  });
});
