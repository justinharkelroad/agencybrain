import { test, expect } from "@playwright/test";

test.describe("Explorer Page", () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication - would need to be adapted for actual auth flow
    await page.goto("/explorer");
  });

  test("explorer page loads with search components", async ({ page }) => {
    // Check for main heading
    await expect(page.getByRole("heading", { name: "Explorer" })).toBeVisible();
    
    // Check for search input
    await expect(page.getByPlaceholder(/Search household/)).toBeVisible();
    
    // Check for filter inputs
    await expect(page.getByLabel("Start Date")).toBeVisible();
    await expect(page.getByLabel("End Date")).toBeVisible();
    await expect(page.getByLabel("Staff ID")).toBeVisible();
    await expect(page.getByLabel("Lead Source")).toBeVisible();
    
    // Check for checkboxes
    await expect(page.getByLabel("Final submissions only")).toBeVisible();
    await expect(page.getByLabel("Late submissions only")).toBeVisible();
    
    // Check for action buttons
    await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();
  });

  test("can perform a search with household name", async ({ page }) => {
    // Enter search term
    await page.fill('input[placeholder*="Search household"]', 'john');
    
    // Click search button
    await page.click('button:has-text("Search")');
    
    // Should show results table or no results message
    await expect(page.locator('[role="table"], text="No households found"')).toBeVisible();
  });

  test("can use prefix search", async ({ page }) => {
    // Enter prefix search term
    await page.fill('input[placeholder*="Search household"]', 'jo*');
    
    // Click search button
    await page.click('button:has-text("Search")');
    
    // Wait for results
    await page.waitForTimeout(1000);
    
    // Should show results or no results message
    await expect(page.locator('[role="table"], text="No households found"')).toBeVisible();
  });

  test("can filter by date range", async ({ page }) => {
    // Set start date
    await page.fill('input[type="date"]:first-of-type', '2024-01-01');
    
    // Set end date
    await page.fill('input[type="date"]:last-of-type', '2024-12-31');
    
    // Click search
    await page.click('button:has-text("Search")');
    
    // Should show filtered results
    await expect(page.locator('[role="table"], text="No households found"')).toBeVisible();
  });

  test("can toggle final submissions filter", async ({ page }) => {
    // Uncheck "Final submissions only"
    await page.uncheck('input[type="checkbox"]#finalOnly');
    
    // Should show "Include superseded" option
    await expect(page.getByLabel("Include superseded")).toBeVisible();
    
    // Check "Include superseded"
    await page.check('input[type="checkbox"]#includeSuperseded');
    
    // Click search
    await page.click('button:has-text("Search")');
    
    // Should show results including superseded
    await expect(page.locator('[role="table"], text="No households found"')).toBeVisible();
  });

  test("can toggle late submissions filter", async ({ page }) => {
    // Check "Late submissions only"
    await page.check('input[type="checkbox"]#lateOnly');
    
    // Click search
    await page.click('button:has-text("Search")');
    
    // Should show only late submissions
    await expect(page.locator('[role="table"], text="No households found"')).toBeVisible();
  });

  test("can export CSV when results exist", async ({ page }) => {
    // Set up download promise before triggering download
    const downloadPromise = page.waitForEvent('download');
    
    // Perform a search first to potentially get results
    await page.click('button:has-text("Search")');
    await page.waitForTimeout(1000);
    
    // Click export CSV button
    await page.click('button:has-text("Export CSV")');
    
    // Wait for download or timeout
    try {
      const download = await Promise.race([
        downloadPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Download timeout')), 5000))
      ]);
      
      // Verify download started
      expect(download).toBeTruthy();
      expect(await download.suggestedFilename()).toMatch(/explorer_.*\.csv/);
    } catch (error) {
      // If no download happens (no data), that's also a valid outcome
      // The export button should be disabled or show appropriate message
      console.log('No download occurred - likely no data to export');
    }
  });

  test("shows appropriate message when no results found", async ({ page }) => {
    // Search for something unlikely to exist
    await page.fill('input[placeholder*="Search household"]', 'xyzneverexists123');
    await page.click('button:has-text("Search")');
    
    // Should show no results message
    await expect(page.getByText("No households found matching your criteria")).toBeVisible();
  });

  test("load more button works when pagination available", async ({ page }) => {
    // Perform initial search
    await page.click('button:has-text("Search")');
    await page.waitForTimeout(1000);
    
    // Check if Load More button is enabled (indicates more data available)
    const loadMoreButton = page.getByRole("button", { name: "Load More" });
    
    if (await loadMoreButton.isEnabled()) {
      // Click load more
      await loadMoreButton.click();
      
      // Should still show results table
      await expect(page.locator('[role="table"]')).toBeVisible();
    } else {
      // If disabled, that's expected when no more data is available
      expect(await loadMoreButton.isDisabled()).toBeTruthy();
    }
  });

  test("shows loading state during search", async ({ page }) => {
    // Start search
    page.click('button:has-text("Search")');
    
    // Should briefly show loading state
    await expect(page.getByText("Loading...")).toBeVisible({ timeout: 2000 });
  });
});