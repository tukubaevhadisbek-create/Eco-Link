import { expect, test } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

test("Смартфон: нижняя навигация и отсутствие горизонтальной прокрутки", async ({ page }) => {
  await login(page, ACCOUNTS.resident);
  await expect(page.getByRole("navigation", { name: /навигац/i })).toBeVisible();
  for (const path of ["/resident", "/resident/new", "/resident/wallet"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `горизонтальный скролл на ${path}`).toBeLessThanOrEqual(1);
  }
});
