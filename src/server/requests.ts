import { randomInt } from "node:crypto";
import { and, desc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { db, schema, type Tx } from "@/db";
import { publicCoords } from "@/lib/geo";
import { kg, total } from "@/lib/money";
import type { RequestInput } from "@/lib/validation";
import { audit } from "./audit";
import { ServiceError } from "./errors";
import { notify } from "./notify";
import { sha256 } from "./auth-core";
import { awardForPickup } from "./wallet";

const {
  recyclingRequests: requests,
  pickups,
  pickupConfirmations,
  buyerPrices,
  buyerServiceAreas,
  materialCategories,
  subscriptions,
  collectiveMemberships,
  collectiveCollections,
  disputes,
  users,
} = schema;

export const PIN_TTL_MS = 24 * 60 * 60 * 1000;
export const PIN_MAX_ATTEMPTS = 5;

export async function hasActiveSubscription(tx: Tx | typeof db, buyerId: string) {
  const rows = await tx
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.buyerId, buyerId),
        inArray(subscriptions.status, ["TRIAL", "ACTIVE"]),
        gt(subscriptions.endsAt, new Date()),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/* ------------------------------------------------------------------ */
/* Создание и отмена                                                   */
/* ------------------------------------------------------------------ */

export async function createRequest(residentId: string, input: RequestInput) {
  return db.transaction(async (tx) => {
    const [cat] = await tx.select().from(materialCategories).where(eq(materialCategories.id, input.categoryId));
    if (!cat || !cat.active) throw new ServiceError("category_unavailable");
    const pub = publicCoords(input.lat, input.lng, residentId);
    const desired =
      input.desiredPricePerKg !== undefined && input.desiredPricePerKg !== ""
        ? String(input.desiredPricePerKg).replace(",", ".")
        : null;
    const [r] = await tx
      .insert(requests)
      .values({
        residentId,
        categoryId: input.categoryId,
        materialType: input.materialType || null,
        approxWeightKg: kg(input.approxWeightKg),
        description: input.description || null,
        locality: input.locality,
        address: input.address,
        lat: input.lat.toFixed(6),
        lng: input.lng.toFixed(6),
        publicLat: pub.lat.toFixed(6),
        publicLng: pub.lng.toFixed(6),
        pickupDate: input.pickupDate ? new Date(input.pickupDate) : null,
        timeFrom: input.timeFrom || null,
        timeTo: input.timeTo || null,
        desiredPricePerKg: desired && Number(desired) >= 0 ? desired : null,
        allowCollective: input.allowCollective,
        status: "AVAILABLE",
      })
      .returning();

    // Уведомить подходящих скупщиков: зона обслуживания + цена на категорию + активная подписка.
    const matching = await tx
      .select({ id: buyerServiceAreas.buyerId })
      .from(buyerServiceAreas)
      .innerJoin(buyerPrices, eq(buyerPrices.buyerId, buyerServiceAreas.buyerId))
      .where(and(eq(buyerServiceAreas.locality, r.locality), eq(buyerPrices.categoryId, r.categoryId)));
    for (const b of matching) {
      if (await hasActiveSubscription(tx, b.id)) {
        await notify(tx, b.id, "new_request", { weight: r.approxWeightKg, locality: r.locality }, "/buyer/requests");
      }
    }
    await audit(tx, residentId, "request.create", "request", r.id, { weight: r.approxWeightKg });
    return r;
  });
}

export async function cancelRequest(residentId: string, requestId: string) {
  return db.transaction(async (tx) => {
    const [r] = await tx.select().from(requests).where(eq(requests.id, requestId)).for("update");
    if (!r || r.residentId !== residentId) throw new ServiceError("not_found", 404);
    if (!["AVAILABLE", "RESERVED", "DRAFT"].includes(r.status)) throw new ServiceError("cannot_cancel");

    if (r.status === "RESERVED") {
      // Заявка уже принята: отменяем забор и уведомляем скупщика.
      await tx.update(pickups).set({ status: "CANCELLED" }).where(eq(pickups.requestId, r.id));
      if (r.buyerId) await notify(tx, r.buyerId, "request_cancelled", { weight: r.approxWeightKg }, "/buyer/pickups");
    }
    await tx.delete(collectiveMemberships).where(eq(collectiveMemberships.requestId, r.id));
    await tx
      .update(requests)
      .set({ status: "CANCELLED", collectionId: null, updatedAt: new Date() })
      .where(eq(requests.id, r.id));
    if (r.collectionId) await recalcCollectionStatus(tx, r.collectionId);
    await audit(tx, residentId, "request.cancel", "request", r.id, { from: r.status });
  });
}

/** Пересчёт статуса сбора по сумме весов участников (OPEN ↔ TARGET_REACHED). */
export async function recalcCollectionStatus(tx: Tx, collectionId: string) {
  const [c] = await tx.select().from(collectiveCollections).where(eq(collectiveCollections.id, collectionId));
  if (!c || !["OPEN", "TARGET_REACHED"].includes(c.status)) return;
  const [{ sum }] = await tx
    .select({ sum: sql<string>`coalesce(sum(${requests.approxWeightKg}), 0)` })
    .from(requests)
    .where(and(eq(requests.collectionId, collectionId), ne(requests.status, "CANCELLED")));
  const reached = Number(sum) >= Number(c.targetKg);
  if (reached && c.status === "OPEN") {
    await tx
      .update(collectiveCollections)
      .set({ status: "TARGET_REACHED", updatedAt: new Date() })
      .where(eq(collectiveCollections.id, collectionId));
    const members = await tx
      .select({ userId: collectiveMemberships.userId })
      .from(collectiveMemberships)
      .where(eq(collectiveMemberships.collectionId, collectionId));
    for (const m of members)
      await notify(tx, m.userId, "collection_target_reached", { title: c.title }, `/resident/collections/${c.id}`);
  } else if (!reached && c.status === "TARGET_REACHED") {
    await tx
      .update(collectiveCollections)
      .set({ status: "OPEN", updatedAt: new Date() })
      .where(eq(collectiveCollections.id, collectionId));
  }
}

/* ------------------------------------------------------------------ */
/* Принятие заявки скупщиком (атомарно)                                */
/* ------------------------------------------------------------------ */

export async function acceptRequest(buyerId: string, requestId: string) {
  return db.transaction(async (tx) => {
    const [buyer] = await tx.select().from(users).where(eq(users.id, buyerId));
    if (!buyer || buyer.role !== "BUYER" || buyer.status !== "ACTIVE") throw new ServiceError("forbidden", 403);
    if (!(await hasActiveSubscription(tx, buyerId))) throw new ServiceError("subscription_required", 402);

    const [r0] = await tx.select().from(requests).where(eq(requests.id, requestId));
    if (!r0) throw new ServiceError("not_found", 404);
    const [price] = await tx
      .select()
      .from(buyerPrices)
      .where(and(eq(buyerPrices.buyerId, buyerId), eq(buyerPrices.categoryId, r0.categoryId)));
    if (!price) throw new ServiceError("no_price_for_category");

    // Единственная точка принятия: условный UPDATE. Второй конкурент получит 0 строк.
    const updated = await tx
      .update(requests)
      .set({ status: "RESERVED", buyerId, agreedPricePerKg: price.pricePerKg, updatedAt: new Date() })
      .where(and(eq(requests.id, requestId), eq(requests.status, "AVAILABLE"), sql`${requests.collectionId} IS NULL`))
      .returning();
    if (updated.length === 0) throw new ServiceError("already_taken", 409);
    const r = updated[0];

    const [pickup] = await tx
      .insert(pickups)
      .values({
        requestId: r.id,
        buyerId,
        residentId: r.residentId,
        pricePerKg: price.pricePerKg,
        status: "SCHEDULED",
        scheduledAt: r.pickupDate,
      })
      .returning();
    await notify(tx, r.residentId, "request_accepted", { weight: r.approxWeightKg }, "/resident/requests");
    await audit(tx, buyerId, "request.accept", "request", r.id, { pickupId: pickup.id });
    return { request: r, pickup };
  });
}

/* ------------------------------------------------------------------ */
/* Планирование, вес, подтверждение                                    */
/* ------------------------------------------------------------------ */

export async function schedulePickup(buyerId: string, pickupId: string, when: Date) {
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(pickups).where(eq(pickups.id, pickupId)).for("update");
    if (!p || p.buyerId !== buyerId) throw new ServiceError("not_found", 404);
    if (p.status !== "SCHEDULED") throw new ServiceError("invalid_state");
    await tx.update(pickups).set({ scheduledAt: when }).where(eq(pickups.id, p.id));
    await tx
      .update(requests)
      .set({ status: "PICKUP_PENDING", pickupDate: when, updatedAt: new Date() })
      .where(eq(requests.id, p.requestId));
    await notify(tx, p.residentId, "pickup_scheduled", { date: when.toISOString().slice(0, 10) }, "/resident/requests");
    return p.id;
  });
}

