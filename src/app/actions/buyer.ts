"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { kg } from "@/lib/money";
import { priceSchema, weightSchema } from "@/lib/validation";
import { run } from "@/server/action";
import { audit } from "@/server/audit";
import { assignCollection, scheduleCollection } from "@/server/collections";
import { ServiceError } from "@/server/errors";
import { acceptRequest, reportWeight, schedulePickup } from "@/server/requests";
import { requireActor } from "@/server/session";

const done = () => revalidatePath("/buyer", "layout");

export async function acceptRequestAction(requestId: string) {
  return run(async () => {
    const u = await requireActor("BUYER");
    const r = await acceptRequest(u.id, requestId);
    done();
    return { pickupId: r.pickup.id };
  });
}

export async function schedulePickupAction(pickupId: string, when: string) {
  return run(async () => {
    const u = await requireActor("BUYER");
    const d = new Date(when);
    if (Number.isNaN(d.getTime())) throw new ServiceError("date_invalid");
    await schedulePickup(u.id, pickupId, d);
    done();
    return {};
  });
}

export async function reportWeightAction(pickupId: string, weight: string) {
  return run(async () => {
    const u = await requireActor("BUYER");
    const w = weightSchema.parse(weight);
    const r = await reportWeight(u.id, pickupId, w);
    done();
    return { pin: r.pin, weight: r.weight, amount: r.amount, expiresAt: r.expiresAt.toISOString() };
  });
}

export async function savePriceAction(input: unknown) {
  return run(async () => {
    const u = await requireActor("BUYER");
    const d = priceSchema.parse(input);
    await db
      .insert(schema.buyerPrices)
      .values({
        buyerId: u.id,
        categoryId: d.categoryId,
        pricePerKg: Number(d.pricePerKg).toFixed(2),
        minVolumeKg: kg(d.minVolumeKg),
        terms: d.terms || null,
      })
      .onConflictDoUpdate({
        target: [schema.buyerPrices.buyerId, schema.buyerPrices.categoryId],
        set: {
          pricePerKg: Number(d.pricePerKg).toFixed(2),
          minVolumeKg: kg(d.minVolumeKg),
          terms: d.terms || null,
          updatedAt: new Date(),
        },
      });
    await audit(db, u.id, "price.save", "buyer_price", d.categoryId, { price: d.pricePerKg });
    done();
    return {};
  });
}

export async function deletePriceAction(categoryId: string) {
  return run(async () => {
    const u = await requireActor("BUYER");
    await db.delete(schema.buyerPrices).where(and(eq(schema.buyerPrices.buyerId, u.id), eq(schema.buyerPrices.categoryId, categoryId)));
    done();
    return {};
  });
}

const profileSchema = z.object({
  orgName: z.string().trim().max(200).optional().or(z.literal("")),
  contactPhone: z.string().trim().max(16).optional().or(z.literal("")),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  minBatchKg: weightSchema.or(z.literal("0")),
  areas: z.array(z.string().trim().min(2).max(120)).max(30),
});

export async function saveBuyerProfileAction(input: unknown) {
  return run(async () => {
    const u = await requireActor("BUYER");
    const d = profileSchema.parse(input);
    await db.transaction(async (tx) => {
      await tx
        .insert(schema.buyerProfiles)
        .values({ userId: u.id, orgName: d.orgName || null, contactPhone: d.contactPhone || null, description: d.description || null, minBatchKg: kg(d.minBatchKg) })
        .onConflictDoUpdate({
          target: schema.buyerProfiles.userId,
          set: { orgName: d.orgName || null, contactPhone: d.contactPhone || null, description: d.description || null, minBatchKg: kg(d.minBatchKg) },
        });
      await tx.delete(schema.buyerServiceAreas).where(eq(schema.buyerServiceAreas.buyerId, u.id));
      const uniq = [...new Set(d.areas)];
      if (uniq.length) await tx.insert(schema.buyerServiceAreas).values(uniq.map((locality) => ({ buyerId: u.id, locality })));
      await audit(tx, u.id, "buyer.profile", "user", u.id);
    });
    done();
    return {};
  });
}

export async function saveVehicleAction(input: { name: string; capacityKg: string }) {
  return run(async () => {
    const u = await requireActor("BUYER");
    const name = z.string().trim().min(2).max(120).parse(input.name);
    const cap = weightSchema.parse(input.capacityKg);
    await db.insert(schema.vehicles).values({ buyerId: u.id, name, capacityKg: kg(cap) });
    done();
    return {};
  });
}

export async function deleteVehicleAction(id: string) {
  return run(async () => {
    const u = await requireActor("BUYER");
    await db.delete(schema.vehicles).where(and(eq(schema.vehicles.id, id), eq(schema.vehicles.buyerId, u.id)));
    done();
    return {};
  });
}

export async function assignCollectionAction(collectionId: string) {
  return run(async () => {
    const u = await requireActor("BUYER");
    const r = await assignCollection(u.id, collectionId);
    done();
    return { requests: r.requests };
  });
}

export async function scheduleCollectionAction(collectionId: string, when: string) {
  return run(async () => {
    const u = await requireActor("BUYER");
    const d = new Date(when);
    if (Number.isNaN(d.getTime())) throw new ServiceError("date_invalid");
    await scheduleCollection(u.id, collectionId, d);
    done();
    return {};
  });
}

/** Демонстрационная оплата подписки: реального списания средств нет. */
export async function demoPaySubscriptionAction() {
  return run(async () => {
    const u = await requireActor("BUYER");
    await db.transaction(async (tx) => {
      const now = new Date();
      const [last] = await tx
        .select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.buyerId, u.id))
        .orderBy(schema.subscriptions.endsAt)
        .limit(1000)
        .then((rows) => rows.slice(-1));
      const from = last && last.endsAt > now ? last.endsAt : now;
      const [sub] = await tx
        .insert(schema.subscriptions)
        .values({ buyerId: u.id, status: "ACTIVE", startsAt: from, endsAt: new Date(from.getTime() + 30 * 86400000), isTrial: false })
        .returning();
      await tx.insert(schema.subscriptionEvents).values({ subscriptionId: sub.id, type: "DEMO_PAYMENT", amountUsd: "10.00", isDemo: true });
      await audit(tx, u.id, "subscription.demo_pay", "subscription", sub.id);
    });
    done();
    return {};
  });
}
