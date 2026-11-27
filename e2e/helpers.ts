import { expect, type Page } from "@playwright/test";

export const PASSWORD = process.env.DEMO_PASSWORD ?? "EcoDemo2026";
export const ACCOUNTS = { resident: "+996700000001", buyer: "+996700000002", admin: "+996700000003" };

export async function login(page: Page, phone: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel(/Телефон|Телефон/i).fill(phone);
  await page.getByLabel(/Пароль/i).fill(PASSWORD);
  await page.getByRole("button", { name: "Войти" }).click();
  await page.waitForURL(/\/(resident|buyer|admin)/);
}
export async function setLang(page: Page, code: "RU" | "KG" | "EN") {
  await page.getByRole("button", { name: code, exact: true }).first().click();
  await page.waitForTimeout(600);
}
export const expectNoCrash = async (page: Page) => expect(page.locator("text=Application error")).toHaveCount(0);
