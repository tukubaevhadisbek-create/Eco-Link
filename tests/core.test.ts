import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { publicCoords } from "@/lib/geo";
import { ecoCoins, percent, total } from "@/lib/money";
import { registerSchema, requestSchema } from "@/lib/validation";
import { AuthError, authenticate, createSessionRecord, registerUser, resolveSession, destroySession } from "@/server/auth-core";
import { assignCollection, createCollection, joinCollection, leaveCollection, scheduleCollection } from "@/server/collections";
import {
  acceptRequest, cancelRequest, confirmPickup, createRequest, openDispute, reportWeight, resolveDispute, schedulePickup,
} from "@/server/requests";
import { awardForPickup } from "@/server/wallet";
import { givePrice, makeUser, requestInput, resetDb, seedBasics } from "./helpers";

let cats: Awaited<ReturnType<typeof seedBasics>>;
beforeAll(async () => {
  await resetDb();
});
beforeEach(async () => {
  await resetDb();
  cats = await seedBasics();
});

const balance = async (uid: string) =>
  (await db.select().from(schema.wallets).where(eq(schema.wallets.userId, uid)))[0]?.balance ?? 0;

describe("финансовые расчёты", () => {
  it("считает сумму без ошибок плавающей точки", () => {
    expect(total("12.345", "20.10")).toBe("248.13");
    expect(total("0.1", "0.2")).toBe("0.02");
    expect(total("3", "33.33")).toBe("99.99");
  });
  it("считает EcoCoins и процент", () => {
    expect(ecoCoins("12.9", { coinsPerKg: "2", flatBonus: 5, collectiveBonus: 10 }, false)).toBe(30);
    expect(ecoCoins("12.9", { coinsPerKg: "2", flatBonus: 5, collectiveBonus: 10 }, true)).toBe(40);
    expect(percent("85", "100")).toBe(85);
    expect(percent("150", "100")).toBe(100);
  });
  it("публичные координаты отличаются от точных и стабильны", () => {
    const a = publicCoords(40.70261, 72.85862, "u1");
    expect(a).toEqual(publicCoords(40.70261, 72.85862, "u1"));
    expect(a.lat).not.toBe(40.70261);
  });
});

describe("регистрация и авторизация", () => {
  it("регистрирует жителя с кошельком, а скупщика с пробной подпиской", async () => {
    const r = await makeUser("RESIDENT");
    const b = await makeUser("BUYER");
    expect(await db.select().from(schema.wallets).where(eq(schema.wallets.userId, r.id))).toHaveLength(1);
    const [sub] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.buyerId, b.id));
    expect(sub.status).toBe("TRIAL");
    expect(r.passwordHash).not.toContain("Passw0rd");
  });
  it("запрещает регистрацию ADMIN и слабые данные", () => {
    const base = { name: "Иван", phone: "+996700111222", password: "Passw0rd1", locality: "Ош", consent: true };
    expect(registerSchema.safeParse({ ...base, role: "ADMIN" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, role: "RESIDENT", phone: "0700111222" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, role: "RESIDENT", password: "short" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, role: "RESIDENT", consent: false }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, role: "RESIDENT" }).success).toBe(true);
  });
  it("не допускает дубликат телефона", async () => {
    const u = await makeUser("RESIDENT");
    await expect(
      registerUser({ name: "Дубль", phone: u.phone, password: "Passw0rd1", locality: "Ош", role: "RESIDENT", consent: true }),
    ).rejects.toMatchObject({ code: "phone_taken" });
  });
  it("входит с верным паролем, блокирует после 5 неудач", async () => {
    const u = await makeUser("RESIDENT");
    expect((await authenticate(u.phone, "Passw0rdTest")).id).toBe(u.id);
    for (let i = 0; i < 4; i++)
      await expect(authenticate(u.phone, "wrong")).rejects.toMatchObject({ code: "invalid_credentials" });
    await expect(authenticate(u.phone, "wrong")).rejects.toMatchObject({ code: "locked" });
    // даже верный пароль не пускает во время блокировки
    await expect(authenticate(u.phone, "Passw0rdTest")).rejects.toBeInstanceOf(AuthError);
  });
  it("сессия создаётся, находится по токену и уничтожается; заблокированный не проходит", async () => {
    const u = await makeUser("RESIDENT");
    const { token } = await createSessionRecord(u.id);
    expect((await resolveSession(token))?.id).toBe(u.id);
    const stored = await db.select().from(schema.sessions);
    expect(stored[0].id).not.toBe(token); // в БД только хеш
    await db.update(schema.users).set({ status: "BLOCKED" }).where(eq(schema.users.id, u.id));
    expect(await resolveSession(token)).toBeNull();
    await db.update(schema.users).set({ status: "ACTIVE" }).where(eq(schema.users.id, u.id));
    await destroySession(token);
    expect(await resolveSession(token)).toBeNull();
  });
});

