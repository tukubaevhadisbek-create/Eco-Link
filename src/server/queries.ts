import { CATEGORIES } from "@/db/reference-data";
import { and, asc, count, desc, eq, gt, inArray, isNull, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { co2Saved, sumKg, total } from "@/lib/money";
import { hasActiveSubscription } from "./requests";

const {
  recyclingRequests: requests, materialCategories: cats, users, pickups, buyerPrices, buyerServiceAreas,
  buyerProfiles, collectiveCollections: collections, collectiveMemberships: memberships, wallets, walletTransactions,
  notifications, reviews, subscriptions, vehicles, requestPhotos, disputes, organizations,
} = schema;

/**
 * Самовосстановление: если в базе нет ни одной категории (например, на Render сервис запущен без
 * `npm run db:bootstrap`), добавляем базовые категории. Ничего не удаляет и не трогает существующие.
 */
let ensuring: Promise<void> | null = null;
async function ensureCategories() {
  const [any] = await db.select({ id: cats.id }).from(cats).limit(1);
  if (any) return;
  await db
    .insert(cats)
    .values(CATEGORIES.map((c) => ({ code: c.code, nameRu: c.ru, nameKg: c.kg, nameEn: c.en, co2PerKg: c.co2, sortOrder: c.order })))
    .onConflictDoNothing({ target: cats.code });
}
const ready = () => (ensuring ??= ensureCategories().catch((e) => { ensuring = null; throw e; }));

export const categories = async () => {
  await ready();
  return db.select().from(cats).where(eq(cats.active, true)).orderBy(asc(cats.sortOrder), asc(cats.nameRu));
};

/** Все категории, включая отключённые: нужны только для подписей уже существующих заявок и сборов. */
export const allCategories = async () => {
  await ready();
  return db.select().from(cats).orderBy(asc(cats.sortOrder), asc(cats.nameRu));
};

/* ---------- Публичные данные (без адресов, телефонов и точных координат) ---------- */

export type PublicPoint = {
  kind: "request" | "collection";
  id: string;
  lat: number;
  lng: number;
  categoryCode: string;
  categoryId: string;
  locality: string;
  weightKg: number;
  targetKg?: number;
  members?: number;
};

export async function publicMapPoints(): Promise<PublicPoint[]> {
  const rs = await db
    .select({
      id: requests.id, lat: requests.publicLat, lng: requests.publicLng, locality: requests.locality,
      w: requests.approxWeightKg, code: cats.code, categoryId: cats.id,
    })
    .from(requests)
    .innerJoin(cats, eq(cats.id, requests.categoryId))
    .where(and(eq(requests.status, "AVAILABLE"), isNull(requests.collectionId)))
    .limit(500);
  const points: PublicPoint[] = rs.map((r) => ({
    kind: "request", id: r.id, lat: Number(r.lat), lng: Number(r.lng), categoryCode: r.code, categoryId: r.categoryId,
    locality: r.locality, weightKg: Number(r.w),
  }));
  for (const c of await collectionsOverview({ openOnly: true })) {
    const pts = await db
      .select({ lat: requests.publicLat, lng: requests.publicLng })
      .from(requests)
      .where(and(eq(requests.collectionId, c.id), ne(requests.status, "CANCELLED")));
    if (!pts.length) continue;
    const lat = pts.reduce((a, p) => a + Number(p.lat), 0) / pts.length;
    const lng = pts.reduce((a, p) => a + Number(p.lng), 0) / pts.length;
    points.push({
      kind: "collection", id: c.id, lat, lng, categoryCode: c.categoryCode, categoryId: c.categoryId,
      locality: c.locality, weightKg: Number(c.currentKg), targetKg: Number(c.targetKg), members: c.members,
    });
  }
  return points;
}

export async function collectionsOverview(opts: { openOnly?: boolean; locality?: string } = {}) {
  const rows = await db
    .select({
      id: collections.id, title: collections.title, locality: collections.locality, status: collections.status,
      targetKg: collections.targetKg, plannedDate: collections.plannedDate, buyerId: collections.buyerId,
      categoryId: cats.id, categoryCode: cats.code, nameRu: cats.nameRu, nameKg: cats.nameKg, nameEn: cats.nameEn,
      isDemo: collections.isDemo,
    })
    .from(collections)
    .innerJoin(cats, eq(cats.id, collections.categoryId))
    .where(
      and(
        opts.openOnly ? inArray(collections.status, ["OPEN", "TARGET_REACHED"]) : undefined,
        opts.locality ? eq(collections.locality, opts.locality) : undefined,
      ),
    )
    .orderBy(desc(collections.createdAt));
  const out = [];
  for (const c of rows) {
    const [agg] = await db
      .select({ sum: sql<string>`coalesce(sum(${requests.approxWeightKg}),0)`, n: sql<number>`count(distinct ${requests.residentId})` })
      .from(requests)
      .where(and(eq(requests.collectionId, c.id), ne(requests.status, "CANCELLED")));
    out.push({ ...c, currentKg: agg.sum, members: Number(agg.n) });
  }
  return out;
}

export async function publicStats() {
  const completed = await db.select().from(pickups).where(eq(pickups.status, "COMPLETED"));
  const real = completed.filter((p) => !p.isDemo);
  const mk = async (list: typeof completed) => {
    const kgSum = sumKg(list.map((p) => p.actualWeightKg ?? "0"));
    return { kg: kgSum, operations: list.length, participants: new Set(list.map((p) => p.residentId)).size };
  };
  return { all: await mk(completed), real: await mk(real) };
}

/** EcoImpact: агрегаты по подтверждённым операциям. */
export async function impactStats() {
  const rows = await db
    .select({
      kg: pickups.actualWeightKg, residentId: pickups.residentId, buyerId: pickups.buyerId, completedAt: pickups.completedAt,
      isDemo: pickups.isDemo, code: cats.code, nameRu: cats.nameRu, nameKg: cats.nameKg, nameEn: cats.nameEn,
      co2: cats.co2PerKg, locality: requests.locality,
    })
    .from(pickups)
    .innerJoin(requests, eq(requests.id, pickups.requestId))
    .innerJoin(cats, eq(cats.id, requests.categoryId))
    .where(eq(pickups.status, "COMPLETED"));
  const totalKg = sumKg(rows.map((r) => r.kg ?? "0"));
  const byCategory = new Map<string, { code: string; nameRu: string; nameKg: string; nameEn: string; kg: number }>();
  const byLocality = new Map<string, number>();
  const byMonth = new Map<string, number>();
  let co2 = 0;
  for (const r of rows) {
    const w = Number(r.kg ?? 0);
    const c = byCategory.get(r.code) ?? { code: r.code, nameRu: r.nameRu, nameKg: r.nameKg, nameEn: r.nameEn, kg: 0 };
    c.kg += w;
    byCategory.set(r.code, c);
    byLocality.set(r.locality, (byLocality.get(r.locality) ?? 0) + w);
    const m = (r.completedAt ?? new Date()).toISOString().slice(0, 7);
    byMonth.set(m, (byMonth.get(m) ?? 0) + w);
    co2 += Number(co2Saved(r.kg ?? "0", r.co2));
  }
  const [{ n: collectionsN }] = await db.select({ n: count() }).from(collections);
  const [{ n: activeBuyers }] = await db
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.role, "BUYER"), eq(users.status, "ACTIVE")));
  return {
    totalKg,
    operations: rows.length,
    participants: new Set(rows.map((r) => r.residentId)).size,
    activeBuyers: Number(activeBuyers),
    collections: Number(collectionsN),
    co2Kg: co2.toFixed(0),
    hasDemo: rows.some((r) => r.isDemo),
    byCategory: [...byCategory.values()].sort((a, b) => b.kg - a.kg),
    byLocality: [...byLocality.entries()].map(([locality, kg]) => ({ locality, kg })).sort((a, b) => b.kg - a.kg),
    byMonth: [...byMonth.entries()].sort().map(([month, kg]) => ({ month, kg: Math.round(kg * 10) / 10 })),
  };
}

