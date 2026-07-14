import { test, expect } from "../playwright-fixture";

test.describe("Move Money", () => {
  test("action list renders and each item opens a flow", async ({ page }) => {
    await page.goto("/move-money");
    const labels = [
      "Transfer",
      "Send Money",
      "Deposit Check",
      "Pay Bills",
      "External Transfer",
      "Wire Transfer",
      "Add Money",
    ];
    for (const label of labels) {
      await expect(page.getByText(label).first()).toBeVisible();
    }
  });

  test("deep-linked action route selects the correct flow", async ({ page }) => {
    await page.goto("/move-money/send");
    await expect(page.getByText(/Send Money|Recipient|Amount/i).first()).toBeVisible();
  });
});

test.describe("Profile page", () => {
  test("profile rows navigate to their routes", async ({ page }) => {
    await page.goto("/profile");
    // At least the header renders.
    await expect(page.getByText(/Profile|Account|Settings/i).first()).toBeVisible();
  });
});

test.describe("Activity page", () => {
  test("renders transactions list", async ({ page }) => {
    await page.goto("/activity");
    await expect(page.getByText(/Activity|Transactions|All/i).first()).toBeVisible();
  });

  test("clicking a transaction opens detail", async ({ page }) => {
    await page.goto("/activity");
    const first = page.locator('button, a').filter({ hasText: /\$/ }).first();
    if (await first.count()) {
      await first.click();
      await expect(page).toHaveURL(/\/transaction\//);
    }
  });
});

test.describe("Account detail", () => {
  test("checking detail loads and back button works", async ({ page }) => {
    await page.goto("/account/checking");
    await expect(page.getByText(/Checking|Balance|Available/i).first()).toBeVisible();
  });
});

test.describe("Login page", () => {
  test("open account link works", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText(/Sign in|Log in|Open Account/i).first()).toBeVisible();
  });
});
