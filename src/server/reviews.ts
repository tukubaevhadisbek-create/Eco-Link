import { and, avg, count, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "./audit";
import { ServiceError } from "./errors";

const { reviews, pickups } = schema;

export async function createReview(residentId: string, pickupId: string, rating: number, text: string) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ServiceError("rating_invalid");
  const [p] = await db.select().from(pickups).where(eq(pickups.id, pickupId));
  // Отзыв — только участник завершённой операции.
  if (!p || p.residentId !== residentId) throw new ServiceError("not_found", 404);
  if (p.status !== "COMPLETED") throw new ServiceError("review_not_allowed");
  try {
    const [r] = await db
      .insert(reviews)
      .values({ pickupId, residentId, buyerId: p.buyerId, rating, text: text.trim().slice(0, 1000) || null })
      .returning();
    await audit(db, residentId, "review.create", "review", r.id);
    return r;
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new ServiceError("review_exists");
    throw e;
  }
}

export async function flagReview(userId: string, reviewId: string) {
  const [r] = await db.select().from(reviews).where(eq(reviews.id, reviewId));
  if (!r || r.buyerId !== userId) throw new ServiceError("not_found", 404);
  await db.update(reviews).set({ status: "FLAGGED" }).where(and(eq(reviews.id, reviewId), eq(reviews.status, "VISIBLE")));
}

export async function buyerRating(buyerId: string) {
  const [row] = await db
    .select({ avg: avg(reviews.rating), n: count() })
    .from(reviews)
    .where(and(eq(reviews.buyerId, buyerId), eq(reviews.status, "VISIBLE")));
  return { average: row?.avg ? Number(row.avg) : null, count: Number(row?.n ?? 0) };
}
