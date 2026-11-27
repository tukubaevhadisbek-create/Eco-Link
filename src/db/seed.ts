/**
 * Воспроизводимая DEMO-база для Кара-Суу.
 * Все записи помечаются is_demo = true. Все персонажи и телефоны вымышлены.
 *
 * Запуск: npm run db:seed
 * Защита: не выполняется, если в базе есть НЕ демонстрационные пользователи (нужен флаг --force).
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ quiet: true });

import { eq, sql } from "drizzle-orm";
import { db, pool, schema } from "./index";
import { hashPassword } from "../server/auth-core";
import { createCollection, joinCollection, assignCollection, scheduleCollection } from "../server/collections";
import { acceptRequest, confirmPickup, createRequest, reportWeight, schedulePickup } from "../server/requests";
import { createReview } from "../server/reviews";
import { CATEGORIES } from "./reference-data";

export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "EcoDemo2026";
export const DEMO_ACCOUNTS = {
  resident: { phone: "+996700000001", name: "Айгерим Жумабекова" },
  buyer: { phone: "+996700000002", name: "Бакыт Токтосунов" },
  admin: { phone: "+996700000003", name: "Администратор EcoLink" },
} as const;

const DAY = 86400000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const daysAhead = (n: number) => new Date(Date.now() + n * DAY);

// Координаты — окрестности Кара-Суу (приблизительные, вымышленные адреса).
const SPOTS = [
  { lat: 40.7041, lng: 72.8612, address: "ул. Ленина, 14 (DEMO)" },
  { lat: 40.6998, lng: 72.8554, address: "ул. Мира, 7 (DEMO)" },
  { lat: 40.7075, lng: 72.8501, address: "ул. Токтогула, 22 (DEMO)" },
  { lat: 40.6962, lng: 72.8649, address: "ул. Садовая, 3 (DEMO)" },
  { lat: 40.7102, lng: 72.8667, address: "ул. Школьная, 11 (DEMO)" },
  { lat: 40.7013, lng: 72.8479, address: "ул. Алатоо, 9 (DEMO)" },
  { lat: 40.6937, lng: 72.8575, address: "ул. Бирдик, 18 (DEMO)" },
  { lat: 40.7058, lng: 72.8703, address: "ул. Достук, 5 (DEMO)" },
  { lat: 40.7121, lng: 72.8559, address: "ул. Жаштык, 31 (DEMO)" },
  { lat: 40.6985, lng: 72.8711, address: "ул. Победы, 12 (DEMO)" },
  { lat: 40.7033, lng: 72.8447, address: "ул. Курманжан датка, 8 (DEMO)" },
  { lat: 40.6911, lng: 72.8629, address: "ул. Озерная, 2 (DEMO)" },
];

const NAMES = [
  "Нурзат Исакова", "Эрлан Касымов", "Гульнара Абдыкадырова", "Таалайбек Мамытов", "Айнура Сыдыкова", "Мирлан Осмонов",
  "Чолпон Эшматова", "Бекзат Рысбеков", "Зарина Камчыбекова", "Данияр Орозов", "Сезим Турдубаева", "Азамат Кубатов",
];

async function main() {
  const force = process.argv.includes("--force");
  if (process.env.NODE_ENV === "production" && !force) throw new Error("Seed в production запрещён без --force");
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(schema.users).where(eq(schema.users.isDemo, false));
  if (Number(n) > 0 && !force) {
    throw new Error(`В базе ${n} реальных (не DEMO) пользователей. Seed удалил бы их. Используйте --force, если это осознанно.`);
  }

  console.log("Очистка базы…");
  await db.execute(sql`TRUNCATE users, material_categories, bonus_rules, organizations, settings, audit_logs, login_attempts RESTART IDENTITY CASCADE`);

  /* ---------- Справочники ---------- */
  const cats = await db
    .insert(schema.materialCategories)
    .values(CATEGORIES.map((c) => ({ code: c.code, nameRu: c.ru, nameKg: c.kg, nameEn: c.en, co2PerKg: c.co2, sortOrder: c.order })))
    .returning();
  const cat = Object.fromEntries(cats.map((c) => [c.code, c]));

  await db.insert(schema.bonusRules).values({
    code: "DEFAULT", nameRu: "Базовое начисление", nameKg: "Негизги эсептөө",
    coinsPerKg: "2.000", flatBonus: 5, collectiveBonus: 10,
  });
  await db.insert(schema.settings).values([
    { key: "usd_kgs_rate", value: process.env.USD_KGS_RATE ?? "87.50" },
    { key: "usd_kgs_rate_date", value: process.env.USD_KGS_RATE_DATE ?? new Date().toISOString().slice(0, 10) },
    { key: "subscription_price_usd", value: "10.00" },
  ]);

  /* ---------- Пользователи ---------- */
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const mkUser = async (phone: string, name: string, role: "RESIDENT" | "BUYER" | "ADMIN", locality = "Кара-Суу", orgId?: string) => {
    const [u] = await db
      .insert(schema.users)
      .values({ phone, name, passwordHash, role, locality, consentAt: new Date(), isDemo: true, organizationId: orgId ?? null })
      .returning();
    await db.insert(schema.userProfiles).values({ userId: u.id });
    await db.insert(schema.wallets).values({ userId: u.id });
    return u;
  };

  const admin = await mkUser(DEMO_ACCOUNTS.admin.phone, DEMO_ACCOUNTS.admin.name, "ADMIN");

  const orgs = await db
    .insert(schema.organizations)
    .values([
      { name: "Школа №3 им. Ч. Айтматова (DEMO)", type: "SCHOOL", locality: "Кара-Суу", isDemo: true },
      { name: "Школа №7 (DEMO)", type: "SCHOOL", locality: "Кара-Суу", isDemo: true },
      { name: "Магазин «Береке» (DEMO)", type: "SHOP", locality: "Кара-Суу", isDemo: true },
      { name: "Айыл окмоту Кара-Суу (DEMO)", type: "AIYL_OKMOTU", locality: "Кара-Суу", isDemo: true },
    ])
    .returning();

  const residents = [await mkUser(DEMO_ACCOUNTS.resident.phone, DEMO_ACCOUNTS.resident.name, "RESIDENT")];
  for (let i = 0; i < NAMES.length; i++) {
    const org = i < 3 ? orgs[0] : i < 5 ? orgs[1] : i === 5 ? orgs[2] : undefined;
    residents.push(await mkUser(`+9967000100${String(i + 10)}`, NAMES[i], "RESIDENT", "Кара-Суу", org?.id));
  }
  await db.update(schema.users).set({ organizationId: orgs[0].id }).where(eq(schema.users.id, residents[0].id));
  await db.update(schema.organizations).set({ responsibleUserId: residents[1].id }).where(eq(schema.organizations.id, orgs[0].id));

  const buyer = await mkUser(DEMO_ACCOUNTS.buyer.phone, DEMO_ACCOUNTS.buyer.name, "BUYER");
  const buyer2 = await mkUser("+996700000012", "Руслан Эркинов", "BUYER");
  const buyer3 = await mkUser("+996700000013", "Нурбек Алиев", "BUYER", "Ош");

  const setupBuyer = async (
    b: typeof buyer, orgName: string, areas: string[], prices: Record<string, string>, minBatch: string, verified: boolean, trialDays?: number,
  ) => {
    await db.insert(schema.buyerProfiles).values({
      userId: b.id, orgName, contactPhone: b.phone, minBatchKg: minBatch, verified,
      description: "DEMO: вымышленный профиль для демонстрации платформы",
    });
    await db.insert(schema.buyerServiceAreas).values(areas.map((locality) => ({ buyerId: b.id, locality })));
    await db.insert(schema.buyerPrices).values(
      Object.entries(prices).map(([code, p]) => ({
        buyerId: b.id, categoryId: cat[code].id, pricePerKg: p, minVolumeKg: "10.000",
        terms: "DEMO: условия указаны вымышленным скупщиком", validUntil: daysAhead(30),
      })),
    );
    await db.insert(schema.vehicles).values({ buyerId: b.id, name: "Газель (DEMO)", capacityKg: "1500.000" });
    const start = daysAgo(trialDays !== undefined ? 3 : 20);
    const [sub] = await db
      .insert(schema.subscriptions)
      .values({
        buyerId: b.id, status: trialDays !== undefined ? "TRIAL" : "ACTIVE", isTrial: trialDays !== undefined,
        startsAt: start, endsAt: daysAhead(trialDays ?? 10),
      })
      .returning();
    await db.insert(schema.subscriptionEvents).values({
      subscriptionId: sub.id, type: trialDays !== undefined ? "TRIAL_STARTED" : "DEMO_PAYMENT",
      amountUsd: trialDays !== undefined ? null : "10.00", isDemo: true,
    });
  };
  // Цены вымышлены для демонстрации и НЕ являются рыночными котировками.
  await setupBuyer(buyer, "ЭкоСбор Кара-Суу (DEMO)", ["Кара-Суу", "Ноокат"], { PET: "18.00", CARDBOARD: "6.00", PAPER: "4.50", ALUMINUM: "95.00", METAL: "14.00" }, "100.000", true);
  await setupBuyer(buyer2, "Вторчермет Юг (DEMO)", ["Кара-Суу"], { PET: "16.50", CARDBOARD: "6.50", METAL: "15.50", PLASTIC_OTHER: "9.00" }, "50.000", false, 11);
  await setupBuyer(buyer3, "Ош Рисайклинг (DEMO)", ["Ош"], { PET: "19.00", PAPER: "5.00" }, "200.000", false);

  /* ---------- Операции (история за 4 месяца) ---------- */
  const mkReq = (r: (typeof residents)[number], code: string, w: string, spot: number, extra: Record<string, unknown> = {}) =>
    createRequest(r.id, {
      categoryId: cat[code].id, approxWeightKg: w, locality: "Кара-Суу", address: SPOTS[spot % SPOTS.length].address,
      lat: SPOTS[spot % SPOTS.length].lat, lng: SPOTS[spot % SPOTS.length].lng, allowCollective: false, ...extra,
    } as never);

  const history: { r: number; code: string; approx: string; actual: string; ago: number; buyer: typeof buyer; review?: [number, string] }[] = [
    { r: 0, code: "PET", approx: "14", actual: "13.4", ago: 105, buyer, review: [5, "Приехали вовремя, честно взвесили. (DEMO-отзыв)"] },
    { r: 1, code: "CARDBOARD", approx: "30", actual: "27.5", ago: 92, buyer },
    { r: 2, code: "METAL", approx: "45", actual: "47", ago: 80, buyer: buyer2, review: [4, "Нормально, но опоздали на час. (DEMO-отзыв)"] },
    { r: 3, code: "PET", approx: "22", actual: "21", ago: 66, buyer },
    { r: 0, code: "PAPER", approx: "18", actual: "18.6", ago: 51, buyer, review: [5, "Всё понятно и быстро. (DEMO-отзыв)"] },
    { r: 4, code: "ALUMINUM", approx: "6", actual: "5.8", ago: 38, buyer },
    { r: 5, code: "PET", approx: "35", actual: "33.2", ago: 24, buyer: buyer2 },
    { r: 6, code: "CARDBOARD", approx: "26", actual: "25", ago: 12, buyer, review: [5, "Удобный сервис. (DEMO-отзыв)"] },
    { r: 0, code: "PET", approx: "12", actual: "12.2", ago: 5, buyer },
  ];
  for (const h of history) {
    const res = residents[h.r];
    const req = await mkReq(res, h.code, h.approx, h.r + h.ago);
    const { pickup } = await acceptRequest(h.buyer.id, req.id);
    await schedulePickup(h.buyer.id, pickup.id, daysAgo(h.ago - 1));
    const rep = await reportWeight(h.buyer.id, pickup.id, h.actual);
    await confirmPickup(res.id, pickup.id, rep.pin);
    if (h.review) await createReview(res.id, pickup.id, h.review[0], h.review[1]);
    // Переносим даты в прошлое для динамики по месяцам.
    const at = daysAgo(h.ago);
    await db.update(schema.pickups).set({ completedAt: at, createdAt: new Date(at.getTime() - DAY) }).where(eq(schema.pickups.id, pickup.id));
    await db.update(schema.recyclingRequests).set({ createdAt: new Date(at.getTime() - 2 * DAY) }).where(eq(schema.recyclingRequests.id, req.id));
    await db.update(schema.walletTransactions).set({ createdAt: at }).where(eq(schema.walletTransactions.pickupId, pickup.id));
  }

  /* ---------- Открытые заявки (видны на карте) ---------- */
  const open = [
    [0, "PET", "12", 1], [1, "PET", "8", 2], [2, "CARDBOARD", "20", 3], [3, "PAPER", "15", 4],
    [4, "METAL", "60", 5], [5, "ALUMINUM", "4", 6], [6, "PET", "9", 7], [7, "CARDBOARD", "14", 8],
  ] as const;
  for (const [ri, code, w, spot] of open) {
    await mkReq(residents[ri], code, w, spot, { description: "DEMO-заявка", pickupDate: daysAhead(2 + (spot % 4)).toISOString(), timeFrom: "10:00", timeTo: "14:00" });
  }

  /* ---------- Коллективный сбор: 12 жителей, 85 кг PET из 100 ---------- */
  const col = await createCollection(residents[1].id, {
    title: "PET Кара-Суу: сбор бутылок (DEMO)", categoryId: cat.PET.id, locality: "Кара-Суу", targetKg: "100",
    plannedDate: daysAhead(5).toISOString(),
  });
  const parts = [10, 8, 5, 9, 6, 7, 5, 8, 6, 7, 5, 9]; // = 85 кг, 12 участников
  for (let i = 0; i < 12; i++) {
    const res = residents[(i % (residents.length - 1)) + 1];
    // Каждый житель — отдельный участник: недостающих создаём как DEMO-пользователей.
    const member = i < residents.length - 1 ? res : await mkUser(`+9967000200${String(i).padStart(2, "0")}`, `Участник ${i + 1} (DEMO)`, "RESIDENT");
    const req = await mkReq(member, "PET", String(parts[i]), i + 3, { allowCollective: true, description: "DEMO: взнос в коллективный сбор" });
    await joinCollection(member.id, col.id, req.id);
  }

  // Второй сбор (картон), доведённый до цели и назначенный скупщику — для демонстрации вывоза.
  const col2 = await createCollection(residents[2].id, {
    title: "Картон: школа №3 (DEMO)", categoryId: cat.CARDBOARD.id, locality: "Кара-Суу", targetKg: "40",
  });
  for (const [i, w] of [[2, "18"], [3, "12"], [5, "14"]] as const) {
    const req = await mkReq(residents[i], "CARDBOARD", w, i + 6, { allowCollective: true });
    await joinCollection(residents[i].id, col2.id, req.id);
  }
  await assignCollection(buyer.id, col2.id);
  await scheduleCollection(buyer.id, col2.id, daysAhead(3));

  /* ---------- Маршрут скупщика ---------- */
  const [veh] = await db.select().from(schema.vehicles).where(eq(schema.vehicles.buyerId, buyer.id));
  const [route] = await db.insert(schema.routePlans).values({ buyerId: buyer.id, vehicleId: veh.id, plannedDate: daysAhead(3), note: "DEMO: групповой вывоз картона", isDemo: true }).returning();
  const stops = await db.select().from(schema.recyclingRequests).where(eq(schema.recyclingRequests.collectionId, col2.id));
  await db.insert(schema.routeStops).values(stops.map((s, i) => ({ routeId: route.id, requestId: s.id, seq: i + 1 })));

  /* ---------- Пометка DEMO для всего созданного сервисами ---------- */
  for (const t of ["recycling_requests", "collective_collections", "pickups", "wallet_transactions", "reviews", "users"]) {
    await db.execute(sql.raw(`UPDATE ${t} SET is_demo = true`));
  }
  void admin;

  console.log("\nГотово. DEMO-аккаунты (пароль для всех: " + DEMO_PASSWORD + "):");
  for (const [k, v] of Object.entries(DEMO_ACCOUNTS)) console.log(`  ${k.padEnd(9)} ${v.phone}`);
}

main()
  .then(() => pool.end())
  .catch(async (e) => {
    console.error(e);
    await pool.end();
    process.exit(1);
  });
