import { test, expect } from "../playwright-fixture";

const routes = [
  "/",
  "/move-money",
  "/move-money/send",
  "/move-money/transfer",
  "/move-money/deposit",
  "/move-money/bills",
  "/move-money/add",
  "/cards",
  "/activity",
  "/profile",
  "/profile/personal",
  "/profile/documents",
  "/profile/address",
  "/profile/identity",
  "/profile/employment",
  "/profile/linked",
  "/account/checking",
  "/account/savings",
  "/security",
  "/notifications",
  "/notifications/settings",
  "/help",
  "/help/contact",
  "/insights",
  "/settings",
  "/login",
];

test.describe("Route rendering — every declared route mounts without crashing", () => {
  for (const path of routes) {
    test(`renders ${path}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(path);
      // App shell should render some content.
      await expect(page.locator("body")).not.toBeEmpty();
      expect(errors, `page errors on ${path}:\n${errors.join("\n")}`).toEqual([]);
    });
  }

  test("unknown route shows 404", async ({ page }) => {
    await page.goto("/this-does-not-exist-xyz");
    await expect(page.getByText(/404|not found/i).first()).toBeVisible();
  });
});
