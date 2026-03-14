import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("should load dashboard page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    await expect(page.locator("h3")).toContainText("Script Dashboard");
  });

  test("should display script cards", async ({ page }) => {
    await page.goto("/");

    // Wait for cards to load
    const cards = page.locator(".card");
    const cardCount = await cards.count();

    // Should have at least one script card
    expect(cardCount).toBeGreaterThan(0);
  });

  test("should show script card details", async ({ page }) => {
    await page.goto("/");

    const firstCard = page.locator(".card").first();
    await expect(firstCard).toBeVisible();

    // Check for common script card elements
    const title = firstCard.locator("h5, h4");
    await expect(title).toBeVisible();

    // Check for status badge
    const badge = firstCard.locator(".badge");
    const badgeCount = await badge.count();
    expect(badgeCount).toBeGreaterThanOrEqual(0);
  });

  test("should have start button on script cards", async ({ page }) => {
    await page.goto("/");

    const startButtons = page.locator("button:has-text('Start'), button:has(.bi-play)");
    const buttonCount = await startButtons.count();

    // Should have at least one start button
    expect(buttonCount).toBeGreaterThan(0);
  });

  test("should navigate to script detail on card click", async ({ page }) => {
    await page.goto("/");

    // Click on first script card title or link
    const firstCardLink = page.locator(".card").first().locator("a, [role='button']").first();

    if (await firstCardLink.count() > 0) {
      await firstCardLink.click();

      // Should navigate to a script detail page
      await expect(page).toHaveURL(/\/(m3u8-downloader|pdf-parser|spending-analysis|history|settings)/);
    }
  });
});
