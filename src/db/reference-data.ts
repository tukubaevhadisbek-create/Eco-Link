/** Справочные данные, без которых приложение не работает (используются и в seed, и в bootstrap). */
export const CATEGORIES = [
  { code: "PET", ru: "PET-бутылки", kg: "PET бөтөлкөлөр", en: "PET bottles", co2: "1.5000", order: 1 },
  { code: "PLASTIC_OTHER", ru: "Другой пластик", kg: "Башка пластик", en: "Other plastics", co2: "1.2000", order: 2 },
  { code: "CARDBOARD", ru: "Картон", kg: "Картон", en: "Cardboard", co2: "0.9000", order: 3 },
  { code: "PAPER", ru: "Макулатура", kg: "Макулатура", en: "Waste paper", co2: "0.9000", order: 4 },
  { code: "ALUMINUM", ru: "Алюминий", kg: "Алюминий", en: "Aluminum", co2: "9.0000", order: 5 },
  { code: "METAL", ru: "Чёрный металл", kg: "Кара металл", en: "Scrap steel", co2: "1.5000", order: 6 },
];

export const DEFAULT_BONUS_RULE = {
  code: "DEFAULT", nameRu: "Базовое начисление", nameKg: "Негизги эсептөө",
  coinsPerKg: "2.000", flatBonus: 5, collectiveBonus: 10,
};
