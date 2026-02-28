import { test, expect } from "@playwright/test";

const STAFF_USERNAME = process.env.STAFF_TEST_USERNAME;
const STAFF_PASSWORD = process.env.STAFF_TEST_PASSWORD;
const STAFF_AGENCY_CODE = process.env.STAFF_TEST_AGENCY_CODE ?? "";

async function staffLogin(page: import("@playwright/test").Page) {
  test.skip(!STAFF_USERNAME || !STAFF_PASSWORD, "Set STAFF_TEST_USERNAME and STAFF_TEST_PASSWORD to run authenticated smoke.");

  await page.goto("/staff/login");
  await page.getByLabel("Username").fill(STAFF_USERNAME as string);
  await page.getByLabel("Password").fill(STAFF_PASSWORD as string);

  if (STAFF_AGENCY_CODE) {
    await page.getByLabel(/Agency Code/).fill(STAFF_AGENCY_CODE);
  }

  await page.getByRole("button", { name: /sign in/i }).click();

  await expect
    .poll(
      async () => {
        const alert = page.locator('[role="alert"]').first();
        if ((await alert.count()) > 0 && (await alert.isVisible())) {
          return `ERROR:${(await alert.innerText()).trim()}`;
        }
        if (!page.url().includes("/staff/login")) return "OK";
        return "PENDING";
      },
      { timeout: 15000 }
    )
    .toBe("OK");

  await expect
    .poll(
      async () => {
        return page.evaluate(() => localStorage.getItem("staff_session_token"));
      },
      { timeout: 15000 }
    )
    .toBeTruthy();
}

test.describe("Staff portal UI smoke", () => {
  async function navigateInApp(page: import("@playwright/test").Page, route: string) {
    await page.evaluate((targetRoute) => {
      window.history.pushState({}, "", targetRoute);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, route);
    await page.waitForLoadState("networkidle");
  }

  test("cancel-audit, renewals, and winback expose core actions and filters", async ({ page }) => {
    await staffLogin(page);

    await navigateInApp(page, "/staff/cancel-audit");
    await expect(page).toHaveURL(/\/staff\/cancel-audit/);
    await expect(page.getByRole("button", { name: /upload/i }).first()).toBeVisible();
    await expect(page.locator('[role="combobox"], select').first()).toBeVisible();

    await navigateInApp(page, "/staff/renewals");
    await expect(page).toHaveURL(/\/staff\/renewals/);
    await expect(page.getByRole("button", { name: /upload/i }).first()).toBeVisible();
    await expect(page.locator('[role="combobox"], select').first()).toBeVisible();
    await expect(page.locator("text=/activity/i").first()).toBeVisible();

    await navigateInApp(page, "/staff/winback");
    await expect(page).toHaveURL(/\/staff\/winback/);
    await expect(page.getByRole("button", { name: /upload/i }).first()).toBeVisible();
    await expect(page.locator("text=/household/i").first()).toBeVisible();
    await expect(page.locator('[role="combobox"], select').first()).toBeVisible();
  });

  test("staff sales upload and add-sale tabs are reachable and interactive", async ({ page }) => {
    await staffLogin(page);

    await navigateInApp(page, "/staff/sales?tab=upload");
    await expect(page).toHaveURL(/\/staff\/sales\?tab=upload/);
    await expect(page.getByRole("tab", { name: /upload pdf/i })).toBeVisible();
    await expect(page.locator("input[type='file']").first()).toBeVisible();

    await navigateInApp(page, "/staff/sales?tab=add");
    await expect(page).toHaveURL(/\/staff\/sales\?tab=add/);
    await expect(page.getByRole("tab", { name: /add sale/i })).toBeVisible();
    await expect(page.locator("text=/lead source/i").first()).toBeVisible();
    await expect(page.locator('[role="combobox"], select').first()).toBeVisible();
  });
});
