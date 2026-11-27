import Decimal from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type Numeric = string | number | Decimal;

/** Вес в кг: 3 знака после запятой. */
export function kg(value: Numeric): string {
  return new Decimal(value).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toFixed(3);
}

/** Деньги в сомах: 2 знака после запятой. */
export function som(value: Numeric): string {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

/** Сумма = вес × цена за кг, округление до тыйына (0.01). */
export function total(weightKg: Numeric, pricePerKg: Numeric): string {
  return som(new Decimal(weightKg).mul(new Decimal(pricePerKg)));
}

export function sumKg(values: Numeric[]): string {
  return kg(values.reduce<Decimal>((acc, v) => acc.plus(v), new Decimal(0)));
}

export function percent(part: Numeric, whole: Numeric): number {
  const w = new Decimal(whole);
  if (w.lte(0)) return 0;
  return Math.min(100, new Decimal(part).div(w).mul(100).toDecimalPlaces(0).toNumber());
}

/** Сколько EcoCoins за операцию: floor(кг × коэффициент) + фикс + бонус за коллективный сбор. */
export function ecoCoins(
  weightKg: Numeric,
  rule: { coinsPerKg: Numeric; flatBonus: number; collectiveBonus: number },
  isCollective: boolean,
): number {
  const perKg = new Decimal(weightKg).mul(rule.coinsPerKg).floor().toNumber();
  return perKg + rule.flatBonus + (isCollective ? rule.collectiveBonus : 0);
}

/** Оценочное сокращение CO2-экв. (кг) = вес × коэффициент категории. */
export function co2Saved(weightKg: Numeric, co2PerKg: Numeric): string {
  return new Decimal(weightKg).mul(co2PerKg).toDecimalPlaces(2).toFixed(2);
}

export { Decimal };
