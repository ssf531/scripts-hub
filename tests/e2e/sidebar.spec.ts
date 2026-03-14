import { test, expect } from "@playwright/test";

test.describe("Sidebar", () => {
  test("should collapse and expand sidebar", async ({ page }) => {
    await page.goto("/");
    const sidebar = page.locator("div[style*='width']").first();
    const toggleButton = page.locator(".navbar button").last();

    // Initially expanded (on desktop)
    const initialWidth = await sidebar.evaluate((el) =>
      window.getComputedStyle(el).width
    );
    expect(parseFloat(initialWidth)).toBeGreaterThan(100);

    // Collapse
    await toggleButton.click();
    await page.waitForTimeout(400); // Wait for transition

    const collapsedWidth = await sidebar.evaluate((el) =>
      window.getComputedStyle(el).width
    );
    expect(parseFloat(collapsedWidth)).toBeLessThan(100);

    // Expand
    await toggleButton.click();
    await page.waitForTimeout(400); // Wait for transition

    const expandedWidth = await sidebar.evaluate((el) =>
      window.getComputedStyle(el).width
    );
    expect(parseFloat(expandedWidth)).toBeGreaterThan(100);
  });

  test("should show/hide nav labels on collapse", async ({ page }) => {
    await page.goto("/");
    const toggleButton = page.locator(".navbar button").last();

    // Initially expanded
    await expect(page.locator("text=Dashboard")).toBeVisible();
    await expect(page.locator("text=History")).toBeVisible();

    // Collapse
    await toggleButton.click();
    await page.waitForTimeout(400);

    // Labels hidden
    await expect(page.locator("text=Dashboard")).not.toBeVisible();
    await expect(page.locator("text=History")).not.toBeVisible();

    // Expand
    await toggleButton.click();
    await page.waitForTimeout(400);

    // Labels visible again
    await expect(page.locator("text=Dashboard")).toBeVisible();
    await expect(page.locator("text=History")).toBeVisible();
  });

  test("should auto-collapse on small screens", async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 600, height: 800 });
    await page.goto("/");

    const toggleButton = page.locator(".navbar button").last();
    const sidebar = page.locator(".navbar").first();

    // Should be collapsed on initial load
    const width = await sidebar.evaluate((el) =>
      window.getComputedStyle(el).width
    );
    expect(parseFloat(width)).toBeLessThan(100);
  });

  test("should auto-expand on large screens", async ({ page }) => {
    // Start with mobile size
    await page.setViewportSize({ width: 600, height: 800 });
    await page.goto("/");

    // Resize to desktop
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(400); // Wait for resize handler

    const sidebar = page.locator(".navbar").first();
    const width = await sidebar.evaluate((el) =>
      window.getComputedStyle(el).width
    );
    expect(parseFloat(width)).toBeGreaterThan(100);
  });

  test("should display v1.0 text when expanded", async ({ page }) => {
    await page.goto("/");
    const toggleButton = page.locator(".navbar button").last();

    // Should show v1.0 when expanded
    await expect(page.locator("text=v1.0")).toBeVisible();

    // Collapse
    await toggleButton.click();
    await page.waitForTimeout(400);

    // v1.0 should be hidden
    await expect(page.locator("text=v1.0")).not.toBeVisible();
  });
});
