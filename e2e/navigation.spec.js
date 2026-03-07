import { expect, test } from "@playwright/test";

// Covers public navigation behavior: primary routes, mobile menu, and guest forum entry points.

test.describe("Navigation and public routes", () => {
  test("desktop navbar routes and accordion interaction", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { name: "Killing a few" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Game modes" }).click();
    await expect(page.locator("#collapseTwo")).toHaveClass(/show/);

    await page.goto("/survivors");
    await expect(page).toHaveURL(/\/survivors$/);

    await page.goto("/specialinfected");
    await expect(page).toHaveURL(/\/specialinfected$/);

    await page.goto("/community");
    await expect(page).toHaveURL(/\/community$/);
  });

  test("mobile hamburger menu shows links and routes", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await page.getByRole("button", { name: "Toggle navigation" }).click();
    await expect(page.getByRole("link", { name: "Survivors" })).toBeVisible();

    await page.getByRole("link", { name: "Survivors" }).click();
    await expect(page).toHaveURL(/\/survivors$/);
  });

  test("forum guest actions and pagination area are visible", async ({
    page,
  }) => {
    await page.goto("/forum");

    await expect(page).toHaveURL(/\/forum/);
    await expect(page.getByText("Browse all posts as a guest")).toBeVisible();
    await expect(
      page.locator("nav[aria-label='Page navigation example']"),
    ).toBeVisible();

    await page.getByRole("link", { name: "log in" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/forum");
    await page.getByRole("link", { name: "create an account" }).click();
    await expect(page).toHaveURL(/\/register$/);
  });
});
