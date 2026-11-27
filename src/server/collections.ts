import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { kg } from "@/lib/money";
import { audit } from "./audit";
import { ServiceError } from "./errors";
import { notify } from "./notify";
import { hasActiveSubscription, recalcCollectionStatus } from "./requests";

const {
  collectiveCollections: collections,
  collectiveMemberships: memberships,
  recyclingRequests: requests,
  pickups,
  buyerPrices,
  buyerProfiles,
  users,
} = schema;

export async function createCollection(
  userId: string,
  input: { title: string; categoryId: string; locality: string; targetKg: string; plannedDate?: string },
) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u || u.status !== "ACTIVE" || u.role === "BUYER") throw new ServiceError("forbidden", 403);
  const [c] = await db
    .insert(collections)
    .values({
      title: input.title,
      categoryId: input.categoryId,
      locality: input.locality,
      targetKg: kg(input.targetKg),
      plannedDate: input.plannedDate ? new Date(input.plannedDate) : null,
      createdById: userId,
      organizationId: u.organizationId,
    })
    .returning();
  await audit(db, userId, "collection.create", "collection", c.id);
  return c;
}

/** Присоединение: заявка жителя должна совпадать по категории и населённому пункту. */
export async function joinCollection(userId: string, collectionId: string, requestId: string) {
  return db.transaction(async (tx) => {
    const [c] = await tx.select().from(collections).where(eq(collections.id, collectionId)).for("update");
    if (!c || !["OPEN", "TARGET_REACHED"].includes(c.status)) throw new ServiceError("collection_closed");
    const [r] = await tx.select().from(requests).where(eq(requests.id, requestId)).for("update");
    if (!r || r.residentId !== userId) throw new ServiceError("not_found", 404);
    if (r.status !== "AVAILABLE" || r.collectionId) throw new ServiceError("request_not_available");
    if (r.categoryId !== c.categoryId) throw new ServiceError("category_mismatch");
    if (r.locality !== c.locality) throw new ServiceError("locality_mismatch");
    if (!r.allowCollective) throw new ServiceError("collective_not_allowed");

    await tx.insert(memberships).values({ collectionId, userId, requestId, declaredKg: r.approxWeightKg });
    await tx.update(requests).set({ collectionId, updatedAt: new Date() }).where(eq(requests.id, requestId));
    await recalcCollectionStatus(tx, collectionId);
    await audit(tx, userId, "collection.join", "collection", collectionId, { requestId });
  });
}

export async function leaveCollection(userId: string, collectionId: string) {
  return db.transaction(async (tx) => {
    const [c] = await tx.select().from(collections).where(eq(collections.id, collectionId)).for("update");
    if (!c || !["OPEN", "TARGET_REACHED"].includes(c.status)) throw new ServiceError("collection_closed");
    const [m] = await tx
      .select()
      .from(memberships)
      .where(and(eq(memberships.collectionId, collectionId), eq(memberships.userId, userId)));
    if (!m) throw new ServiceError("not_found", 404);
    await tx.delete(memberships).where(eq(memberships.id, m.id));
    if (m.requestId)
      await tx.update(requests).set({ collectionId: null, updatedAt: new Date() }).where(eq(requests.id, m.requestId));
    await recalcCollectionStatus(tx, collectionId);
    await audit(tx, userId, "collection.leave", "collection", collectionId);
  });
}

/** Скупщик берёт коллективный сбор: атомарно, один скупщик на сбор. */
export async function assignCollection(buyerId: string, collectionId: string) {
  return db.transaction(async (tx) => {
    const [buyer] = await tx.select().from(users).where(eq(users.id, buyerId));
    if (!buyer || buyer.role !== "BUYER" || buyer.status !== "ACTIVE") throw new ServiceError("forbidden", 403);
    if (!(await hasActiveSubscription(tx, buyerId))) throw new ServiceError("subscription_required", 402);

    const [c0] = await tx.select().from(collections).where(eq(collections.id, collectionId));
    if (!c0) throw new ServiceError("not_found", 404);
    const [price] = await tx
      .select()
      .from(buyerPrices)
      .where(and(eq(buyerPrices.buyerId, buyerId), eq(buyerPrices.categoryId, c0.categoryId)));
    if (!price) throw new ServiceError("no_price_for_category");
    const [bp] = await tx.select().from(buyerProfiles).where(eq(buyerProfiles.userId, buyerId));
    const [{ sum }] = await tx
      .select({ sum: sql<string>`coalesce(sum(${requests.approxWeightKg}), 0)` })
      .from(requests)
      .where(and(eq(requests.collectionId, collectionId), ne(requests.status, "CANCELLED")));
    const reachedTarget = Number(sum) >= Number(c0.targetKg);
    const reachedBuyerMin = Number(sum) > 0 && Number(sum) >= Number(bp?.minBatchKg ?? 0) && Number(bp?.minBatchKg ?? 0) > 0;
    if (!reachedTarget && !reachedBuyerMin) throw new ServiceError("target_not_reached");

    const claimed = await tx
      .update(collections)
      .set({ status: "ASSIGNED", buyerId, updatedAt: new Date() })
      .where(and(eq(collections.id, collectionId), inArray(collections.status, ["OPEN", "TARGET_REACHED"]), sql`${collections.buyerId} IS NULL`))
      .returning();
    if (claimed.length === 0) throw new ServiceError("already_taken", 409);

    const reqs = await tx
      .select()
      .from(requests)
      .where(and(eq(requests.collectionId, collectionId), eq(requests.status, "AVAILABLE")));
    for (const r of reqs) {
      await tx
        .update(requests)
        .set({ status: "RESERVED", buyerId, agreedPricePerKg: price.pricePerKg, updatedAt: new Date() })
        .where(and(eq(requests.id, r.id), eq(requests.status, "AVAILABLE")));
      await tx.insert(pickups).values({
        requestId: r.id,
        buyerId,
        residentId: r.residentId,
        collectionId,
        pricePerKg: price.pricePerKg,
        status: "SCHEDULED",
        scheduledAt: c0.plannedDate,
      });
      await notify(tx, r.residentId, "collection_assigned", { title: c0.title }, `/resident/collections/${collectionId}`);
    }
    await audit(tx, buyerId, "collection.assign", "collection", collectionId, { requests: reqs.length });
    return { collection: claimed[0], requests: reqs.length };
  });
}

export async function scheduleCollection(buyerId: string, collectionId: string, when: Date) {
  return db.transaction(async (tx) => {
    const [c] = await tx.select().from(collections).where(eq(collections.id, collectionId)).for("update");
    if (!c || c.buyerId !== buyerId) throw new ServiceError("not_found", 404);
    if (!["ASSIGNED", "PICKUP_PENDING"].includes(c.status)) throw new ServiceError("invalid_state");
    await tx
      .update(collections)
      .set({ status: "PICKUP_PENDING", plannedDate: when, updatedAt: new Date() })
      .where(eq(collections.id, collectionId));
    const ps = await tx
      .select()
      .from(pickups)
      .where(and(eq(pickups.collectionId, collectionId), eq(pickups.status, "SCHEDULED")));
    for (const p of ps) {
      await tx.update(pickups).set({ scheduledAt: when }).where(eq(pickups.id, p.id));
      await tx
        .update(requests)
        .set({ status: "PICKUP_PENDING", pickupDate: when, updatedAt: new Date() })
        .where(eq(requests.id, p.requestId));
      await notify(tx, p.residentId, "pickup_scheduled", { date: when.toISOString().slice(0, 10) }, `/resident/collections/${collectionId}`);
    }
  });
}
