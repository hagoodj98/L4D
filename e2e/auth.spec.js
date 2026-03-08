import { expect, test } from "@playwright/test";

// Covers authentication UX paths: link routing, negative auth responses, and validation feedback.

function uniqueSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

test.describe("Authentication flows", () => {
  test("sets a session cookie after successful login", async ({
    page,
    context,
  }) => {
    const suffix = uniqueSuffix();
    const username = `e2e-cookie-${suffix}`;
    const email = `e2e-cookie-${suffix}@example.com`;
    const password = "secret123";

    await page.goto("/register");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/forum$/);

    const cookies = await context.cookies();
    const sessionCookie = cookies.find(
      (cookie) => cookie.name === "zombieslayers.sid",
    );

    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.value).toBeTruthy();
    expect(sessionCookie?.httpOnly).toBe(true);
    expect(sessionCookie?.sameSite).toBe("Lax");
  });

  test("auth page links route correctly", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Create an account" }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(
      page.getByRole("heading", { name: "Create account" }),
    ).toBeVisible();

    await page.locator("form").getByRole("link", { name: "Login" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("auth negative paths show visible errors", async ({ page }) => {
    const suffix = uniqueSuffix();
    const username = `e2e-neg-${suffix}`;
    const email = `e2e-neg-${suffix}@example.com`;
    const password = "secret123";

    await page.goto("/register");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/forum$/);

    await page.goto("/logout");
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("Incorrect password")).toBeVisible();

    await page.goto("/register");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(
      page.getByText("already exists", { exact: false }),
    ).toBeVisible();
  });

  test("auth validation errors are shown for short credentials", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill("ab");
    await page.getByLabel("Password").fill("123");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByText("Username must be at least 3 characters long"),
    ).toBeVisible();
    await expect(
      page.getByText("Password must be at least 6 characters long"),
    ).toBeVisible();

    await page.goto("/register");
    await page.getByLabel("Email").fill(`valid-${uniqueSuffix()}@example.com`);
    await page.getByLabel("Username").fill("ab");
    await page.getByLabel("Password").fill("123");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/register$/);
    await expect(
      page.getByText("Username must be at least 3 characters long"),
    ).toBeVisible();
    await expect(
      page.getByText("Password must be at least 6 characters long"),
    ).toBeVisible();
  });
});
