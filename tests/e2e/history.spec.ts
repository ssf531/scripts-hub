import { test, expect } from "@playwright/test";

test.describe("History Page", () => {
  test("should navigate to history page", async ({ page }) => {
    await page.goto("/");
    await page.click("text=History");
    await expect(page).toHaveURL("/history");
    await expect(page.locator("h3")).toContainText("Recent Script Runs");
  });

  test("should display history table when data exists", async ({ page }) => {
    await page.goto("/history");

    // Wait for table to load
    const table = page.locator("table.table");
    await expect(table).toBeVisible({ timeout: 5000 });

    // Check table headers
    await expect(page.locator("th:has-text('ID')")).toBeVisible();
    await expect(page.locator("th:has-text('Script')")).toBeVisible();
    await expect(page.locator("th:has-text('Status')")).toBeVisible();
  });

  test("should have independent table scrolling", async ({ page }) => {
    await page.goto("/history");

    // Wait for table to load
    await page.waitForSelector("table.table", { timeout: 5000 });

    const cardBody = page.locator(".card-body.overflow-y-auto");
    await expect(cardBody).toBeVisible();

    // Check that card-body has overflow-y-auto class
    const classes = await cardBody.getAttribute("class");
    expect(classes).toContain("overflow-y-auto");

    // Verify card has max-height style for scrolling
    const style = await cardBody.locator("..")
      .evaluate((el) => window.getComputedStyle(el).maxHeight);
    expect(style).not.toBe("none");
  });

  test("should display success/failed badges", async ({ page }) => {
    await page.goto("/history");

    // Wait for table to load
    await page.waitForSelector("table.table", { timeout: 5000 });

    // Check for status badges
    const successBadges = page.locator(".badge.bg-success");
    const failedBadges = page.locator(".badge.bg-danger");

    // At least one should exist (depending on data)
    const successCount = await successBadges.count();
    const failedCount = await failedBadges.count();

    expect(successCount + failedCount).toBeGreaterThan(0);
  });
});
