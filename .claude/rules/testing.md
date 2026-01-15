---
paths:
  - "src/**/*.test.ts"
  - "src/**/*.test.tsx"
  - "src/tests/**/*"
  - "e2e/**/*"
---

# Testing Rules

## Test File Conventions
- Unit tests: `*.test.ts` alongside source files
- E2E tests: `e2e/*.spec.ts` or `src/tests/e2e/*.spec.ts`
- Use Vitest for unit tests, Playwright for E2E

## Unit Test Structure
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ComponentOrFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('specificBehavior', () => {
    it('should do expected thing when condition', () => {
      // Arrange
      const input = setupTestData();

      // Act
      const result = functionUnderTest(input);

      // Assert
      expect(result).toEqual(expectedValue);
    });

    it('should handle error case', () => {
      // Test error conditions
      expect(() => functionUnderTest(badInput)).toThrow();
    });
  });
});
```

## Coverage Requirements
- Minimum: 80% line coverage
- Critical paths: 100% coverage
- Always test: happy path, error cases, edge cases

## Test Naming
- Use descriptive names: `should return true when user is authenticated`
- Bad: `test function`, `works`, `test 1`
- Good: `should calculate commission correctly for zero sales`

## Mocking
```typescript
// Mock Supabase
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue({ data: [], error: null })
  }
}));
```

## E2E Test Structure (Playwright)
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature', () => {
  test('should complete user flow', async ({ page }) => {
    await page.goto('/path');
    await page.click('button');
    await expect(page.locator('.result')).toBeVisible();
  });
});
```

## Running Tests
```bash
npx vitest              # Run unit tests
npx vitest --coverage   # With coverage report
npx playwright test     # Run E2E tests
```

## CI Gate Requirements
All tests must pass before merge. Nightly smoke tests run at 2 AM UTC.
