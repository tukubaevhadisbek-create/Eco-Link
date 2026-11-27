export const CATEGORY_COLORS: Record<string, string> = {
  PET: "#168B53",
  PLASTIC_OTHER: "#0891b2",
  CARDBOARD: "#b45309",
  PAPER: "#7c3aed",
  ALUMINUM: "#475569",
  METAL: "#be123c",
};

/**
 * Для категорий, добавленных администратором, цвет выводится из кода (стабильно между запросами),
 * чтобы маркеры разных новых категорий на карте не сливались в один зелёный.
 */
function hashColor(code: string): string {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 60% 38%)`;
}

export const colorFor = (code: string) => CATEGORY_COLORS[code] ?? (code ? hashColor(code) : "#0B5D38");
