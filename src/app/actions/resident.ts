"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { collectionSchema, requestSchema } from "@/lib/validation";
import { run } from "@/server/action";
import { createCollection, joinCollection, leaveCollection } from "@/server/collections";
import { ServiceError } from "@/server/errors";
import { MAX_PHOTOS, savePhoto } from "@/server/photos";
import { cancelRequest, confirmPickup, createRequest, openDispute } from "@/server/requests";
import { createReview, flagReview } from "@/server/reviews";
import { requireActor } from "@/server/session";

export async function createRequestAction(form: FormData) {
  return run(async () => {
    const u = await requireActor("RESIDENT");
    const raw = form.get("data");
    if (typeof raw !== "string") throw new ServiceError("invalid");
    const input = requestSchema.parse(JSON.parse(raw));
    const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length > MAX_PHOTOS) throw new ServiceError("photo_limit");
    const names: string[] = [];
    for (const f of files) names.push(await savePhoto(f));
    const r = await createRequest(u.id, input);
    if (names.length) await db.insert(schema.requestPhotos).values(names.map((url) => ({ requestId: r.id, url })));
    const collectionId = form.get("collectionId");
    if (typeof collectionId === "string" && collectionId && input.allowCollective) {
      await joinCollection(u.id, collectionId, r.id);
    }
    revalidatePath("/resident");
    return { id: r.id };
  });
}

export async function cancelRequestAction(id: string) {
  return run(async () => {
    const u = await requireActor("RESIDENT");
    await cancelRequest(u.id, id);
    revalidatePath("/resident", "layout");
    return {};
  });
}

export async function confirmPickupAction(pickupId: string, pin: string) {
  return run(async () => {
    const u = await requireActor("RESIDENT");
    const r = await confirmPickup(u.id, pickupId, pin);
    revalidatePath("/resident", "layout");
    if (!r.ok) throw Object.assign(new ServiceError(r.error), { attemptsLeft: r.attemptsLeft });
    return { coins: r.coins, weight: r.weight, amount: r.amount };
  });
}

export async function openDisputeAction(pickupId: string, reason: string) {
  return run(async () => {
    const u = await requireActor("RESIDENT", "BUYER");
    await openDispute(u.id, pickupId, reason);
    revalidatePath("/", "layout");
    return {};
  });
}

export async function createCollectionAction(input: unknown) {
  return run(async () => {
    const u = await requireActor("RESIDENT");
    const d = collectionSchema.parse(input);
    const c = await createCollection(u.id, d);
    revalidatePath("/resident", "layout");
    return { id: c.id };
  });
}

export async function joinCollectionAction(collectionId: string, requestId: string) {
  return run(async () => {
    const u = await requireActor("RESIDENT");
    await joinCollection(u.id, collectionId, requestId);
    revalidatePath("/resident", "layout");
    return {};
  });
}

export async function leaveCollectionAction(collectionId: string) {
  return run(async () => {
    const u = await requireActor("RESIDENT");
    await leaveCollection(u.id, collectionId);
    revalidatePath("/resident", "layout");
    return {};
  });
}

export async function reviewAction(pickupId: string, rating: number, text: string) {
  return run(async () => {
    const u = await requireActor("RESIDENT");
    await createReview(u.id, pickupId, rating, text);
    revalidatePath("/resident", "layout");
    return {};
  });
}

export async function flagReviewAction(reviewId: string) {
  return run(async () => {
    const u = await requireActor("BUYER");
    await flagReview(u.id, reviewId);
    revalidatePath("/buyer", "layout");
    return {};
  });
}

export async function markNotificationsReadAction() {
  return run(async () => {
    const u = await requireActor();
    await db
      .update(schema.notifications)
      .set({ readAt: new Date() })
      .where(and(eq(schema.notifications.userId, u.id), isNull(schema.notifications.readAt)));
    revalidatePath("/", "layout");
    return {};
  });
}

/** Только чтение: предложения скупщиков по категории и населённому пункту (цены заявлены самими скупщиками). */
export async function offersAction(categoryId: string, locality: string, weight: string) {
  return run(async () => {
    await requireActor("RESIDENT");
    const { offersFor } = await import("@/server/queries");
    const w = String(weight).replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(w)) return { offers: [] as never[] };
    const rows = await offersFor(categoryId, locality, w);
    return {
      offers: rows.map((o) => ({
        buyerId: o.buyerId, name: o.orgName || o.name, price: o.price, estimate: o.estimate, minVolume: o.minVolume,
        terms: o.terms, validUntil: o.validUntil ? o.validUntil.toISOString() : null, updatedAt: o.updatedAt.toISOString(),
        verified: o.verified, avg: o.rating.average, n: o.rating.count,
      })),
    };
  });
}
