import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { registerUser } from "@/server/auth-core";

export async function resetDb() {
  await db.execute(sql`TRUNCATE users, material_categories, bonus_rules, organizations, settings, audit_logs, login_attempts RESTART IDENTITY CASCADE`);
}

export async function seedBasics() {
  const [pet] = await db
    .insert(schema.materialCategories)
    .values({ code: "PET", nameRu: "PET", nameKg: "PET", nameEn: "PET", co2PerKg: "1.5" })
    .returning();
  const [cardboard] = await db
    .insert(schema.materialCategories)
    .values({ code: "CARDBOARD", nameRu: "Картон", nameKg: "Картон", nameEn: "Cardboard", co2PerKg: "0.9" })
    .returning();
  await db.insert(schema.bonusRules).values({
    code: "DEFAULT",
    nameRu: "Базовое",
    nameKg: "Негизги",
    coinsPerKg: "2",
    flatBonus: 5,
    collectiveBonus: 10,
  });
  return { pet, cardboard };
}

let n = 0;
export async function makeUser(role: "RESIDENT" | "BUYER", locality = "Кара-Суу") {
  n += 1;
  const phone = `+99670${String(1000000 + n)}`;
  return registerUser({
    name: `Test ${role} ${n}`,
    phone,
    password: "Passw0rdTest",
    locality,
    role,
    consent: true,
  });
}

export async function givePrice(buyerId: string, categoryId: string, price = "20.00") {
  await db.insert(schema.buyerPrices).values({ buyerId, categoryId, pricePerKg: price });
  await db.insert(schema.buyerServiceAreas).values({ buyerId, locality: "Кара-Суу" }).onConflictDoNothing();
}

export const requestInput = (categoryId: string, over: Record<string, unknown> = {}) => ({
  categoryId,
  approxWeightKg: "12",
  locality: "Кара-Суу",
  address: "ул. Тестовая, 1",
  lat: 40.7026,
  lng: 72.8586,
  allowCollective: false,
  ...over,
});