/* ---------- Житель ---------- */

export async function residentRequests(userId: string) {
  return db
    .select({ r: requests, code: cats.code, nameRu: cats.nameRu, nameKg: cats.nameKg, nameEn: cats.nameEn })
    .from(requests)
    .innerJoin(cats, eq(cats.id, requests.categoryId))
    .where(eq(requests.residentId, userId))
    .orderBy(desc(requests.createdAt));
}

export async function residentPickups(userId: string) {
  const rows = await db
    .select({
      p: pickups, r: requests, code: cats.code, nameRu: cats.nameRu, nameKg: cats.nameKg, nameEn: cats.nameEn,
      buyerName: users.name, review: reviews.id, rating: reviews.rating,
    })
    .from(pickups)
    .innerJoin(requests, eq(requests.id, pickups.requestId))
    .innerJoin(cats, eq(cats.id, requests.categoryId))
    .innerJoin(users, eq(users.id, pickups.buyerId))
    .leftJoin(reviews, eq(reviews.pickupId, pickups.id))
    .where(eq(pickups.residentId, userId))
    .orderBy(desc(pickups.createdAt));
  return rows;
}

export async function buyerRatings(ids: string[]) {
  if (!ids.length) return new Map<string, { average: number | null; count: number }>();
  const rows = await db
    .select({ buyerId: reviews.buyerId, avg: sql<string>`avg(${reviews.rating})`, n: count() })
    .from(reviews)
    .where(and(inArray(reviews.buyerId, ids), eq(reviews.status, "VISIBLE")))
    .groupBy(reviews.buyerId);
  const m = new Map<string, { average: number | null; count: number }>(rows.map((r) => [r.buyerId, { average: Number(r.avg), count: Number(r.n) }]));
  for (const id of ids) if (!m.has(id)) m.set(id, { average: null, count: 0 });
  return m;
}