function newPin() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Скупщик вносит фактический вес. Возвращает одноразовый PIN (показывается только сейчас). */
export async function reportWeight(buyerId: string, pickupId: string, weight: string) {
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(pickups).where(eq(pickups.id, pickupId)).for("update");
    if (!p || p.buyerId !== buyerId) throw new ServiceError("not_found", 404);
    if (!["SCHEDULED", "AWAITING_CONFIRMATION"].includes(p.status)) throw new ServiceError("invalid_state");
    if (!p.pricePerKg) throw new ServiceError("no_price_for_category");
    const w = kg(weight);
    if (Number(w) <= 0) throw new ServiceError("weight_invalid");
    const amount = total(w, p.pricePerKg);

    // Предыдущий активный PIN аннулируется.
    await tx
      .update(pickupConfirmations)
      .set({ status: "EXPIRED" })
      .where(and(eq(pickupConfirmations.pickupId, p.id), eq(pickupConfirmations.status, "PENDING")));
    const pin = newPin();
    await tx.insert(pickupConfirmations).values({
      pickupId: p.id,
      pinHash: sha256(`${p.id}:${pin}`),
      expiresAt: new Date(Date.now() + PIN_TTL_MS),
      actualWeightKg: w,
      totalAmount: amount,
    });
    await tx.update(pickups).set({ status: "AWAITING_CONFIRMATION", reportedWeightKg: w }).where(eq(pickups.id, p.id));
    await tx
      .update(requests)
      .set({ status: "PICKUP_PENDING", updatedAt: new Date() })
      .where(eq(requests.id, p.requestId));
    await notify(tx, p.residentId, "weight_reported", { weight: w, amount }, "/resident/requests");
    return { pin, weight: w, amount, expiresAt: new Date(Date.now() + PIN_TTL_MS) };
  });
}

