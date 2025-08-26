import { test, expect } from '@playwright/test';

// E2E tests for the complete form submission flow
test.describe('Public Form Submission E2E', () => {
  const baseUrl = 'https://test-agency.myagencybrain.com';
  
  test.beforeEach(async ({ page }) => {
    // Setup test data if needed
    await page.goto('/');
  });

  test('Valid URL renders form correctly', async ({ page }) => {
    const validUrl = `${baseUrl}/f/test-form?t=valid-token-123`;
    await page.goto(validUrl);
    
    // Should show form loading then form content
    await expect(page.locator('[data-testid="form-container"]')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Test Form');
  });

  test('Bad slug returns 404', async ({ page }) => {
    const invalidUrl = `${baseUrl}/f/nonexistent-form?t=valid-token-123`;
    await page.goto(invalidUrl);
    
    // Should show not found view
    await expect(page.locator('h1')).toContainText('Form Not Found');
    await expect(page.locator('button')).toContainText('Go Back');
  });

  test('Bad token returns 404', async ({ page }) => {
    const invalidTokenUrl = `${baseUrl}/f/test-form?t=invalid-token`;
    await page.goto(invalidTokenUrl);
    
    // Should show not found view
    await expect(page.locator('h1')).toContainText('Form Not Found');
  });

  test('Cross-agency host returns 404', async ({ page }) => {
    const crossAgencyUrl = 'https://wrong-agency.myagencybrain.com/f/test-form?t=valid-token-123';
    await page.goto(crossAgencyUrl);
    
    // Should show not found view
    await expect(page.locator('h1')).toContainText('Form Not Found');
  });

  test('Expired link returns 410', async ({ page }) => {
    const expiredUrl = `${baseUrl}/f/test-form?t=expired-token-123`;
    await page.goto(expiredUrl);
    
    // Should show expired view
    await expect(page.locator('h1')).toContainText('Form Expired');
    await expect(page.locator('text=expired')).toBeVisible();
  });

  test('Disabled form returns 404', async ({ page }) => {
    const disabledUrl = `${baseUrl}/f/disabled-form?t=valid-token-123`;
    await page.goto(disabledUrl);
    
    // Should show disabled view
    await expect(page.locator('h1')).toContainText('Form Disabled');
  });

  test('Form submission flow works end-to-end', async ({ page }) => {
    const validUrl = `${baseUrl}/f/test-form?t=valid-token-123`;
    await page.goto(validUrl);
    
    // Wait for form to load
    await expect(page.locator('[data-testid="form-container"]')).toBeVisible();
    
    // Fill out form fields
    await page.selectOption('select[name="team_member_id"]', { index: 1 });
    await page.fill('input[name="submission_date"]', '2024-01-15');
    await page.fill('input[name="work_date"]', '2024-01-15');
    
    // Fill KPI fields if they exist
    const kpiFields = page.locator('input[data-kpi]');
    const count = await kpiFields.count();
    for (let i = 0; i < count; i++) {
      await kpiFields.nth(i).fill('5');
    }
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should show success message
    await expect(page.locator('text=submitted successfully')).toBeVisible();
  });

  test('Form shows loading skeleton initially', async ({ page }) => {
    const validUrl = `${baseUrl}/f/test-form?t=valid-token-123`;
    
    // Intercept network to delay response
    await page.route('**/resolve_public_form*', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.continue();
    });
    
    await page.goto(validUrl);
    
    // Should show loading skeleton
    await expect(page.locator('[data-testid="loading-skeleton"]')).toBeVisible();
  });

  test('Analytics are tracked on form access', async ({ page }) => {
    const validUrl = `${baseUrl}/f/test-form?t=valid-token-123`;
    
    // Monitor network requests
    const analyticsRequests: any[] = [];
    page.on('request', request => {
      if (request.url().includes('form_link_analytics')) {
        analyticsRequests.push(request);
      }
    });
    
    await page.goto(validUrl);
    await page.waitForLoadState('networkidle');
    
    // Should have made analytics request
    expect(analyticsRequests.length).toBeGreaterThan(0);
  });
});

// Performance tests
test.describe('Performance Tests', () => {
  test('Form loads within performance budget', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('https://test-agency.myagencybrain.com/f/test-form?t=valid-token-123');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Target: <300ms cold start
    expect(loadTime).toBeLessThan(300);
  });

  test('Warm requests are faster', async ({ page }) => {
    // Make initial request to warm up
    await page.goto('https://test-agency.myagencybrain.com/f/test-form?t=valid-token-123');
    await page.waitForLoadState('networkidle');
    
    // Measure second request
    const startTime = Date.now();
    await page.reload();
    await page.waitForLoadState('networkidle');
    const warmLoadTime = Date.now() - startTime;
    
    // Target: <150ms warm
    expect(warmLoadTime).toBeLessThan(150);
  });
});