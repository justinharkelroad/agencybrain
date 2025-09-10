import { test, expect } from '@playwright/test';

// Gate F: End-to-End Submission Flow Tests
test.describe('Form Submission E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication for testing
    await page.route('**/auth/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { session: { user: { id: 'test-user' } } },
          error: null,
        }),
      });
    });
  });

  test('Gate F: Complete form submission workflow', async ({ page }) => {
    // Navigate to form builder
    await page.goto('/scorecard-forms');
    
    // Create a new form
    await page.click('text=Create New Form');
    await page.fill('[data-testid="form-title"]', 'Test Daily Scorecard');
    await page.fill('[data-testid="form-slug"]', 'test-daily-scorecard');
    
    // Add KPI fields
    await page.click('[data-testid="add-kpi-field"]');
    await page.selectOption('[data-testid="kpi-select"]', 'outbound_calls');
    
    // Save and publish form
    await page.click('text=Save Form');
    await page.click('text=Publish');
    
    // Verify form is published
    await expect(page.locator('text=Published')).toBeVisible();
    
    // Navigate to form link
    const formLink = await page.locator('[data-testid="form-link"]').textContent();
    
    // Open form in new context (simulate external user)
    const context = await page.context();
    const formPage = await context.newPage();
    
    await formPage.goto(formLink!);
    
    // Fill out form
    await formPage.fill('[data-testid="team-member-select"]', 'test-member');
    await formPage.fill('[data-testid="outbound-calls"]', '25');
    await formPage.fill('[data-testid="talk-minutes"]', '120');
    await formPage.fill('[data-testid="quoted-count"]', '3');
    
    // Add quoted prospect details
    await formPage.click('[data-testid="add-prospect"]');
    await formPage.fill('[data-testid="prospect-name-0"]', 'John Doe');
    await formPage.fill('[data-testid="prospect-zip-0"]', '12345');
    
    // Submit form
    await formPage.click('[data-testid="submit-form"]');
    
    // Verify success message
    await expect(formPage.locator('text=Form submitted successfully')).toBeVisible();
    
    // Go back to dashboard and verify submission
    await page.goto('/dashboard');
    
    // Check that metrics appear in dashboard
    await expect(page.locator('[data-testid="outbound-calls-metric"]')).toContainText('25');
    await expect(page.locator('[data-testid="quoted-count-metric"]')).toContainText('3');
    
    // Verify KPI version tracking
    await page.click('[data-testid="metrics-detail"]');
    await expect(page.locator('[data-testid="kpi-version-info"]')).toBeVisible();
  });

  test('Gate F: Form validation and error handling', async ({ page }) => {
    // Mock form link that returns validation errors
    await page.route('**/submit_public_form', (route) => {
      const postData = route.request().postData();
      const payload = JSON.parse(postData!);
      
      if (!payload.teamMemberId) {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'invalid_payload' }),
        });
        return;
      }
      
      if (!payload.values.outbound_calls) {
        route.fulfill({
          status: 400,
          contentType: 'application/json', 
          body: JSON.stringify({ error: 'missing_required_field' }),
        });
        return;
      }
      
      // Success response
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          submissionId: 'test-submission-123',
        }),
      });
    });

    await page.goto('/agency/test-agency/form/daily-scorecard?token=test-token');
    
    // Test missing team member validation
    await page.click('[data-testid="submit-form"]');
    await expect(page.locator('text=Please select a team member')).toBeVisible();
    
    // Fill team member but miss required field
    await page.fill('[data-testid="team-member-select"]', 'test-member');
    await page.click('[data-testid="submit-form"]');
    await expect(page.locator('text=Please fill in all required fields')).toBeVisible();
    
    // Fill required fields and submit successfully
    await page.fill('[data-testid="outbound-calls"]', '20');
    await page.click('[data-testid="submit-form"]');
    await expect(page.locator('text=Form submitted successfully')).toBeVisible();
  });

  test('Gate F: KPI version consistency during submission', async ({ page }) => {
    // Mock KPI rename during form submission
    let kpiVersion = 1;
    
    await page.route('**/resolve_public_form', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          form: {
            id: 'form-123',
            schema: {
              kpis: [
                {
                  id: 'kpi-1',
                  key: 'outbound_calls',
                  label: kpiVersion === 1 ? 'Outbound Calls V1' : 'Outbound Calls V2',
                  version_id: `version-${kpiVersion}`,
                },
              ],
            },
          },
        }),
      });
    });

    await page.route('**/submit_public_form', (route) => {
      // Increment version to simulate rename
      kpiVersion = 2;
      
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          submissionId: 'test-submission-123',
          kpi_version_captured: 'version-1', // Should capture original version
          label_at_submit: 'Outbound Calls V1',
        }),
      });
    });

    await page.goto('/agency/test-agency/form/daily-scorecard?token=test-token');
    
    // Verify original KPI label is shown
    await expect(page.locator('text=Outbound Calls V1')).toBeVisible();
    
    // Fill and submit form
    await page.fill('[data-testid="team-member-select"]', 'test-member');
    await page.fill('[data-testid="outbound-calls"]', '30');
    await page.click('[data-testid="submit-form"]');
    
    // Verify submission captured original version despite rename
    await expect(page.locator('text=Form submitted successfully')).toBeVisible();
  });

  test('Gate F: Form expiration and access control', async ({ page }) => {
    // Mock expired form link
    await page.route('**/resolve_public_form', (route) => {
      route.fulfill({
        status: 410,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'FORM_EXPIRED' }),
      });
    });

    await page.goto('/agency/test-agency/form/expired-form?token=expired-token');
    
    // Should show form expired message
    await expect(page.locator('text=This form has expired')).toBeVisible();
    await expect(page.locator('[data-testid="submit-form"]')).not.toBeVisible();
  });

  test('Gate F: Network error recovery', async ({ page }) => {
    let failureCount = 0;
    
    await page.route('**/submit_public_form', (route) => {
      failureCount++;
      
      if (failureCount <= 2) {
        // Simulate network failure
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ 
            error: 'internal_error',
            id: 'error-123' 
          }),
        });
      } else {
        // Success after retries
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            submissionId: 'test-submission-123',
          }),
        });
      }
    });

    await page.goto('/agency/test-agency/form/daily-scorecard?token=test-token');
    
    // Fill form
    await page.fill('[data-testid="team-member-select"]', 'test-member');
    await page.fill('[data-testid="outbound-calls"]', '25');
    
    // First submission attempt - should fail
    await page.click('[data-testid="submit-form"]');
    await expect(page.locator('text=Submission failed. Please try again.')).toBeVisible();
    
    // Retry button should be visible
    await expect(page.locator('[data-testid="retry-submission"]')).toBeVisible();
    
    // Click retry - should fail again
    await page.click('[data-testid="retry-submission"]');
    await expect(page.locator('text=Submission failed. Please try again.')).toBeVisible();
    
    // Third attempt - should succeed
    await page.click('[data-testid="retry-submission"]');
    await expect(page.locator('text=Form submitted successfully')).toBeVisible();
  });

  test('Gate F: Performance monitoring', async ({ page }) => {
    // Monitor form load and submission performance
    const performanceMetrics: any[] = [];
    
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('resolve_public_form') || url.includes('submit_public_form')) {
        performanceMetrics.push({
          url,
          status: response.status(),
          timestamp: Date.now(),
        });
      }
    });

    const startTime = Date.now();
    
    await page.goto('/agency/test-agency/form/daily-scorecard?token=test-token');
    
    // Form should load within 2 seconds
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(2000);
    
    // Fill form
    await page.fill('[data-testid="team-member-select"]', 'test-member');
    await page.fill('[data-testid="outbound-calls"]', '25');
    
    const submitStartTime = Date.now();
    await page.click('[data-testid="submit-form"]');
    await expect(page.locator('text=Form submitted successfully')).toBeVisible();
    
    // Submission should complete within 5 seconds
    const submitTime = Date.now() - submitStartTime;
    expect(submitTime).toBeLessThan(5000);
    
    // Verify API performance metrics
    const submitMetric = performanceMetrics.find(m => m.url.includes('submit_public_form'));
    expect(submitMetric).toBeTruthy();
    expect(submitMetric.status).toBe(200);
  });
});