/** Общая процедура завершения: используется подтверждением жителя и решением спора администратором. */
export async function completePickup(
  tx: Tx,
  pickupId: string,
  weight: string,
  amount: string,
): Promise<{ coins: number }> {
  const [done] = await tx
    .update(pickups)
    .set({ status: "COMPLETED", actualWeightKg: weight, totalAmount: amount, completedAt: new Date() })
    .where(and(eq(pickups.id, pickupId), inArray(pickups.status, ["AWAITING_CONFIRMATION", "DISPUTED"])))
    .returning();
  if (!done) throw new ServiceError("invalid_state", 409);

  const [req] = await tx
    .update(requests)
    .set({ status: "COMPLETED", actualWeightKg: weight, updatedAt: new Date() })
    .where(eq(requests.id, done.requestId))
    .returning();
  if (req.collectionId) {
    await tx
      .update(collectiveMemberships)
      .set({ actualKg: weight })
      .where(and(eq(collectiveMemberships.collectionId, req.collectionId), eq(collectiveMemberships.userId, req.residentId)));
  }
  const coins = await awardForPickup(tx, {
    pickupId,
    residentId: done.residentId,
    categoryId: req.categoryId,
    weightKg: weight,
    isCollective: !!req.collectionId,
  });
  await notify(tx, done.residentId, "pickup_completed", { weight, amount }, "/resident/history");
  await notify(tx, done.buyerId, "pickup_completed", { weight, amount }, "/buyer/history");
  if (req.collectionId) await finishCollectionIfDone(tx, req.collectionId);
  return { coins };
}

async function finishCollectionIfDone(tx: Tx, collectionId: string) {
  const rest = await tx
    .select({ id: pickups.id })
    .from(pickups)
    .where(and(eq(pickups.collectionId, collectionId), inArray(pickups.status, ["SCHEDULED", "AWAITING_CONFIRMATION", "DISPUTED"])))
    .limit(1);
  if (rest.length === 0) {
    await tx
      .update(collectiveCollections)
      .set({ status: "COMPLETED", updatedAt: new Date() })
      .where(and(eq(collectiveCollections.id, collectionId), inArray(collectiveCollections.status, ["ASSIGNED", "PICKUP_PENDING"])));
  }
}

export type ConfirmResult =
  | { ok: true; coins: number; weight: string; amount: string }
  | { ok: false; error: "invalid_pin" | "expired" | "too_many_attempts" | "invalid_state"; attemptsLeft?: number };

