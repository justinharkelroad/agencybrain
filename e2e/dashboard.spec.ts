import { test, expect } from "@playwright/test";

test.describe("Metrics Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    // This test assumes you have authentication set up
    // You may need to adjust this based on your auth implementation
    await page.goto("/auth");
    // Add authentication steps here if needed
  });

  test("dashboard loads and shows main components", async ({ page }) => {
    await page.goto("/metrics-dashboard");
    
    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="metrics-dashboard"]', { timeout: 10000 });
    
    // Check for main dashboard elements
    await expect(page.getByText("Metrics Dashboard")).toBeVisible();
    await expect(page.getByText("Dashboard Controls")).toBeVisible();
    
    // Check for role selector
    await expect(page.locator('select').first()).toBeVisible();
    
    // Check for export button
    await expect(page.getByRole("button", { name: /CSV/i })).toBeVisible();
  });

  test("can toggle between sales and service roles", async ({ page }) => {
    await page.goto("/metrics-dashboard");
    await page.waitForSelector('[data-testid="metrics-dashboard"]', { timeout: 10000 });
    
    // Select Service role
    await page.selectOption('select', { label: 'Service' });
    
    // Wait for data to reload
    await page.waitForTimeout(1000);
    
    // Switch back to Sales
    await page.selectOption('select', { label: 'Sales' });
  });

  test("can export CSV data", async ({ page }) => {
    await page.goto("/metrics-dashboard");
    await page.waitForSelector('[data-testid="metrics-dashboard"]', { timeout: 10000 });
    
    // Set up download listener
    const downloadPromise = page.waitForEvent('download');
    
    // Click export button
    await page.getByRole("button", { name: /CSV/i }).click();
    
    // Wait for download
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/dashboard_.*\.csv/);
  });

  test("date range controls work", async ({ page }) => {
    await page.goto("/metrics-dashboard");
    await page.waitForSelector('[data-testid="metrics-dashboard"]', { timeout: 10000 });
    
    // Change start date
    const startDate = page.locator('input[type="date"]').first();
    await startDate.fill('2024-01-01');
    
    // Change end date
    const endDate = page.locator('input[type="date"]').nth(1);
    await endDate.fill('2024-01-31');
    
    // Wait for data to reload
    await page.waitForTimeout(1000);
  });
});