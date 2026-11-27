import fs from "node:fs";
import { describe, expect, it } from "vitest";

const load = (l: string) => JSON.parse(fs.readFileSync(`src/messages/${l}.json`, "utf8"));
const flat = (o: Record<string, unknown>, p = ""): Record<string, string> =>
  Object.fromEntries(Object.entries(o).flatMap(([k, v]) => (typeof v === "object" && v ? Object.entries(flat(v as Record<string, unknown>, `${p}${k}.`)) : [[`${p}${k}`, String(v)]])));
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

describe("локализация", () => {
  const ru = flat(load("ru"));
  const kg = flat(load("kg"));
  it("в KG есть все ключи RU и нет лишних", () => {
    expect(Object.keys(kg).sort()).toEqual(Object.keys(ru).sort());
  });
  it("плейсхолдеры {…} совпадают в RU и KG", () => {
    for (const k of Object.keys(ru)) expect(placeholders(kg[k]), k).toBe(placeholders(ru[k]));
  });
  it("нет пустых переводов", () => {
    for (const [k, v] of Object.entries({ ...ru })) expect(v.trim(), `ru:${k}`).not.toBe("");
    for (const [k, v] of Object.entries(kg)) expect(v.trim(), `kg:${k}`).not.toBe("");
  });
  it("слоганы соответствуют ТЗ", () => {
    expect(ru["brand.slogan"]).toBe("EcoLink — превращаем отходы в доходы!");
    expect(kg["brand.slogan"]).toBe("EcoLink — Таштандыларды кирешеге айландырабыз!");
  });
  it("все статусы заявок переведены", () => {
    for (const s of ["DRAFT", "AVAILABLE", "RESERVED", "PICKUP_PENDING", "COMPLETED", "CANCELLED", "DISPUTED"]) {
      expect(ru[`status.${s}`]).toBeTruthy();
      expect(kg[`status.${s}`]).toBeTruthy();
    }
  });
  it("английский файл — необязательное расширение (недостающее берётся из RU)", () => {
    const en = flat(load("en"));
    expect(Object.keys(en).every((k) => k in ru)).toBe(true);
  });
});
