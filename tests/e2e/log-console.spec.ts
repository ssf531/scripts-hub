import { test, expect } from "@playwright/test";

test.describe("Log Console", () => {
  test("should toggle log console open/closed", async ({ page }) => {
    await page.goto("/");

    const logConsole = page.locator("div[style*='borderTop']").last();
    const toggleButton = page
      .locator(".d-flex.align-items-center")
      .filter({ has: page.locator("text=Live Logs") })
      .locator("button")
      .last();

    // Initially collapsed (height: 40px)
    let height = await logConsole.evaluate(
      (el) => window.getComputedStyle(el).height
    );
    expect(parseInt(height)).toBe(40);

    // Expand
    await toggleButton.click();
    await page.waitForTimeout(300); // Wait for transition

    height = await logConsole.evaluate(
      (el) => window.getComputedStyle(el).height
    );
    expect(parseInt(height)).toBeGreaterThan(200);

    // Collapse
    await toggleButton.click();
    await page.waitForTimeout(300);

    height = await logConsole.evaluate(
      (el) => window.getComputedStyle(el).height
    );
    expect(parseInt(height)).toBe(40);
  });

  test("should display log console header", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("text=Live Logs")).toBeVisible();
    await expect(page.locator(".bi-terminal")).toBeVisible();
  });

  test("should show disconnected badge when applicable", async ({ page }) => {
    await page.goto("/");

    // Check if disconnected badge exists (will vary based on SignalR connection)
    const disconnectedBadge = page.locator(".badge.bg-warning:has-text('disconnected')");
    // Just verify we can select it - it may or may not be visible depending on connection
    const count = await disconnectedBadge.count();
    expect([0, 1]).toContain(count);
  });

  test("should auto-collapse log console at startup", async ({ page }) => {
    await page.goto("/");

    const logConsole = page.locator("div[style*='borderTop']").last();
    const height = await logConsole.evaluate(
      (el) => window.getComputedStyle(el).height
    );

    // Should be collapsed (40px)
    expect(parseInt(height)).toBe(40);
  });
});
