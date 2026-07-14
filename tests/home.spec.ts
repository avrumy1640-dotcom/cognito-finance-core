import { test, expect } from "../playwright-fixture";

test.describe("Bottom navigation tabs", () => {
  const tabs = [
    { label: "Home", path: "/" },
    { label: "Move", path: "/move-money" },
    { label: "Cards", path: "/cards" },
    { label: "Activity", path: "/activity" },
    { label: "Profile", path: "/profile" },
  ];

  test("each tab navigates to its route", async ({ page }) => {
    await page.goto("/");
    for (const tab of tabs) {
      await page.getByRole("button", { name: new RegExp(`^${tab.label}$`) }).click();
      await expect(page).toHaveURL(new RegExp(tab.path === "/" ? "/$" : tab.path));
    }
  });
});

test.describe("Home page interactions", () => {
  test("quick actions navigate to expected routes", async ({ page }) => {
    const quick = [
      { label: "Send", url: /move-money\/send/ },
      { label: "Transfer", url: /move-money\/transfer/ },
      { label: "Deposit", url: /move-money\/deposit/ },
      { label: "Pay Bills", url: /move-money\/bills/ },
      { label: "Add Money", url: /move-money\/add/ },
      { label: "Statements", url: /profile\/documents/ },
    ];
    for (const q of quick) {
      await page.goto("/");
      await page.getByRole("button", { name: q.label }).first().click();
      await expect(page).toHaveURL(q.url);
    }
  });

  test("account cards open detail routes", async ({ page }) => {
    await page.goto("/");
    await page.getByText(/Everyday Checking|Checking/i).first().click();
    await expect(page).toHaveURL(/\/account\/checking/);

    await page.goto("/");
    await page.getByText(/High-Yield Savings|Savings/i).first().click();
    await expect(page).toHaveURL(/\/account\/savings/);
  });

  test("notifications bell opens notifications", async ({ page }) => {
    await page.goto("/");
    // Bell icon button (second header button)
    const buttons = page.locator("header, div").locator("button");
    await page.locator('button:has(svg.lucide-bell), button:has(svg[class*="bell"])').first().click();
    await expect(page).toHaveURL(/notifications/);
  });

  test("balance visibility toggle hides amounts", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Total Available")).toBeVisible();
    const toggle = page.locator('button:has(svg.lucide-eye), button:has(svg.lucide-eye-off)').first();
    await toggle.click();
    await expect(page.getByText("••••••").first()).toBeVisible();
  });
});
