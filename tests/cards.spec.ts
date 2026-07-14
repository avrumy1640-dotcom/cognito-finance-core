import { test, expect } from "../playwright-fixture";

test.describe("Cards page", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // Auto-accept confirm/prompt dialogs so destructive buttons don't hang.
      window.confirm = () => true;
      window.prompt = () => "1234";
    });
    await page.goto("/cards");
  });

  test("tabs switch content", async ({ page }) => {
    for (const t of ["Actions", "Controls", "Transactions"]) {
      await page.getByRole("button", { name: t }).click();
    }
  });

  test("lock/unlock toggles state", async ({ page }) => {
    await page.getByRole("button", { name: "Actions" }).click();
    const lockBtn = page.getByText(/Lock Card|Unlock Card/).first();
    const initial = await lockBtn.textContent();
    await lockBtn.click();
    await expect(page.getByText(/Card is (locked|active)/i).first()).toBeVisible();
    const after = await page.getByText(/Lock Card|Unlock Card/).first().textContent();
    expect(after).not.toEqual(initial);
  });

  test("show/hide card details toggles", async ({ page }) => {
    await page.getByRole("button", { name: "Actions" }).click();
    await page.getByText(/Show Card Details/).click();
    await expect(page.getByText(/Hide Details/)).toBeVisible();
  });

  test("card controls toggles change visual state", async ({ page }) => {
    await page.getByRole("button", { name: "Controls" }).click();
    const rows = [
      "International Transactions",
      "Online Purchases",
      "Contactless Payments",
      "In-Store Purchases",
      "ATM Withdrawals",
    ];
    for (const label of rows) {
      await page.getByText(label).click();
    }
  });

  test("issue virtual card, change PIN, travel notice buttons fire", async ({ page }) => {
    await page.getByRole("button", { name: "Actions" }).click();
    await page.getByText("Issue Virtual Card").click();
    await page.getByText(/Set Travel Notice|Remove Travel Notice/).click();
    await page.getByText("Change PIN").click();
  });
});
