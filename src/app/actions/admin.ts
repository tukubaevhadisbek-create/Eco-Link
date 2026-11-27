"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { run } from "@/server/action";
import { audit } from "@/server/audit";
import { ServiceError } from "@/server/errors";
import { cancelRequest, resolveDispute, type DisputeDecision } from "@/server/requests";
import { requireActor } from "@/server/session";

const refresh = () => revalidatePath("/admin", "layout");

export async function setUserStatusAction(userId: string, status: "ACTIVE" | "BLOCKED") {
  return run(async () => {
    const a = await requireActor("ADMIN");
    if (userId === a.id) throw new ServiceError("forbidden", 403);
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    if (!u || u.role === "ADMIN") throw new ServiceError("forbidden", 403);
    await db.transaction(async (tx) => {
      await tx.update(schema.users).set({ status, updatedAt: new Date() }).where(eq(schema.users.id, userId));
      if (status === "BLOCKED") await tx.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
      await audit(tx, a.id, status === "BLOCKED" ? "user.block" : "user.unblock", "user", userId);
    });
    refresh();
    return {};
  });
}

export async function adminCancelRequestAction(requestId: string) {
  return run(async () => {
    const a = await requireActor("ADMIN");
    const [r] = await db.select().from(schema.recyclingRequests).where(eq(schema.recyclingRequests.id, requestId));
    if (!r) throw new ServiceError("not_found", 404);
    await cancelRequest(r.residentId, requestId); // та же логика, что и у жителя
    await audit(db, a.id, "request.moderate_cancel", "request", requestId);
    refresh();
    return {};
  });
}

export async function verifyBuyerAction(buyerId: string, verified: boolean) {
  return run(async () => {
    const a = await requireActor("ADMIN");
    await db.update(schema.buyerProfiles).set({ verified }).where(eq(schema.buyerProfiles.userId, buyerId));
    await audit(db, a.id, "buyer.verify", "user", buyerId, { verified });
    refresh();
    return {};
  });
}

const categorySchema = z.object({
  id: z.uuid().optional(),
  code: z.string().trim().regex(/^[A-Z0-9_]{2,40}$/),
  nameRu: z.string().trim().min(2).max(120),
  nameKg: z.string().trim().min(2).max(120),
  nameEn: z.string().trim().min(2).max(120),
  co2PerKg: z.string().regex(/^\d+(\.\d{1,4})?$/),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  active: z.boolean(),
});

export async function saveCategoryAction(input: unknown) {
  return run(async () => {
    const a = await requireActor("ADMIN");
    const d = categorySchema.parse(input);
    const cats = schema.materialCategories;
    // Код должен быть уникальным: проверяем заранее, чтобы показать понятную ошибку вместо «server_error».
    const [dup] = await db.select({ id: cats.id }).from(cats).where(eq(cats.code, d.code));
    if (dup && dup.id !== d.id) throw new ServiceError("category_code_exists");
    // Новая категория без явного порядка уходит в конец списка, а не в начало (sort_order по умолчанию 0).
    let sortOrder = d.sortOrder;
    if (sortOrder === undefined && !d.id) {
      const [m] = await db.select({ m: sql<number>`coalesce(max(${cats.sortOrder}), 0)` }).from(cats);
      sortOrder = Number(m.m) + 1;
    }
    const vals = {
      code: d.code, nameRu: d.nameRu, nameKg: d.nameKg, nameEn: d.nameEn, co2PerKg: d.co2PerKg, active: d.active,
      ...(sortOrder !== undefined ? { sortOrder } : {}),
    };
    if (d.id) await db.update(cats).set(vals).where(eq(cats.id, d.id));
    else await db.insert(cats).values(vals);
    await audit(db, a.id, "category.save", "category", d.id ?? d.code);
    revalidatePath("/", "layout");
    return {};
  });
}

