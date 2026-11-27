/**
 * Безопасная инициализация для production (Render и т.п.).
 *
 * В отличие от seed:
 *  - ничего не удаляет и не трогает существующие данные (только добавляет недостающее);
 *  - можно запускать при каждом деплое — повторный запуск ничего не меняет;
 *  - не создаёт DEMO-пользователей.
 *
 * Создаёт: категории сырья, базовое правило бонусов, настройки и (по желанию) администратора.
 * Администратор создаётся, только если заданы ADMIN_PHONE и ADMIN_PASSWORD и в базе ещё нет ни одного ADMIN.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ quiet: true });

import { eq } from "drizzle-orm";
import { db, pool, schema } from "./index";
import { hashPassword } from "../server/auth-core";
import { CATEGORIES, DEFAULT_BONUS_RULE } from "./reference-data";

async function main() {
  const inserted = await db
    .insert(schema.materialCategories)
    .values(CATEGORIES.map((c) => ({ code: c.code, nameRu: c.ru, nameKg: c.kg, nameEn: c.en, co2PerKg: c.co2, sortOrder: c.order })))
    .onConflictDoNothing({ target: schema.materialCategories.code })
    .returning({ code: schema.materialCategories.code });
  console.log(`Категории: добавлено ${inserted.length}, уже были ${CATEGORIES.length - inserted.length}.`);

  await db.insert(schema.bonusRules).values(DEFAULT_BONUS_RULE).onConflictDoNothing({ target: schema.bonusRules.code });

  await db
    .insert(schema.settings)
    .values([
      { key: "usd_kgs_rate", value: process.env.USD_KGS_RATE ?? "87.50" },
      { key: "usd_kgs_rate_date", value: process.env.USD_KGS_RATE_DATE ?? new Date().toISOString().slice(0, 10) },
      { key: "subscription_price_usd", value: "10.00" },
    ])
    .onConflictDoNothing({ target: schema.settings.key });

  const phone = process.env.ADMIN_PHONE;
  const password = process.env.ADMIN_PASSWORD;
  if (phone && password) {
    if (!/^\+996[0-9]{9}$/.test(phone)) throw new Error("ADMIN_PHONE должен быть в формате +996XXXXXXXXX");
    if (password.length < 10) throw new Error("ADMIN_PASSWORD должен быть не короче 10 символов");
    const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.role, "ADMIN")).limit(1);
    if (existing) {
      console.log("Администратор уже существует — пропускаю.");
    } else {
      await db.transaction(async (tx) => {
        const [u] = await tx
          .insert(schema.users)
          .values({
            phone, name: process.env.ADMIN_NAME ?? "Администратор EcoLink", passwordHash: await hashPassword(password),
            role: "ADMIN", locality: "Кара-Суу", consentAt: new Date(), isDemo: false,
          })
          .returning();
        await tx.insert(schema.userProfiles).values({ userId: u.id });
        await tx.insert(schema.wallets).values({ userId: u.id });
      });
      console.log("Администратор создан.");
    }
  } else {
    console.log("ADMIN_PHONE/ADMIN_PASSWORD не заданы — администратор не создаётся.");
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