/** Сравнение предложений скупщиков для категории и населённого пункта. Цена — не рыночная, а заявленная скупщиком. */
export async function offersFor(categoryId: string, locality: string, weightKg: string) {
  const rows = await db
    .select({
      buyerId: users.id, name: users.name, orgName: buyerProfiles.orgName, price: buyerPrices.pricePerKg,
      minVolume: buyerPrices.minVolumeKg, terms: buyerPrices.terms, validUntil: buyerPrices.validUntil,
      updatedAt: buyerPrices.updatedAt, verified: buyerProfiles.verified,
    })
    .from(buyerPrices)
    .innerJoin(users, eq(users.id, buyerPrices.buyerId))
    .innerJoin(buyerProfiles, eq(buyerProfiles.userId, users.id))
    .innerJoin(buyerServiceAreas, and(eq(buyerServiceAreas.buyerId, users.id), eq(buyerServiceAreas.locality, locality)))
    .where(and(eq(buyerPrices.categoryId, categoryId), eq(users.status, "ACTIVE")));
  const active: typeof rows = [];
  for (const r of rows) if (await hasActiveSubscription(db, r.buyerId)) active.push(r);
  const ratings = await buyerRatings(active.map((r) => r.buyerId));
  return active
    .map((r) => ({ ...r, estimate: total(weightKg, r.price), rating: ratings.get(r.buyerId)! }))
    .sort((a, b) => Number(b.price) - Number(a.price));
}

export async function walletOverview(userId: string) {
  const [w] = await db.select().from(wallets).where(eq(wallets.userId, userId));
  const tx = await db.select().from(walletTransactions).where(eq(walletTransactions.userId, userId)).orderBy(desc(walletTransactions.createdAt)).limit(100);
  const [{ n }] = await db.select({ n: count() }).from(pickups).where(and(eq(pickups.residentId, userId), eq(pickups.status, "COMPLETED")));
  const earned = tx.filter((t) => t.type === "EARN").reduce((a, t) => a + t.amount, 0);
  const spent = tx.filter((t) => t.type === "SPEND").reduce((a, t) => a + Math.abs(t.amount), 0);
  const collectiveBonus = tx.filter((t) => t.reason === "COLLECTIVE").reduce((a, t) => a + t.amount, 0);
  return { balance: w?.balance ?? 0, tx, completed: Number(n), earned, spent, collectiveBonus };
}

export async function notificationsFor(userId: string, limit = 50) {
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}
export async function unreadCount(userId: string) {
  const [{ n }] = await db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return Number(n);
}

