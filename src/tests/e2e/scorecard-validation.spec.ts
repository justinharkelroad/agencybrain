import { test, expect } from '@playwright/test';

test.describe('Scorecard Form Validation', () => {
  test('should validate quoted_details with required fields', async ({ page }) => {
    // Navigate to a public form
    await page.goto('/hfi-inc/custom-sales-scorecard?t=test-token');
    
    // Fill basic form fields
    await page.selectOption('[data-testid="team-member-select"]', 'test-member-id');
    
    // Set quoted_count to 1 to trigger quoted_details validation
    await page.fill('[data-testid="quoted-count-input"]', '1');
    
    // Try to submit without filling required fields
    await page.click('[data-testid="submit-button"]');
    
    // Should show validation errors
    await expect(page.locator('.text-destructive')).toContainText('Prospect name is required for household #1');
    await expect(page.locator('.text-destructive')).toContainText('Lead source is required for household #1');
    await expect(page.locator('.text-destructive')).toContainText('Detailed notes are required for household #1');
    
    // Fill required fields
    await page.fill('[data-testid="quoted-details-0-prospect-name"]', 'John Doe');
    await page.selectOption('[data-testid="quoted-details-0-lead-source"]', 'Website Inquiry');
    await page.fill('[data-testid="quoted-details-0-detailed-notes"]', 'Interested in auto policy');
    
    // Submit should now succeed
    await page.click('[data-testid="submit-button"]');
    await expect(page.locator('.text-green-600')).toContainText('Form submitted successfully');
  });

  test('should handle checkbox fields with yes/no values', async ({ page }) => {
    // Navigate to form with checkbox fields
    await page.goto('/hfi-inc/custom-sales-scorecard?t=test-token');
    
    // Fill basic fields
    await page.selectOption('[data-testid="team-member-select"]', 'test-member-id');
    await page.fill('[data-testid="quoted-count-input"]', '1');
    
    // Fill required quoted_details fields
    await page.fill('[data-testid="quoted-details-0-prospect-name"]', 'Jane Smith');
    await page.selectOption('[data-testid="quoted-details-0-lead-source"]', 'Referral');
    await page.fill('[data-testid="quoted-details-0-detailed-notes"]', 'Referred by existing client');
    
    // Check checkbox field (should store as "yes")
    await page.check('[data-testid="quoted-details-0-hearsay"]');
    
    // Submit form
    await page.click('[data-testid="submit-button"]');
    
    // Verify submission payload contains "yes" for checkbox
    const requests = [];
    page.on('request', request => {
      if (request.url().includes('submit_public_form')) {
        requests.push(request.postData());
      }
    });
    
    // Check that hearsay field is "yes"
    const payload = JSON.parse(requests[0] || '{}');
    expect(payload.values.quoted_details[0].hearsay).toBe('yes');
  });

  test('should normalize quotedDetails to quoted_details before submission', async ({ page }) => {
    let submissionPayload = '';
    
    // Intercept submission request
    await page.route('**/submit_public_form', (route) => {
      submissionPayload = route.request().postData() || '';
      route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    });
    
    await page.goto('/hfi-inc/custom-sales-scorecard?t=test-token');
    
    // Fill form
    await page.selectOption('[data-testid="team-member-select"]', 'test-member-id');
    await page.fill('[data-testid="quoted-count-input"]', '1');
    await page.fill('[data-testid="quoted-details-0-prospect-name"]', 'Test User');
    await page.selectOption('[data-testid="quoted-details-0-lead-source"]', 'Cold Call');
    await page.fill('[data-testid="quoted-details-0-detailed-notes"]', 'Follow up needed');
    
    await page.click('[data-testid="submit-button"]');
    
    // Verify payload uses snake_case
    const payload = JSON.parse(submissionPayload);
    expect(payload.values).toHaveProperty('quoted_details');
    expect(payload.values).not.toHaveProperty('quotedDetails');
    
    // Verify required fields are present
    const quotedDetails = payload.values.quoted_details[0];
    expect(quotedDetails.prospect_name).toBe('Test User');
    expect(quotedDetails.lead_source).toBe('Cold Call');
    expect(quotedDetails.detailed_notes).toBe('Follow up needed');
  });
});