/** Житель вводит PIN, который называет скупщик при передаче. Одноразово, с лимитом попыток. */
export async function confirmPickup(residentId: string, pickupId: string, pin: string): Promise<ConfirmResult> {
  return db.transaction(async (tx): Promise<ConfirmResult> => {
    const [p] = await tx.select().from(pickups).where(eq(pickups.id, pickupId)).for("update");
    if (!p || p.residentId !== residentId) throw new ServiceError("not_found", 404);
    if (p.status !== "AWAITING_CONFIRMATION") return { ok: false, error: "invalid_state" };

    const [c] = await tx
      .select()
      .from(pickupConfirmations)
      .where(and(eq(pickupConfirmations.pickupId, p.id), eq(pickupConfirmations.status, "PENDING")))
      .orderBy(desc(pickupConfirmations.createdAt))
      .for("update");
    if (!c) return { ok: false, error: "invalid_state" };
    if (c.expiresAt <= new Date()) {
      await tx.update(pickupConfirmations).set({ status: "EXPIRED" }).where(eq(pickupConfirmations.id, c.id));
      return { ok: false, error: "expired" };
    }
    if (c.attempts >= PIN_MAX_ATTEMPTS) return { ok: false, error: "too_many_attempts" };

    if (sha256(`${p.id}:${pin.trim()}`) !== c.pinHash) {
      const attempts = c.attempts + 1;
      await tx.update(pickupConfirmations).set({ attempts }).where(eq(pickupConfirmations.id, c.id));
      return attempts >= PIN_MAX_ATTEMPTS
        ? { ok: false, error: "too_many_attempts" }
        : { ok: false, error: "invalid_pin", attemptsLeft: PIN_MAX_ATTEMPTS - attempts };
    }
    await tx
      .update(pickupConfirmations)
      .set({ status: "CONFIRMED", confirmedAt: new Date() })
      .where(and(eq(pickupConfirmations.id, c.id), eq(pickupConfirmations.status, "PENDING")));
    const { coins } = await completePickup(tx, p.id, c.actualWeightKg, c.totalAmount);
    await audit(tx, residentId, "pickup.confirm", "pickup", p.id, { weight: c.actualWeightKg, amount: c.totalAmount });
    return { ok: true, coins, weight: c.actualWeightKg, amount: c.totalAmount };
  });
}

/* ------------------------------------------------------------------ */
/* Споры                                                               */
/* ------------------------------------------------------------------ */

export async function openDispute(userId: string, pickupId: string, reason: string) {
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(pickups).where(eq(pickups.id, pickupId)).for("update");
    if (!p || (p.residentId !== userId && p.buyerId !== userId)) throw new ServiceError("not_found", 404);
    if (!["SCHEDULED", "AWAITING_CONFIRMATION"].includes(p.status)) throw new ServiceError("invalid_state");
    if (reason.trim().length < 5) throw new ServiceError("reason_required");
    await tx.update(pickups).set({ status: "DISPUTED" }).where(eq(pickups.id, p.id));
    await tx.update(requests).set({ status: "DISPUTED", updatedAt: new Date() }).where(eq(requests.id, p.requestId));
    await tx
      .update(pickupConfirmations)
      .set({ status: "DISPUTED" })
      .where(and(eq(pickupConfirmations.pickupId, p.id), eq(pickupConfirmations.status, "PENDING")));
    const [d] = await tx.insert(disputes).values({ pickupId: p.id, openedById: userId, reason: reason.trim() }).returning();
    const other = userId === p.residentId ? p.buyerId : p.residentId;
    await notify(tx, other, "dispute_opened", {}, undefined);
    await audit(tx, userId, "dispute.open", "dispute", d.id, { pickupId });
    return d;
  });
}

export type DisputeDecision = "RESOLVED_ACCEPT_BUYER" | "RESOLVED_ACCEPT_RESIDENT" | "REJECTED";

export async function resolveDispute(adminId: string, disputeId: string, decision: DisputeDecision, resolution: string) {
  return db.transaction(async (tx) => {
    const [d] = await tx.select().from(disputes).where(eq(disputes.id, disputeId)).for("update");
    if (!d || d.status !== "OPEN") throw new ServiceError("invalid_state", 409);
    const [p] = await tx.select().from(pickups).where(eq(pickups.id, d.pickupId)).for("update");
    if (!p) throw new ServiceError("not_found", 404);

    if (decision === "RESOLVED_ACCEPT_BUYER") {
      if (!p.reportedWeightKg || !p.pricePerKg) throw new ServiceError("weight_missing");
      await completePickup(tx, p.id, p.reportedWeightKg, total(p.reportedWeightKg, p.pricePerKg));
    } else if (decision === "RESOLVED_ACCEPT_RESIDENT") {
      await tx.update(pickups).set({ status: "CANCELLED" }).where(eq(pickups.id, p.id));
      await tx
        .update(requests)
        .set({ status: "AVAILABLE", buyerId: null, agreedPricePerKg: null, updatedAt: new Date() })
        .where(eq(requests.id, p.requestId));
    } else {
      // Жалоба отклонена: операция возвращается в ожидание подтверждения.
      await tx
        .update(pickups)
        .set({ status: p.reportedWeightKg ? "AWAITING_CONFIRMATION" : "SCHEDULED" })
        .where(eq(pickups.id, p.id));
      await tx.update(requests).set({ status: "PICKUP_PENDING", updatedAt: new Date() }).where(eq(requests.id, p.requestId));
    }
    await tx
      .update(disputes)
      .set({ status: decision, resolution, resolvedById: adminId, resolvedAt: new Date() })
      .where(eq(disputes.id, d.id));
    for (const uid of [p.residentId, p.buyerId]) await notify(tx, uid, "dispute_resolved", {}, undefined);
    await audit(tx, adminId, "dispute.resolve", "dispute", d.id, { decision });
  });
}