/** Детали сбора для жителя: участники без адресов и телефонов (только имя в сокращённом виде). */
export async function collectionDetail(id: string) {
  const [c] = (await collectionsOverview()).filter((x) => x.id === id);
  if (!c) return null;
  const members = await db
    .select({ userId: memberships.userId, name: users.name, kg: memberships.declaredKg, actual: memberships.actualKg })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.collectionId, id))
    .orderBy(asc(memberships.joinedAt));
  const shortName = (n: string) => {
    const [a, b] = n.split(" ");
    return b ? `${a} ${b[0]}.` : a;
  };
  let buyerName: string | null = null;
  if (c.buyerId) buyerName = (await db.select({ n: users.name }).from(users).where(eq(users.id, c.buyerId)))[0]?.n ?? null;
  return { ...c, buyerName, members: members.map((m) => ({ ...m, name: shortName(m.name) })), memberCount: members.length };
}

/* ---------- Скупщик ---------- */

export async function buyerProfileFull(buyerId: string) {
  const [p] = await db.select().from(buyerProfiles).where(eq(buyerProfiles.userId, buyerId));
  const areas = await db.select().from(buyerServiceAreas).where(eq(buyerServiceAreas.buyerId, buyerId));
  const prices = await db
    .select({ p: buyerPrices, code: cats.code, nameRu: cats.nameRu, nameKg: cats.nameKg, nameEn: cats.nameEn })
    .from(buyerPrices)
    .innerJoin(cats, eq(cats.id, buyerPrices.categoryId))
    .where(eq(buyerPrices.buyerId, buyerId));
  const vs = await db.select().from(vehicles).where(eq(vehicles.buyerId, buyerId));
  const subs = await db.select().from(subscriptions).where(eq(subscriptions.buyerId, buyerId)).orderBy(desc(subscriptions.endsAt));
  return { profile: p, areas: areas.map((a) => a.locality), prices, vehicles: vs, subscriptions: subs };
}

/** Доступные для скупщика заявки: только публичные поля. Без адреса, телефона и точных координат. */
export async function buyerAvailableRequests(buyerId: string) {
  const prof = await buyerProfileFull(buyerId);
  const priceCats = new Set(prof.prices.map((p) => p.p.categoryId));
  const rows = await db
    .select({
      id: requests.id, lat: requests.publicLat, lng: requests.publicLng, locality: requests.locality, w: requests.approxWeightKg,
      desired: requests.desiredPricePerKg, pickupDate: requests.pickupDate, timeFrom: requests.timeFrom, timeTo: requests.timeTo,
      description: requests.description, materialType: requests.materialType, createdAt: requests.createdAt, isDemo: requests.isDemo,
      categoryId: cats.id, code: cats.code, nameRu: cats.nameRu, nameKg: cats.nameKg, nameEn: cats.nameEn,
    })
    .from(requests)
    .innerJoin(cats, eq(cats.id, requests.categoryId))
    .where(and(eq(requests.status, "AVAILABLE"), isNull(requests.collectionId)))
    .orderBy(desc(requests.createdAt))
    .limit(300);
  const priceMap = new Map(prof.prices.map((p) => [p.p.categoryId, p.p.pricePerKg]));
  return rows.map((r) => ({
    ...r,
    inArea: prof.areas.length === 0 || prof.areas.includes(r.locality),
    hasPrice: priceCats.has(r.categoryId),
    estimate: priceMap.has(r.categoryId) ? total(r.w, priceMap.get(r.categoryId)!) : null,
  }));
}

/** Назначенные скупщику заявки: здесь уже раскрываются точный адрес, координаты и контакты жителя. */
export async function buyerPickups(buyerId: string, statuses: string[]) {
  return db
    .select({
      p: pickups, r: requests, code: cats.code, nameRu: cats.nameRu, nameKg: cats.nameKg, nameEn: cats.nameEn,
      residentName: users.name, residentPhone: users.phone, collectionTitle: collections.title,
    })
    .from(pickups)
    .innerJoin(requests, eq(requests.id, pickups.requestId))
    .innerJoin(cats, eq(cats.id, requests.categoryId))
    .innerJoin(users, eq(users.id, pickups.residentId))
    .leftJoin(collections, eq(collections.id, pickups.collectionId))
    .where(and(eq(pickups.buyerId, buyerId), inArray(pickups.status, statuses as never)))
    .orderBy(desc(pickups.createdAt));
}

