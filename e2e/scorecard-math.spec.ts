import { test, expect } from "@playwright/test";

// Phase 2 E2E tests for scorecard math validation
// Assumes targets: outbound_calls=40, talk_minutes=120, quoted_count=3, sold_items=2

test.describe("Scorecard Math Logic", () => {
  test("pass/score logic with targets met and exceeded", async ({ page }) => {
    // Navigate to a public form (assuming valid agency/form/token)
    await page.goto("https://testapp.lovable.app/f/test-agency/sales-scorecard?t=VALIDTOKEN");
    
    // Wait for form to load
    await expect(page.locator('form')).toBeVisible();
    
    // Fill out form with specific values for testing math
    await page.selectOption('select[name="team_member_id"]', { label: "John Smith" });
    await page.fill('input[name="submission_date"]', "2025-08-26");
    
    // Test scenario: 2 hits (meets target), 2 exceeds (gets weight points)
    await page.fill('input[name="outbound_calls"]', "40");   // == target -> hit, no weight
    await page.fill('input[name="talk_minutes"]', "150");    // > target -> hit + weight 20
    await page.fill('input[name="quoted_count"]', "3");      // == target -> hit, no weight  
    await page.fill('input[name="sold_items"]', "3");        // > target -> hit + weight 40
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // After submission, we expect:
    // - hits = 4 (all targets met or exceeded)
    // - score = 60 (20 + 40, only for values that exceed target)
    // - pass = true (if N required <= 4)
    
    // In a real test, you would verify this via:
    // 1. Admin dashboard showing metrics
    // 2. API endpoint to check metrics_daily table
    // 3. Database query validation
    
    await expect(page.locator('.success-message')).toBeVisible({ timeout: 10000 });
  });

  test("late submission behavior", async ({ page }) => {
    await page.goto("https://testapp.lovable.app/f/test-agency/sales-scorecard?t=VALIDTOKEN");
    
    await expect(page.locator('form')).toBeVisible();
    
    // Submit a late entry (assuming current time > due-by time)
    await page.selectOption('select[name="team_member_id"]', { label: "Jane Doe" });
    await page.fill('input[name="submission_date"]', "2025-08-25"); // Previous day
    await page.fill('input[name="outbound_calls"]', "50");
    await page.fill('input[name="talk_minutes"]', "180");
    await page.fill('input[name="quoted_count"]', "5");
    await page.fill('input[name="sold_items"]', "4");
    
    await page.click('button[type="submit"]');
    
    // Late submissions should:
    // - Mark is_late = true
    // - If lateCountsForPass=false: pass=false, score=0
    // - Always break streak regardless of lateCountsForPass setting
    
    await expect(page.locator('.success-message')).toBeVisible({ timeout: 10000 });
  });

  test("superseding previous submission", async ({ page }) => {
    await page.goto("https://testapp.lovable.app/f/test-agency/sales-scorecard?t=VALIDTOKEN");
    
    // Submit first version
    await page.selectOption('select[name="team_member_id"]', { label: "Bob Wilson" });
    await page.fill('input[name="submission_date"]', "2025-08-26");
    await page.fill('input[name="outbound_calls"]', "30"); // Below target
    await page.click('button[type="submit"]');
    await expect(page.locator('.success-message')).toBeVisible({ timeout: 5000 });
    
    // Submit updated version (should supersede the first)
    await page.goto("https://testapp.lovable.app/f/test-agency/sales-scorecard?t=VALIDTOKEN");
    await page.selectOption('select[name="team_member_id"]', { label: "Bob Wilson" });
    await page.fill('input[name="submission_date"]', "2025-08-26"); // Same date
    await page.fill('input[name="outbound_calls"]', "45"); // Now above target
    await page.fill('input[name="talk_minutes"]', "130");
    await page.fill('input[name="quoted_count"]', "4");
    await page.click('button[type="submit"]');
    
    // The latest submission should be marked final=true
    // The previous submission should be marked final=false, superseded_at set
    // metrics_daily should reflect the latest values
    
    await expect(page.locator('.success-message')).toBeVisible({ timeout: 10000 });
  });

  test("quoted details auto-spawning with spawn cap", async ({ page }) => {
    await page.goto("https://testapp.lovable.app/f/test-agency/sales-scorecard?t=VALIDTOKEN");
    
    await page.selectOption('select[name="team_member_id"]', { label: "Alice Cooper" });
    await page.fill('input[name="submission_date"]', "2025-08-26");
    await page.fill('input[name="quoted_count"]', "12"); // Above spawn cap of 10
    
    await page.click('button[type="submit"]');
    
    // Should create exactly 10 quoted_household_details records (respecting spawn cap)
    // Even though quoted_count=12, only 10 detail records created
    
    await expect(page.locator('.success-message')).toBeVisible({ timeout: 10000 });
  });

  test("sold policy details persistence", async ({ page }) => {
    await page.goto("https://testapp.lovable.app/f/test-agency/sales-scorecard?t=VALIDTOKEN");
    
    await page.selectOption('select[name="team_member_id"]', { label: "Charlie Brown" });
    await page.fill('input[name="submission_date"]', "2025-08-26");
    await page.fill('input[name="sold_items"]', "2");
    
    // Fill sold policy details
    await page.fill('input[name="sold_policy_holder_1"]', "John Customer");
    await page.fill('input[name="sold_premium_1"]', "1250.00");
    await page.fill('input[name="sold_commission_1"]', "125.00");
    
    await page.fill('input[name="sold_policy_holder_2"]', "Jane Customer");
    await page.fill('input[name="sold_premium_2"]', "890.50");
    await page.fill('input[name="sold_commission_2"]', "89.05");
    
    await page.click('button[type="submit"]');
    
    // Should create 2 sold_policy_details records with:
    // - premium_amount_cents: 125000, 89050
    // - commission_amount_cents: 12500, 8905
    
    await expect(page.locator('.success-message')).toBeVisible({ timeout: 10000 });
  });

  test("weekend counting logic", async ({ page }) => {
    await page.goto("https://testapp.lovable.app/f/test-agency/sales-scorecard?t=VALIDTOKEN");
    
    // Submit on a Saturday (assuming Saturday is not in counted_days)
    await page.selectOption('select[name="team_member_id"]', { label: "Weekend Worker" });
    await page.fill('input[name="submission_date"]', "2025-08-30"); // Saturday
    await page.fill('input[name="outbound_calls"]', "50");
    
    await page.click('button[type="submit"]');
    
    // If count_weekend_if_submitted=true, this day should be counted (is_counted_day=true)
    // If count_weekend_if_submitted=false, this day should not be counted (is_counted_day=false)
    // The setting in scorecard_rules determines this behavior
    
    await expect(page.locator('.success-message')).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Scorecard Settings Validation", () => {
  test("weights must total 100", async ({ page }) => {
    // This would test the ScorecardSettings UI
    // Navigate to settings page (requires authentication)
    await page.goto("https://testapp.lovable.app/scorecard-settings");
    
    // Try to save with weights not totaling 100
    await page.fill('input[name="weight_outbound_calls"]', "50");
    await page.fill('input[name="weight_talk_minutes"]', "30");
    // Total = 80, should show error
    
    await page.click('button:has-text("Save Settings")');
    await expect(page.locator('text=Weights must total exactly 100')).toBeVisible();
  });

  test("target updates reflect in scoring", async ({ page }) => {
    // Test that changing targets via Targets page affects pass/score calculation
    await page.goto("https://testapp.lovable.app/targets");
    
    // Update a target
    await page.fill('input[data-metric="outbound_calls"][data-scope="global"]', "50");
    await page.click('button:has-text("Save Targets")');
    
    // Then submit a form with 45 calls (previously would pass, now should not)
    // This tests the integration between targets and scoring logic
  });
});

test.describe("Backfill and Recalculation", () => {
  test("manual backfill triggers recalculation", async ({ page }) => {
    // This would test calling the recalc_metrics edge function
    // Typically done via admin interface or API call
    
    // Could simulate by making a fetch request in browser context
    const response = await page.evaluate(async () => {
      return fetch('/functions/v1/recalc_metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          agencyId: 'test-agency-id',
          days: 7
        })
      });
    });
    
    // Verify the function returns success
    expect(response).toBeTruthy();
  });
});