import { describe, expect, it } from "vitest";
import ErrorHandler from "../utils/error.js";

describe("ErrorHandler", () => {
  it("creates an operational error with provided values", () => {
    const details = { field: "email", reason: "duplicate" };
    const error = new ErrorHandler(409, "Conflict", details);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ErrorHandler");
    expect(error.message).toBe("Conflict");
    expect(error.statusCode).toBe(409);
    expect(error.details).toEqual(details);
    expect(error.isOperational).toBe(true);
  });

  it("uses defaults when values are omitted", () => {
    const error = new ErrorHandler();

    expect(error.statusCode).toBe(400);
    expect(error.message).toBe("Unexpected error");
    expect(error.details).toBeUndefined();
  });

  it("falls back to 500 for invalid status code", () => {
    const error = new ErrorHandler("bad-status", "Oops");

    expect(error.statusCode).toBe(500);
    expect(error.message).toBe("Oops");
  });

  it("ignores non-object details", () => {
    const error = new ErrorHandler(400, "Validation failed", "not-an-object");

    expect(error.details).toBeUndefined();
  });
});
