import { test, expect } from "@playwright/test";

const STAFF_USERNAME = process.env.STAFF_TEST_USERNAME;
const STAFF_PASSWORD = process.env.STAFF_TEST_PASSWORD;
const STAFF_AGENCY_CODE = process.env.STAFF_TEST_AGENCY_CODE ?? "";

const STAFF_ROUTES = ["/staff/cancel-audit", "/staff/renewals", "/staff/winback"] as const;

test.describe("Staff routes smoke", () => {
  test("unauthenticated users are redirected to staff login", async ({ page }) => {
    for (const route of STAFF_ROUTES) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/staff\/login/);
      await expect(page.getByLabel("Username")).toBeVisible();
      await expect(page.getByLabel("Password")).toBeVisible();
    }
  });

  test("authenticated staff can click through cancel-audit, renewals, and winback routes", async ({ page }) => {
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
            const msg = (await alert.innerText()).trim();
            return `ERROR:${msg}`;
          }

          if (!page.url().includes("/staff/login")) {
            return "OK";
          }

          return "PENDING";
        },
        { timeout: 15000 }
      )
      .toBe("OK");

    const postLoginState = await page.evaluate(() => ({
      staffToken: localStorage.getItem("staff_session_token"),
    }));
    expect(postLoginState.staffToken).toBeTruthy();

    for (const route of STAFF_ROUTES) {
      await page.evaluate((targetRoute) => {
        window.history.pushState({}, "", targetRoute);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, route);
      await page.waitForLoadState("networkidle");
      const routeState = await page.evaluate(() => ({
        staffToken: localStorage.getItem("staff_session_token"),
      }));
      expect(routeState.staffToken).toBeTruthy();
      await expect(page).toHaveURL(new RegExp(route.replace("/", "\\/")));
      await expect(page).not.toHaveURL(/\/staff\/login/);
      await expect(page.getByLabel("Username")).toHaveCount(0);
      await expect(page.getByLabel("Password")).toHaveCount(0);
    }
  });
});
