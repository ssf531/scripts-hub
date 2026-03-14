import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("should navigate to all main pages", async ({ page }) => {
    await page.goto("/");

    // Dashboard
    await expect(page).toHaveURL("/");
    await expect(page.locator("h3")).toContainText("Script Dashboard");

    // M3U8 Downloader
    await page.click("text=M3U8 Downloader");
    await expect(page).toHaveURL("/m3u8-downloader");

    // PDF Parser
    await page.click("text=PDF Parser");
    await expect(page).toHaveURL("/pdf-parser");

    // Spending Analysis
    await page.click("text=Spending Analysis");
    await expect(page).toHaveURL("/spending-analysis");

    // History
    await page.click("text=History");
    await expect(page).toHaveURL("/history");
    await expect(page.locator("h3")).toContainText("Recent Script Runs");

    // Settings
    await page.click("text=Settings");
    await expect(page).toHaveURL("/settings");
  });

  test("should highlight active nav item", async ({ page }) => {
    await page.goto("/");

    const dashboardLink = page.locator("a:has-text('Dashboard')").first();
    await expect(dashboardLink).toHaveClass(/bg-primary/);

    await page.click("text=History");
    const historyLink = page.locator("a:has-text('History')").first();
    await expect(historyLink).toHaveClass(/bg-primary/);
  });

  test("should display nav items in correct order", async ({ page }) => {
    await page.goto("/");

    const navItems = page.locator(".nav-link");
    const labels = await navItems.allTextContents();

    const expectedOrder = [
      "Dashboard",
      "M3U8 Downloader",
      "PDF Parser",
      "Spending Analysis",
      "History",
      "Settings",
    ];

    // Check order (some may be truncated when collapsed, so check partial matches)
    for (let i = 0; i < expectedOrder.length; i++) {
      expect(labels[i]).toContain(expectedOrder[i]);
    }
  });
});