export async function buyerAnalytics(buyerId: string) {
  const rows = await db
    .select({ w: pickups.actualWeightKg, amt: pickups.totalAmount, at: pickups.completedAt, code: cats.code, nameRu: cats.nameRu, nameKg: cats.nameKg, nameEn: cats.nameEn })
    .from(pickups)
    .innerJoin(requests, eq(requests.id, pickups.requestId))
    .innerJoin(cats, eq(cats.id, requests.categoryId))
    .where(and(eq(pickups.buyerId, buyerId), eq(pickups.status, "COMPLETED")));
  const byMonth = new Map<string, { kg: number; amount: number }>();
  const byCat = new Map<string, { name: { ru: string; kg: string; en: string }; kg: number }>();
  for (const r of rows) {
    const m = (r.at ?? new Date()).toISOString().slice(0, 7);
    const x = byMonth.get(m) ?? { kg: 0, amount: 0 };
    x.kg += Number(r.w); x.amount += Number(r.amt);
    byMonth.set(m, x);
    const c = byCat.get(r.code) ?? { name: { ru: r.nameRu, kg: r.nameKg, en: r.nameEn }, kg: 0 };
    c.kg += Number(r.w);
    byCat.set(r.code, c);
  }
  return {
    totalKg: sumKg(rows.map((r) => r.w ?? "0")),
    totalAmount: rows.reduce((a, r) => a + Number(r.amt), 0).toFixed(2),
    operations: rows.length,
    byMonth: [...byMonth.entries()].sort().map(([month, v]) => ({ month, kg: Math.round(v.kg * 10) / 10, amount: Math.round(v.amount) })),
    byCategory: [...byCat.entries()].map(([code, v]) => ({ code, ...v })),
  };
}

export async function buyerReviews(buyerId: string) {
  return db
    .select({ r: reviews, name: users.name })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.residentId))
    .where(and(eq(reviews.buyerId, buyerId), ne(reviews.status, "HIDDEN")))
    .orderBy(desc(reviews.createdAt))
    .limit(50);
}

/** Коллективные сборы, доступные скупщику для назначения. */
export async function availableCollectionsForBuyer(buyerId: string) {
  const prof = await buyerProfileFull(buyerId);
  const all = await collectionsOverview();
  return all.filter(
    (c) => (["OPEN", "TARGET_REACHED"].includes(c.status) && (prof.areas.length === 0 || prof.areas.includes(c.locality))) || c.buyerId === buyerId,
  );
}

export async function photosOf(requestId: string) {
  return db.select().from(requestPhotos).where(eq(requestPhotos.requestId, requestId));
}

/* ---------- Админ ---------- */

export async function adminDashboard() {
  const cnt = async (q: Promise<{ n: number }[]>) => Number((await q)[0].n);
  return {
    users: await cnt(db.select({ n: count() }).from(users).where(eq(users.role, "RESIDENT"))),
    buyers: await cnt(db.select({ n: count() }).from(users).where(eq(users.role, "BUYER"))),
    requestsOpen: await cnt(db.select({ n: count() }).from(requests).where(eq(requests.status, "AVAILABLE"))),
    requestsTotal: await cnt(db.select({ n: count() }).from(requests)),
    pickupsDone: await cnt(db.select({ n: count() }).from(pickups).where(eq(pickups.status, "COMPLETED"))),
    openDisputes: await cnt(db.select({ n: count() }).from(disputes).where(eq(disputes.status, "OPEN"))),
    flaggedReviews: await cnt(db.select({ n: count() }).from(reviews).where(eq(reviews.status, "FLAGGED"))),
    activeSubs: await cnt(db.select({ n: count() }).from(subscriptions).where(and(inArray(subscriptions.status, ["TRIAL", "ACTIVE"]), gt(subscriptions.endsAt, new Date())))),
    organizations: await cnt(db.select({ n: count() }).from(organizations)),
  };
}

export async function orgRanking() {
  const rows = await db
    .select({ id: organizations.id, name: organizations.name, type: organizations.type, locality: organizations.locality, isDemo: organizations.isDemo, kg: sql<string>`coalesce(sum(${pickups.actualWeightKg}),0)` })
    .from(organizations)
    .leftJoin(users, eq(users.organizationId, organizations.id))
    .leftJoin(pickups, and(eq(pickups.residentId, users.id), eq(pickups.status, "COMPLETED")))
    .groupBy(organizations.id)
    .orderBy(desc(sql`coalesce(sum(${pickups.actualWeightKg}),0)`));
  return rows;
}

export async function settingsMap(): Promise<Record<string, string>> {
  const rows = await db.select().from(schema.settings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