describe("заявки", () => {
  it("валидирует заявку", () => {
    const base = { ...requestInput(cats.pet.id) };
    expect(requestSchema.safeParse(base).success).toBe(true);
    expect(requestSchema.safeParse({ ...base, approxWeightKg: "-3" }).success).toBe(false);
    expect(requestSchema.safeParse({ ...base, approxWeightKg: "abc" }).success).toBe(false);
    expect(requestSchema.safeParse({ ...base, lat: 200 }).success).toBe(false);
  });
  it("создаёт заявку, скрывает точные координаты и уведомляет подходящего скупщика", async () => {
    const r = await makeUser("RESIDENT");
    const b = await makeUser("BUYER");
    await givePrice(b.id, cats.pet.id);
    const req = await createRequest(r.id, requestInput(cats.pet.id) as never);
    expect(req.status).toBe("AVAILABLE");
    expect(req.publicLat).not.toBe(req.lat);
    const notes = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, b.id));
    expect(notes.map((n) => n.type)).toContain("new_request");
  });
  it("житель может отменить доступную и зарезервированную заявку, но не заявку в процессе забора", async () => {
    const r = await makeUser("RESIDENT");
    const b = await makeUser("BUYER");
    await givePrice(b.id, cats.pet.id);
    const a = await createRequest(r.id, requestInput(cats.pet.id) as never);
    await cancelRequest(r.id, a.id);
    expect((await db.select().from(schema.recyclingRequests).where(eq(schema.recyclingRequests.id, a.id)))[0].status).toBe("CANCELLED");

    const c = await createRequest(r.id, requestInput(cats.pet.id) as never);
    const { pickup } = await acceptRequest(b.id, c.id);
    await cancelRequest(r.id, c.id);
    expect((await db.select().from(schema.pickups).where(eq(schema.pickups.id, pickup.id)))[0].status).toBe("CANCELLED");

    const d = await createRequest(r.id, requestInput(cats.pet.id) as never);
    const acc = await acceptRequest(b.id, d.id);
    await schedulePickup(b.id, acc.pickup.id, new Date(Date.now() + 86400000));
    await expect(cancelRequest(r.id, d.id)).rejects.toMatchObject({ code: "cannot_cancel" });
  });
  it("чужую заявку отменить нельзя", async () => {
    const r = await makeUser("RESIDENT");
    const other = await makeUser("RESIDENT");
    const a = await createRequest(r.id, requestInput(cats.pet.id) as never);
    await expect(cancelRequest(other.id, a.id)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("принятие заявки", () => {
  it("при одновременном принятии побеждает ровно один скупщик", async () => {
    const r = await makeUser("RESIDENT");
    const buyers = await Promise.all(Array.from({ length: 6 }, () => makeUser("BUYER")));
    for (const b of buyers) await givePrice(b.id, cats.pet.id);
    const req = await createRequest(r.id, requestInput(cats.pet.id) as never);

    const results = await Promise.allSettled(buyers.map((b) => acceptRequest(b.id, req.id)));
    const ok = results.filter((x) => x.status === "fulfilled");
    const failed = results.filter((x) => x.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed.every((f) => f.reason.code === "already_taken")).toBe(true);
    expect(await db.select().from(schema.pickups)).toHaveLength(1);
  });
  it("требует активную подписку, цену на категорию и роль BUYER", async () => {
    const r = await makeUser("RESIDENT");
    const b = await makeUser("BUYER");
    const req = await createRequest(r.id, requestInput(cats.pet.id) as never);
    await expect(acceptRequest(b.id, req.id)).rejects.toMatchObject({ code: "no_price_for_category" });
    await expect(acceptRequest(r.id, req.id)).rejects.toMatchObject({ code: "forbidden" });
    await givePrice(b.id, cats.pet.id);
    await db.update(schema.subscriptions).set({ status: "EXPIRED" }).where(eq(schema.subscriptions.buyerId, b.id));
    await expect(acceptRequest(b.id, req.id)).rejects.toMatchObject({ code: "subscription_required" });
  });
});

describe("завершение операции и EcoCoins", () => {
  async function setup() {
    const r = await makeUser("RESIDENT");
    const b = await makeUser("BUYER");
    await givePrice(b.id, cats.pet.id, "20.00");
    const req = await createRequest(r.id, requestInput(cats.pet.id) as never);
    const { pickup } = await acceptRequest(b.id, req.id);
    await schedulePickup(b.id, pickup.id, new Date(Date.now() + 3600000));
    return { r, b, req, pickup };
  }

  it("полный цикл: вес → PIN → завершение → начисление, сумма по подтверждённому весу", async () => {
    const { r, b, req, pickup } = await setup();
    const rep = await reportWeight(b.id, pickup.id, "11.5");
    expect(rep.amount).toBe("230.00");
    expect(rep.pin).toMatch(/^\d{6}$/);
    const res = await confirmPickup(r.id, pickup.id, rep.pin);
    expect(res).toMatchObject({ ok: true, weight: "11.500", amount: "230.00" });

    const [p] = await db.select().from(schema.pickups).where(eq(schema.pickups.id, pickup.id));
    expect(p.status).toBe("COMPLETED");
    expect(p.actualWeightKg).toBe("11.500");
    const [rq] = await db.select().from(schema.recyclingRequests).where(eq(schema.recyclingRequests.id, req.id));
    expect(rq.status).toBe("COMPLETED");
    expect(rq.actualWeightKg).toBe("11.500");
    expect(await balance(r.id)).toBe(Math.floor(11.5 * 2) + 5); // 28
  });
  it("PIN одноразовый: повтор не завершает и не начисляет второй раз", async () => {
    const { r, b, pickup } = await setup();
    const rep = await reportWeight(b.id, pickup.id, "10");
    await confirmPickup(r.id, pickup.id, rep.pin);
    const again = await confirmPickup(r.id, pickup.id, rep.pin);
    expect(again).toMatchObject({ ok: false, error: "invalid_state" });
    expect(await balance(r.id)).toBe(25);
  });
  it("параллельное подтверждение даёт одно начисление", async () => {
    const { r, b, pickup } = await setup();
    const rep = await reportWeight(b.id, pickup.id, "10");
    const res = await Promise.all([1, 2, 3].map(() => confirmPickup(r.id, pickup.id, rep.pin)));
    expect(res.filter((x) => x.ok)).toHaveLength(1);
    expect(await balance(r.id)).toBe(25);
    expect(await db.select().from(schema.walletTransactions)).toHaveLength(1);
  });
  it("неверный PIN считает попытки и блокирует после 5", async () => {
    const { r, b, pickup } = await setup();
    const rep = await reportWeight(b.id, pickup.id, "10");
    const wrong = rep.pin === "000000" ? "111111" : "000000";
    for (let i = 1; i <= 4; i++)
      expect(await confirmPickup(r.id, pickup.id, wrong)).toMatchObject({ ok: false, error: "invalid_pin", attemptsLeft: 5 - i });
    expect(await confirmPickup(r.id, pickup.id, wrong)).toMatchObject({ ok: false, error: "too_many_attempts" });
    expect(await confirmPickup(r.id, pickup.id, rep.pin)).toMatchObject({ ok: false, error: "too_many_attempts" });
    expect(await balance(r.id)).toBe(0);
  });
  it("просроченный PIN не принимается, новый вес выпускает новый PIN", async () => {
    const { r, b, pickup } = await setup();
    const rep = await reportWeight(b.id, pickup.id, "10");
    await db.update(schema.pickupConfirmations).set({ expiresAt: new Date(Date.now() - 1000) });
    expect(await confirmPickup(r.id, pickup.id, rep.pin)).toMatchObject({ ok: false, error: "expired" });
    const rep2 = await reportWeight(b.id, pickup.id, "9");
    expect(await confirmPickup(r.id, pickup.id, rep2.pin)).toMatchObject({ ok: true, weight: "9.000" });
  });
  it("чужой житель не может подтвердить", async () => {
    const { b, pickup } = await setup();
    const stranger = await makeUser("RESIDENT");
    const rep = await reportWeight(b.id, pickup.id, "10");
    await expect(confirmPickup(stranger.id, pickup.id, rep.pin)).rejects.toMatchObject({ code: "not_found" });
  });
  it("повторный вызов начисления идемпотентен", async () => {
    const { r, b, req, pickup } = await setup();
    const rep = await reportWeight(b.id, pickup.id, "10");
    await confirmPickup(r.id, pickup.id, rep.pin);
    for (let i = 0; i < 3; i++)
      await db.transaction((tx) =>
        awardForPickup(tx, { pickupId: pickup.id, residentId: r.id, categoryId: req.categoryId, weightKg: "10", isCollective: false }),
      );
    expect(await balance(r.id)).toBe(25);
  });
  it("баланс кошелька не уходит в минус (CHECK)", async () => {
    const r = await makeUser("RESIDENT");
    await expect(db.update(schema.wallets).set({ balance: -1 }).where(eq(schema.wallets.userId, r.id))).rejects.toThrow();
  });
});

describe("споры", () => {
  async function disputed() {
    const r = await makeUser("RESIDENT");
    const b = await makeUser("BUYER");
    const admin = await makeUser("RESIDENT");
    await givePrice(b.id, cats.pet.id);
    const req = await createRequest(r.id, requestInput(cats.pet.id) as never);
    const { pickup } = await acceptRequest(b.id, req.id);
    await reportWeight(b.id, pickup.id, "8");
    await openDispute(r.id, pickup.id, "Вес занижен, было больше");
    return { r, b, admin, req, pickup };
  }
  it("спор блокирует подтверждение; решение в пользу скупщика завершает операцию с одним начислением", async () => {
    const { r, admin, pickup } = await disputed();
    const [d] = await db.select().from(schema.disputes);
    await resolveDispute(admin.id, d.id, "RESOLVED_ACCEPT_BUYER", "Вес проверен");
    expect((await db.select().from(schema.pickups).where(eq(schema.pickups.id, pickup.id)))[0].status).toBe("COMPLETED");
    expect(await balance(r.id)).toBe(21);
    await expect(resolveDispute(admin.id, d.id, "RESOLVED_ACCEPT_BUYER", "x")).rejects.toMatchObject({ code: "invalid_state" });
  });
  it("решение в пользу жителя возвращает заявку в доступные", async () => {
    const { admin, req } = await disputed();
    const [d] = await db.select().from(schema.disputes);
    await resolveDispute(admin.id, d.id, "RESOLVED_ACCEPT_RESIDENT", "Отмена");
    const [rq] = await db.select().from(schema.recyclingRequests).where(eq(schema.recyclingRequests.id, req.id));
    expect(rq.status).toBe("AVAILABLE");
    expect(rq.buyerId).toBeNull();
    // После спора заявку можно принять заново (старый забор отменён и не мешает).
    const b2 = await makeUser("BUYER");
    await givePrice(b2.id, cats.pet.id);
    await expect(acceptRequest(b2.id, req.id)).resolves.toBeTruthy();
  });
});

describe("коллективный сбор", () => {
  async function scene() {
    const buyer = await makeUser("BUYER");
    await givePrice(buyer.id, cats.pet.id, "18.00");
    const residents = await Promise.all([1, 2, 3].map(() => makeUser("RESIDENT")));
    const col = await createCollection(residents[0].id, {
      title: "PET Кара-Суу", categoryId: cats.pet.id, locality: "Кара-Суу", targetKg: "100",
    });
    return { buyer, residents, col };
  }
  const mk = (uid: string, w: string, cat: string, over = {}) =>
    createRequest(uid, requestInput(cat, { approxWeightKg: w, allowCollective: true, ...over }) as never);

  it("проверяет совместимость категории, населённого пункта и разрешения", async () => {
    const { residents, col } = await scene();
    const wrongCat = await mk(residents[0].id, "10", cats.cardboard.id);
    await expect(joinCollection(residents[0].id, col.id, wrongCat.id)).rejects.toMatchObject({ code: "category_mismatch" });
    const wrongLoc = await mk(residents[0].id, "10", cats.pet.id, { locality: "Ош" });
    await expect(joinCollection(residents[0].id, col.id, wrongLoc.id)).rejects.toMatchObject({ code: "locality_mismatch" });
    const noCollective = await createRequest(residents[0].id, requestInput(cats.pet.id) as never);
    await expect(joinCollection(residents[0].id, col.id, noCollective.id)).rejects.toMatchObject({ code: "collective_not_allowed" });
  });
  it("копит вес, достигает цели, выход пересчитывает статус", async () => {
    const { residents, col } = await scene();
    const a = await mk(residents[0].id, "60", cats.pet.id);
    const b = await mk(residents[1].id, "45", cats.pet.id);
    await joinCollection(residents[0].id, col.id, a.id);
    expect((await db.select().from(schema.collectiveCollections))[0].status).toBe("OPEN");
    await joinCollection(residents[1].id, col.id, b.id);
    expect((await db.select().from(schema.collectiveCollections))[0].status).toBe("TARGET_REACHED");
    const n = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, residents[1].id));
    expect(n.map((x) => x.type)).toContain("collection_target_reached");
    await leaveCollection(residents[1].id, col.id);
    expect((await db.select().from(schema.collectiveCollections))[0].status).toBe("OPEN");
  });
  it("индивидуальный скупщик не может забрать заявку из сбора", async () => {
    const { buyer, residents, col } = await scene();
    const a = await mk(residents[0].id, "60", cats.pet.id);
    await joinCollection(residents[0].id, col.id, a.id);
    await expect(acceptRequest(buyer.id, a.id)).rejects.toMatchObject({ code: "already_taken" });
  });
  it("полный цикл: назначение, планирование, вес каждого, завершение, бонус за сбор", async () => {
    const { buyer, residents, col } = await scene();
    const a = await mk(residents[0].id, "60", cats.pet.id);
    const b = await mk(residents[1].id, "45", cats.pet.id);
    await joinCollection(residents[0].id, col.id, a.id);
    await expect(assignCollection(buyer.id, col.id)).rejects.toMatchObject({ code: "target_not_reached" });
    await joinCollection(residents[1].id, col.id, b.id);
    await assignCollection(buyer.id, col.id);
    await expect(assignCollection(buyer.id, col.id)).rejects.toMatchObject({ code: "already_taken" });
    await scheduleCollection(buyer.id, col.id, new Date(Date.now() + 86400000));

    const ps = await db.select().from(schema.pickups);
    expect(ps).toHaveLength(2);
    for (const p of ps) {
      const rep = await reportWeight(buyer.id, p.id, p.residentId === residents[0].id ? "58" : "44.5");
      expect(await confirmPickup(p.residentId, p.id, rep.pin)).toMatchObject({ ok: true });
    }
    expect((await db.select().from(schema.collectiveCollections))[0].status).toBe("COMPLETED");
    expect(await balance(residents[0].id)).toBe(58 * 2 + 5 + 10);
    expect(await balance(residents[1].id)).toBe(Math.floor(44.5 * 2) + 5 + 10);
    const ms = await db.select().from(schema.collectiveMemberships);
    expect(ms.map((m) => m.actualKg).sort()).toEqual(["44.500", "58.000"]);
  });
});
