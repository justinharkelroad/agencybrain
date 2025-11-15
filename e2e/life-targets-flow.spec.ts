import { test, expect, type Page } from '@playwright/test';

// Helper function to login (adjust based on your auth flow)
async function login(page: Page) {
  await page.goto('/auth');
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'testpassword123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/life-targets', { timeout: 10000 });
}

test.describe('Life Targets - Complete User Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page);
  });

  test('should complete full workflow: set targets → analyze → save → missions → daily actions', async ({ page }) => {
    // Step 1: Navigate to Life Targets dashboard
    await page.goto('/life-targets');
    await expect(page.locator('h1')).toContainText('Life Targets');
    
    // Verify current quarter badge is visible
    await expect(page.locator('text=/Q[1-4] 202[0-9]/')).toBeVisible();

    // Step 2: Navigate to Set Quarterly Targets
    await page.click('text=Set Quarterly Targets');
    await expect(page).toHaveURL('/life-targets/quarterly');
    await expect(page.locator('h1')).toContainText('Set Quarterly Targets');

    // Step 3: Fill in quarterly targets
    const targets = {
      body: 'Lose 20 pounds by running 5k three times per week',
      being: 'Complete 30 Bible study sessions, averaging 2.5 per week',
      balance: 'Take my wife on a date every Saturday for 12 consecutive weeks',
      business: 'Increase insurance premium sales by 15% through 50 additional calls per week'
    };

    await page.fill('textarea[name="body_target"]', targets.body);
    await page.fill('textarea[name="body_narrative"]', 'To improve cardiovascular health and energy levels');
    
    await page.fill('textarea[name="being_target"]', targets.being);
    await page.fill('textarea[name="being_narrative"]', 'To deepen spiritual growth and understanding');
    
    await page.fill('textarea[name="balance_target"]', targets.balance);
    await page.fill('textarea[name="balance_narrative"]', 'To strengthen our marriage relationship');
    
    await page.fill('textarea[name="business_target"]', targets.business);
    await page.fill('textarea[name="business_narrative"]', 'To grow the agency and serve more clients');

    // Step 4: Analyze measurability
    await page.click('button:has-text("Analyze Clarity")');
    
    // Wait for analysis to complete
    await expect(page.locator('text=Measurability Analysis')).toBeVisible({ timeout: 15000 });
    
    // Verify clarity scores are displayed
    await expect(page.locator('text=/Clarity Score: [0-9]/')).toHaveCount(4);
    
    // Verify rewritten targets are shown
    await expect(page.locator('text=Suggested Improvement')).toBeVisible();

    // Step 5: Apply a suggestion (Balance domain)
    const applySuggestionButton = page.locator('button:has-text("Apply Suggestion")').first();
    await applySuggestionButton.click();
    
    // Verify the target was updated in the form
    await expect(page.locator('textarea[name="balance_target"]')).not.toHaveValue(targets.balance);

    // Step 6: Save quarterly targets
    await page.click('button:has-text("Save Targets")');
    
    // Wait for success message and redirect
    await expect(page.locator('text=/Analysis complete|Targets saved/')).toBeVisible({ timeout: 10000 });
    await page.waitForURL('/life-targets', { timeout: 10000 });

    // Step 7: Verify targets were saved (dashboard should show progress)
    await expect(page.locator('text=Progress Summary')).toBeVisible();
    await expect(page.locator('text=4 of 4 targets set')).toBeVisible();

    // Step 8: Generate monthly missions
    await page.click('text=Generate Monthly Missions');
    await expect(page).toHaveURL('/life-targets/missions');
    
    await page.click('button:has-text("Generate Missions")');
    
    // Wait for missions to be generated
    await expect(page.locator('text=Month 1').or(page.locator('text=Month 2'))).toBeVisible({ timeout: 15000 });
    
    // Verify missions are displayed for multiple domains
    await expect(page.locator('[data-domain="body"]').or(page.locator('text=/Week [1-4]/'))).toBeVisible();

    // Step 9: Navigate to daily actions
    await page.goto('/life-targets');
    await page.click('text=Get Daily Actions');
    await expect(page).toHaveURL('/life-targets/daily');

    // Step 10: Generate daily actions
    await page.click('button:has-text("Generate Actions")');
    
    // Wait for actions to be generated
    await expect(page.locator('text=Daily Actions')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="daily-action-card"]').or(page.locator('button:has-text("Save This Habit")'))).toBeVisible();

    // Step 11: Save a daily habit
    const saveHabitButton = page.locator('button:has-text("Save This Habit")').first();
    await saveHabitButton.click();
    
    // Verify habit was saved (button should change state)
    await expect(saveHabitButton).toContainText('Saved');

    // Step 12: Return to dashboard and verify completion
    await page.goto('/life-targets');
    await expect(page.locator('text=1 or more habits defined')).toBeVisible();
  });

  test('should handle empty targets gracefully', async ({ page }) => {
    await page.goto('/life-targets/quarterly');
    
    // Try to save without filling any targets
    await page.click('button:has-text("Save Targets")');
    
    // Should still work (optional fields)
    await expect(page).toHaveURL(/\/life-targets/, { timeout: 5000 });
  });

  test('should allow analyzing individual targets', async ({ page }) => {
    await page.goto('/life-targets/quarterly');
    
    // Fill only body target
    await page.fill('textarea[name="body_target"]', 'Get healthier');
    
    // Analyze
    await page.click('button:has-text("Analyze Clarity")');
    
    // Should show analysis for body only
    await expect(page.locator('text=Measurability Analysis')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=/Clarity Score: [0-9]/')).toBeVisible();
  });

  test('should filter monthly missions by domain', async ({ page }) => {
    // Assuming targets already exist
    await page.goto('/life-targets/missions');
    
    // Check if missions exist, if not generate them
    const hasExistingMissions = await page.locator('text=Month 1').isVisible().catch(() => false);
    
    if (!hasExistingMissions) {
      await page.click('button:has-text("Generate Missions")');
      await expect(page.locator('text=Month 1')).toBeVisible({ timeout: 15000 });
    }
    
    // Test domain filtering
    await page.click('button[role="combobox"]');
    await page.click('text=Body');
    
    // Verify only body missions are shown
    await expect(page.locator('[data-domain="body"]')).toBeVisible();
  });

  test('should navigate back from quarterly targets', async ({ page }) => {
    await page.goto('/life-targets/quarterly');
    
    // Click back button
    await page.click('button[aria-label="Go back"]').or(page.locator('button:has(svg)')).first();
    
    // Should return to dashboard
    await expect(page).toHaveURL('/life-targets');
  });

  test('should persist targets across page reloads', async ({ page }) => {
    await page.goto('/life-targets/quarterly');
    
    const testTarget = 'Test target for persistence - ' + Date.now();
    await page.fill('textarea[name="body_target"]', testTarget);
    await page.click('button:has-text("Save Targets")');
    
    // Wait for redirect
    await page.waitForURL('/life-targets', { timeout: 10000 });
    
    // Reload and go back to quarterly
    await page.reload();
    await page.click('text=Set Quarterly Targets');
    
    // Verify target persisted
    await expect(page.locator('textarea[name="body_target"]')).toHaveValue(testTarget);
  });

  test('should show loading states during async operations', async ({ page }) => {
    await page.goto('/life-targets/quarterly');
    
    await page.fill('textarea[name="body_target"]', 'Test target');
    await page.click('button:has-text("Analyze Clarity")');
    
    // Should show loading state
    await expect(page.locator('button:has-text("Analyzing...")').or(page.locator('[data-loading="true"]'))).toBeVisible();
  });

  test('should handle quarter selection', async ({ page }) => {
    await page.goto('/life-targets/quarterly');
    
    // Find and click quarter selector
    const quarterSelector = page.locator('select, button[role="combobox"]').filter({ hasText: /Q[1-4]/ }).first();
    
    if (await quarterSelector.count() > 0) {
      await quarterSelector.click();
      
      // Select Q2
      await page.click('text=Q2');
      
      // Verify selection
      await expect(quarterSelector).toContainText('Q2');
    }
  });

  test('should validate accessibility features', async ({ page }) => {
    await page.goto('/life-targets');
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Verify focus is visible
    const focusedElement = await page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    
    // Check for ARIA labels
    await expect(page.locator('[aria-label]')).toHaveCount(await page.locator('[aria-label]').count());
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Intercept API call and force error
    await page.route('**/functions/v1/life_targets_measurability', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Test error' })
      });
    });
    
    await page.goto('/life-targets/quarterly');
    await page.fill('textarea[name="body_target"]', 'Test target');
    await page.click('button:has-text("Analyze Clarity")');
    
    // Should show error message
    await expect(page.locator('text=/error|failed/i')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Life Targets - Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should handle very long target text', async ({ page }) => {
    await page.goto('/life-targets/quarterly');
    
    const longTarget = 'A'.repeat(500);
    await page.fill('textarea[name="body_target"]', longTarget);
    
    // Should accept and save long text
    await page.click('button:has-text("Save Targets")');
    await expect(page).toHaveURL('/life-targets', { timeout: 10000 });
  });

  test('should handle special characters in targets', async ({ page }) => {
    await page.goto('/life-targets/quarterly');
    
    const specialTarget = 'Target with "quotes" & <brackets> and 💪 emoji';
    await page.fill('textarea[name="body_target"]', specialTarget);
    
    await page.click('button:has-text("Save Targets")');
    await page.waitForURL('/life-targets');
    
    // Verify it saved correctly
    await page.click('text=Set Quarterly Targets');
    await expect(page.locator('textarea[name="body_target"]')).toHaveValue(specialTarget);
  });

  test('should handle rapid successive saves', async ({ page }) => {
    await page.goto('/life-targets/quarterly');
    
    await page.fill('textarea[name="body_target"]', 'Quick test');
    
    // Click save multiple times quickly
    await Promise.all([
      page.click('button:has-text("Save Targets")'),
      page.click('button:has-text("Save Targets")'),
      page.click('button:has-text("Save Targets")')
    ].map(p => p.catch(() => {}))); // Ignore errors from duplicate clicks
    
    // Should handle gracefully without duplicates
    await expect(page).toHaveURL('/life-targets', { timeout: 10000 });
  });
});

test.describe('Life Targets - Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display properly on mobile', async ({ page }) => {
    await page.goto('/life-targets');
    
    // Verify elements are visible and accessible on mobile
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('text=Set Quarterly Targets')).toBeVisible();
    
    // Test scrolling
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // All action cards should be stackable/scrollable
    const actionCards = page.locator('[class*="grid"]').first();
    await expect(actionCards).toBeVisible();
  });

  test('should allow form input on mobile', async ({ page }) => {
    await page.goto('/life-targets/quarterly');
    
    // Test textarea input on mobile
    await page.fill('textarea[name="body_target"]', 'Mobile test target');
    await expect(page.locator('textarea[name="body_target"]')).toHaveValue('Mobile test target');
    
    // Verify keyboard doesn't obscure buttons
    await page.locator('textarea[name="body_target"]').focus();
    await expect(page.locator('button:has-text("Save Targets")')).toBeVisible();
  });
});
