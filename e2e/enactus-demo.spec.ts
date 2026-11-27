import { expect, test } from "@playwright/test";
import { ACCOUNTS, login, setLang } from "./helpers";

test.describe.configure({ mode: "serial" });

let pin = "";
const address = `ул. E2E-${Date.now() % 100000}, 1`;

test("1-2. Главная страница: слоган, кнопки, карта и реальные показатели", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/превращаем отходы в доходы/i);
  await expect(page.getByTestId("cta-resident")).toBeVisible();
  await expect(page.getByTestId("cta-buyer")).toBeVisible();
  await expect(page.getByText("Enactus OshTU").first()).toBeVisible();
  await expect(page.getByTestId("impact-kg")).toBeVisible(); // из БД (DEMO-операции)
});

test("3-6. Житель создаёт заявку на 12 кг PET в Кара-Суу с точкой на карте", async ({ page }) => {
  await login(page, ACCOUNTS.resident);
  await page.goto("/resident/new");
  await page.getByLabel("Вес").first().fill("12");
  await page.getByLabel("Адрес").first().fill(address);
  // Выбор точки на карте: клик по карте
  const map = page.getByTestId("location-picker");
  await expect(map).toBeVisible();
  const box = (await map.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30);
  // Живое сравнение предложений скупщиков
  await expect(page.getByText(/≈ .* сом/).first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /Создать заявку|Отправить|Сохранить заявку/i }).click();
  await page.waitForURL("**/resident/requests");
  await expect(page.getByText(address)).toBeVisible();
});

test("7-9. Скупщик видит заявку и принимает её", async ({ page }) => {
  await login(page, ACCOUNTS.buyer);
  await page.goto("/buyer");
  await expect(page.getByTestId("available-list")).toBeVisible();
  const items = page.getByTestId("available-item").filter({ hasText: "12" });
  await expect(items.first()).toBeVisible();
  await items.first().getByTestId("accept-request").click();
  await page.waitForURL("**/buyer/pickups");
  await expect(page.getByTestId("pickup-card").filter({ hasText: address })).toBeVisible(); // точный адрес — только после принятия
});

test("10-11. Маршрут и подтверждение фактического веса (выдача PIN)", async ({ page }) => {
  await login(page, ACCOUNTS.buyer);
  await page.goto("/buyer/pickups");
  await expect(page.getByTestId("open-route")).toHaveAttribute("href", /google\.com\/maps/);
  const card = page.getByTestId("pickup-card").filter({ hasText: address });
  await card.getByTestId("actual-weight").fill("11.5");
  await card.getByTestId("issue-pin").click();
  pin = (await card.getByTestId("pin-value").textContent())!.trim();
  expect(pin).toMatch(/^\d{6}$/);
});

test("12-14. Житель подтверждает передачу PIN, операция завершается, EcoCoins начислены", async ({ page }) => {
  await login(page, ACCOUNTS.resident);
  await page.goto("/resident/wallet");
  const before = Number((await page.getByTestId("wallet-balance").textContent())!.replace(/\D/g, ""));
  await page.goto("/resident/requests");
  const card = page.getByTestId("request-card").filter({ hasText: address });
  await card.getByTestId("pin-input").fill(pin);
  await card.getByTestId("confirm-pin").click();
  await expect(page.getByTestId("request-card").filter({ hasText: address })).toHaveCount(0, { timeout: 10_000 });
  await page.goto("/resident/wallet");
  const after = Number((await page.getByTestId("wallet-balance").textContent())!.replace(/\D/g, ""));
  expect(after - before).toBe(Math.floor(11.5 * 2) + 5); // правило DEFAULT: 2 монеты/кг + 5
  await page.goto("/resident/history");
  await expect(page.getByTestId("history-item").first()).toContainText("11,5");
});

test("15. Администратор видит реальную статистику из БД и журнал", async ({ page }) => {
  await login(page, ACCOUNTS.admin);
  await page.goto("/admin");
  await expect(page.getByTestId("admin-kpis")).toBeVisible();
  await page.goto("/admin/audit");
  await expect(page.getByText("pickup.confirm").first()).toBeVisible();
  const res = await page.request.get("/api/admin/export");
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain("confirmed_kg");
});

test("16. Коллективный сбор с индикатором прогресса (85 из 100 кг)", async ({ page }) => {
  await login(page, ACCOUNTS.resident);
  await page.goto("/resident/collections");
  const bar = page.getByRole("progressbar").first();
  await expect(bar).toBeVisible();
  await expect(page.getByText("85").first()).toBeVisible();
});

test("17. Переключение языка RU → KG", async ({ page }) => {
  await page.goto("/");
  await setLang(page, "KG");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Таштандыларды кирешеге айландырабыз");
  await setLang(page, "RU");
});
