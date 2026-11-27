import { expect, test } from "@playwright/test";
import { ACCOUNTS, login } from "./helpers";

test("RBAC: житель не попадает в кабинеты скупщика и администратора", async ({ page }) => {
  await login(page, ACCOUNTS.resident);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/resident/);
  await page.goto("/buyer");
  await expect(page).toHaveURL(/\/resident/);
  expect((await page.request.get("/api/admin/export")).status()).toBe(403);
});

test("Приватность: публичная главная не содержит телефонов и точных адресов", async ({ page }) => {
  await page.goto("/");
  const html = await page.content();
  expect(html).not.toMatch(/\+996\s?7\d{2}\s?\d{3}\s?\d{3}/);
});

test("Скупщик не видит адрес и телефон в списке доступных заявок", async ({ page }) => {
  await login(page, ACCOUNTS.buyer);
  await page.goto("/buyer");
  const text = await page.getByTestId("available-list").innerText();
  expect(text).not.toMatch(/ул\./);
  expect(text).not.toMatch(/\+996/);
});

test("Вход: неверный пароль показывает ошибку", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Телефон").fill("+996700000099");
  await page.getByLabel("Пароль").fill("wrongpass1");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
});
