import { expect, test } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

test("PWA: офлайн-черновик не выдаётся за созданную заявку и синхронизируется после восстановления связи", async ({ page, context }) => {
  const address = `ул. Офлайн-${Date.now() % 100000}, 5`;
  await login(page, ACCOUNTS.resident);
  await page.goto("/resident/new");
  await page.getByLabel("Вес").first().fill("7");
  await page.getByLabel("Адрес").first().fill(address);
  await expect(page.getByTestId("location-picker")).toBeVisible();

  await context.setOffline(true);
  await expect(page.getByTestId("offline-indicator")).toBeVisible();
  await page.getByRole("button", { name: /Создать заявку|Отправить|Сохранить заявку/i }).click();
  await expect(page.getByTestId("drafts-panel")).toContainText("Не отправлено");
  await expect(page).toHaveURL(/\/resident\/new/); // не перешли на «успех»

  // Пока офлайн, заявки в БД нет.
  await context.setOffline(false);
  await expect(page.getByTestId("offline-indicator")).toHaveCount(0);
  await expect(page.getByTestId("drafts-panel")).toHaveCount(0, { timeout: 15_000 }); // синхронизировано
  await page.goto("/resident/requests");
  await expect(page.getByText(address)).toBeVisible();
});

test("PWA: manifest и service worker доступны", async ({ page }) => {
  const m = await page.request.get("/manifest.webmanifest");
  expect(m.status()).toBe(200);
  const json = await m.json();
  expect(json.name).toBe("EcoLink");
  expect(json.icons.some((i: { sizes: string }) => i.sizes === "512x512")).toBe(true);
  expect((await page.request.get("/sw.js")).status()).toBe(200);
  expect((await page.request.get("/icons/icon-192.png")).status()).toBe(200);
});
