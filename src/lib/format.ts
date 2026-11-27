export type Named = { nameRu: string; nameKg: string; nameEn: string };

export function catName(c: Named, locale: string): string {
  return locale === "kg" ? c.nameKg : locale === "en" ? c.nameEn : c.nameRu;
}
const LOC: Record<string, string> = { ru: "ru-RU", kg: "ky-KG", en: "en-GB" };
export const bcp = (locale: string) => LOC[locale] ?? "ru-RU";

export function fmtDate(d: Date | string | null | undefined, locale: string, withTime = false): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat(bcp(locale), {
    day: "2-digit", month: "short", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Asia/Bishkek",
  }).format(new Date(d));
}
export function fmtNum(n: number | string, locale: string, digits = 1): string {
  return new Intl.NumberFormat(bcp(locale), { maximumFractionDigits: digits }).format(Number(n));
}
export function fmtMoney(n: number | string, locale: string): string {
  return new Intl.NumberFormat(bcp(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n));
}
export function fmtMonth(ym: string, locale: string): string {
  return new Intl.DateTimeFormat(bcp(locale), { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(ym + "-01T00:00:00Z"));
}

export const ORG_TYPES = ["SCHOOL", "SHOP", "ENTERPRISE", "AIYL_OKMOTU", "NGO"] as const;
/** Переводы типов организаций хранятся одной строкой «a|b|c|d|e» в порядке ORG_TYPES. */
export function orgTypeLabel(joined: string, type: string): string {
  const i = (ORG_TYPES as readonly string[]).indexOf(type);
  return joined.split("|")[i] ?? type;
}