export async function saveBonusRuleAction(input: unknown) {
  return run(async () => {
    const a = await requireActor("ADMIN");
    const d = z.object({
      id: z.uuid(), coinsPerKg: z.string().regex(/^\d+(\.\d{1,3})?$/),
      flatBonus: z.coerce.number().int().min(0).max(100000), collectiveBonus: z.coerce.number().int().min(0).max(100000), active: z.boolean(),
    }).parse(input);
    await db.update(schema.bonusRules).set({ coinsPerKg: d.coinsPerKg, flatBonus: d.flatBonus, collectiveBonus: d.collectiveBonus, active: d.active }).where(eq(schema.bonusRules.id, d.id));
    await audit(db, a.id, "bonus.update", "bonus_rule", d.id, d);
    refresh();
    return {};
  });
}

export async function createOrgAction(input: unknown) {
  return run(async () => {
    const a = await requireActor("ADMIN");
    const d = z.object({
      name: z.string().trim().min(2).max(200), type: z.enum(["SCHOOL", "SHOP", "ENTERPRISE", "AIYL_OKMOTU", "NGO"]), locality: z.string().trim().min(2).max(120),
    }).parse(input);
    const [o] = await db.insert(schema.organizations).values(d).returning();
    await audit(db, a.id, "org.create", "organization", o.id);
    refresh();
    return {};
  });
}

export async function resolveDisputeAction(id: string, decision: DisputeDecision, resolution: string) {
  return run(async () => {
    const a = await requireActor("ADMIN");
    if (!["RESOLVED_ACCEPT_BUYER", "RESOLVED_ACCEPT_RESIDENT", "REJECTED"].includes(decision)) throw new ServiceError("invalid");
    await resolveDispute(a.id, id, decision, resolution.trim().slice(0, 1000));
    refresh();
    return {};
  });
}

export async function moderateReviewAction(id: string, status: "VISIBLE" | "HIDDEN") {
  return run(async () => {
    const a = await requireActor("ADMIN");
    await db.update(schema.reviews).set({ status }).where(eq(schema.reviews.id, id));
    await audit(db, a.id, "review.moderate", "review", id, { status });
    refresh();
    return {};
  });
}

/** Тестовые подписки: реальных платежей нет, все события DEMO. */
export async function grantSubscriptionAction(buyerId: string, kind: "TRIAL" | "ACTIVE" | "CANCEL") {
  return run(async () => {
    const a = await requireActor("ADMIN");
    await db.transaction(async (tx) => {
      const now = new Date();
      if (kind === "CANCEL") {
        const subs = await tx.select().from(schema.subscriptions).where(eq(schema.subscriptions.buyerId, buyerId));
        for (const s of subs) {
          await tx.update(schema.subscriptions).set({ status: "CANCELLED", endsAt: now > s.startsAt ? now : new Date(s.startsAt.getTime() + 1000) }).where(and(eq(schema.subscriptions.id, s.id)));
          await tx.insert(schema.subscriptionEvents).values({ subscriptionId: s.id, type: "CANCELLED_BY_ADMIN", isDemo: true });
        }
      } else {
        const days = kind === "TRIAL" ? 14 : 30;
        const [s] = await tx.insert(schema.subscriptions).values({
          buyerId, status: kind, isTrial: kind === "TRIAL", startsAt: now, endsAt: new Date(now.getTime() + days * 86400000),
        }).returning();
        await tx.insert(schema.subscriptionEvents).values({ subscriptionId: s.id, type: kind === "TRIAL" ? "TRIAL_GRANTED" : "ADMIN_GRANTED", isDemo: true });
      }
      await audit(tx, a.id, "subscription.admin", "user", buyerId, { kind });
    });
    refresh();
    return {};
  });
}

export async function saveSettingsAction(input: unknown) {
  return run(async () => {
    const a = await requireActor("ADMIN");
    const d = z.object({
      usdRate: z.string().regex(/^\d+(\.\d{1,4})?$/), rateDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(input);
    await db.transaction(async (tx) => {
      for (const [key, value] of [["usd_kgs_rate", d.usdRate], ["usd_kgs_rate_date", d.rateDate]] as const)
        await tx.insert(schema.settings).values({ key, value }).onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });
      await audit(tx, a.id, "settings.update", "settings", null, d);
    });
    revalidatePath("/", "layout");
    return {};
  });
}
