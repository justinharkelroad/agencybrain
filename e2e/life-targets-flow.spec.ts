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
    await login(page);
  });

  test('should complete full workflow: set targets → analyze → save → missions → multi-select daily actions → cascade view', async ({ page }) => {
    // Step 1: Navigate to Life Targets dashboard
    await page.goto('/life-targets');
    await expect(page.locator('h1')).toContainText('Life Targets');
    
    // Verify quarter selector is visible with new YYYY-QX format
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
    await expect(page.locator('[data-domain="body"]').or(page.locator('text=/Week [1-4]/'))).toBeVisible();

    // Step 9: Navigate to daily actions
    await page.goto('/life-targets');
    await page.click('text=Get Daily Actions');
    await expect(page).toHaveURL('/life-targets/daily');

    // Step 10: Generate daily actions
    await page.click('button:has-text("Generate Actions")');
    
    // Wait for actions to be generated (multi-select interface)
    await expect(page.locator('text=Daily Actions')).toBeVisible({ timeout: 15000 });
    
    // Verify multi-select checkboxes are present for each domain
    const checkboxCount = await page.locator('input[type="checkbox"]').count();
    expect(checkboxCount).toBeGreaterThanOrEqual(4);

    // Step 11: Multi-select daily actions
    // Select at least one action from each domain
    const checkboxes = await page.locator('input[type="checkbox"]').all();
    
    // Select first 4 actions (one from each domain)
    for (let i = 0; i < Math.min(4, checkboxes.length); i++) {
      await checkboxes[i].check();
    }

    // Verify selection counts are displayed
    await expect(page.locator('text=/\\d+ selected/i')).toHaveCount(4);

    // Step 12: Verify "Continue" button is enabled after selections
    const continueButton = page.locator('button:has-text("Continue to Cascade View")');
    await expect(continueButton).toBeEnabled();
    
    // Navigate to cascade view
    await continueButton.click();
    await expect(page).toHaveURL('/life-targets/cascade');

    // Step 13: Verify cascade view renders correctly
    await expect(page.locator('h1')).toContainText('Cascading Targets View');
    
    // Verify all 4 domain cards are present
    await expect(page.locator('text=Body')).toBeVisible();
    await expect(page.locator('text=Being')).toBeVisible();
    await expect(page.locator('text=Balance')).toBeVisible();
    await expect(page.locator('text=Business')).toBeVisible();

    // Verify selected daily actions appear in cascade view
    await expect(page.locator('text=/Daily Actions \\(\\d+\\)/i')).toBeVisible();

    // Step 14: Test adding a new action in cascade view
    const addActionInput = page.locator('input[placeholder="Add a daily action..."]').first();
    await addActionInput.fill('Morning meditation for 10 minutes');
    await addActionInput.press('Enter');
    
    // Verify action was added
    await expect(page.locator('text=Morning meditation for 10 minutes')).toBeVisible({ timeout: 3000 });

    // Step 15: Test removing an action
    const removeButtons = page.locator('button').filter({ has: page.locator('svg') });
    const trashButton = removeButtons.filter({ hasText: '' }).first();
    await trashButton.click();
    
    // Action count should update or item should disappear

    // Step 16: Test inline editing of quarterly target
    const editButtons = page.locator('button').filter({ has: page.locator('svg') });
    const editButton = editButtons.first();
    await editButton.click();
    
    // Edit the target
    const targetTextarea = page.locator('textarea').first();
    await targetTextarea.fill('Updated target with more specific metrics');
    
    // Save the edit
    await page.locator('button:has-text("Save")').first().click();
    
    // Verify success toast
    await expect(page.locator('text=/updated|saved/i')).toBeVisible({ timeout: 5000 });

    // Step 17: Test "Save All Changes" button
    const saveAllButton = page.locator('button:has-text("Save All Changes")');
    await expect(saveAllButton).toBeVisible();
    await saveAllButton.click();
    
    // Should show success message
    await expect(page.locator('text=/All changes saved successfully/i')).toBeVisible({ timeout: 5000 });
    
    // Should navigate back to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });
  });

  test('should handle empty daily action selections gracefully', async ({ page }) => {
    await page.goto('/life-targets/daily');
    
    // Try to continue without selecting any actions
    const continueButton = page.locator('button:has-text("Continue to Cascade View")');
    
    // Button should be disabled when no selections
    await expect(continueButton).toBeDisabled();
  });

  test('should persist daily action selections across reload', async ({ page }) => {
    await page.goto('/life-targets/daily');
    
    // Generate actions if button exists
    const generateButton = page.locator('button:has-text("Generate Actions")');
    const buttonExists = await generateButton.isVisible().catch(() => false);
    
    if (buttonExists) {
      await generateButton.click();
      await expect(page.locator('input[type="checkbox"]')).toHaveCount({ timeout: 15000 }, 4);
      
      // Select some actions
      const checkboxes = await page.locator('input[type="checkbox"]').all();
      for (let i = 0; i < Math.min(2, checkboxes.length); i++) {
        await checkboxes[i].check();
      }
      
      // Reload page
      await page.reload();
      
      // Selections should persist (from Zustand store)
      const checkedBoxes = await page.locator('input[type="checkbox"]:checked').count();
      expect(checkedBoxes).toBeGreaterThan(0);
    }
  });

  test('should show domain-specific action counts', async ({ page }) => {
    await page.goto('/life-targets/daily');
    
    // Generate actions if needed
    const generateButton = page.locator('button:has-text("Generate Actions")');
    const buttonExists = await generateButton.isVisible().catch(() => false);
    
    if (buttonExists) {
      await generateButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Select an action
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    const checkboxVisible = await firstCheckbox.isVisible().catch(() => false);
    
    if (checkboxVisible) {
      await firstCheckbox.check();
      
      // Verify count updates
      await expect(page.locator('text=/1 selected/i')).toBeVisible();
    }
  });

  test('should allow cancel during inline editing', async ({ page }) => {
    await page.goto('/life-targets/cascade');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Try to find edit button
    const editButtons = page.locator('button').filter({ has: page.locator('svg') });
    const editButtonCount = await editButtons.count();
    
    if (editButtonCount > 0) {
      await editButtons.first().click();
      
      // Edit the content
      const textarea = page.locator('textarea').first();
      const originalValue = await textarea.inputValue();
      await textarea.fill('Modified content');
      
      // Click cancel
      const cancelButton = page.locator('button:has-text("Cancel")').first();
      await cancelButton.click();
      
      // Content should revert - check that modified text is not visible
      const modifiedText = page.locator('text=Modified content');
      await expect(modifiedText).not.toBeVisible();
    }
  });

  test('should show back button and navigate correctly', async ({ page }) => {
    await page.goto('/life-targets/cascade');
    
    // Click back button (look for ArrowLeft icon)
    const backButton = page.locator('button').first();
    await backButton.click();
    
    // Should return to daily actions page
    await expect(page).toHaveURL('/life-targets/daily');
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

  test('should navigate back from quarterly targets', async ({ page }) => {
    await page.goto('/life-targets/quarterly');
    
    // Click back button (first button with SVG)
    await page.locator('button').first().click();
    
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
    
    // Fill a target
    await page.fill('textarea[name="body_target"]', 'Test loading state');
    
    // Click analyze and check for loading state
    await page.click('button:has-text("Analyze Clarity")');
    
    // Loading indicator should appear
    const loadingIndicator = page.locator('text=/analyzing|loading/i').or(page.locator('[role="status"]'));
    const hasLoading = await loadingIndicator.isVisible({ timeout: 2000 }).catch(() => false);
    
    // Either loading appears or analysis completes quickly
    expect(hasLoading || await page.locator('text=Measurability Analysis').isVisible().catch(() => false)).toBeTruthy();
  });
});

test.describe('Life Targets - Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should handle very long input text', async ({ page }) => {
    await page.goto('/life-targets/quarterly');
    
    const longText = 'Very long target text '.repeat(50);
    await page.fill('textarea[name="body_target"]', longText);
    
    // Should still save successfully
    await page.click('button:has-text("Save Targets")');
    await expect(page).toHaveURL('/life-targets', { timeout: 10000 });
  });

  test('should handle special characters in targets', async ({ page }) => {
    await page.goto('/life-targets/quarterly');
    
    await page.fill('textarea[name="body_target"]', 'Target with émojis 🎯 and spëcial çhars!@#$%');
    await page.click('button:has-text("Save Targets")');
    
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
    
    // Main content should be visible
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should allow scrolling on mobile', async ({ page }) => {
    await page.goto('/life-targets/quarterly');
    
    // Page should be scrollable
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    const clientHeight = await page.evaluate(() => document.documentElement.clientHeight);
    
    expect(scrollHeight).toBeGreaterThan(clientHeight);
  });

  test('should handle form inputs on mobile', async ({ page }) => {
    await page.goto('/life-targets/quarterly');
    
    // Tap into textarea
    await page.locator('textarea[name="body_target"]').click();
    
    // Type on mobile keyboard
    await page.keyboard.type('Mobile test target');
    
    // Input should work
    await expect(page.locator('textarea[name="body_target"]')).toHaveValue('Mobile test target');
  });
});
