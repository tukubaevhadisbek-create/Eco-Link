import { createHash, randomBytes, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "@/db";
import type { RegisterInput } from "@/lib/validation";
import { audit } from "./audit";

const { users, sessions, loginAttempts, wallets, userProfiles, buyerProfiles, subscriptions, subscriptionEvents } =
  schema;

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
export const MAX_FAILURES = 5;
export const LOCK_MS = 1000 * 60 * 15;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const hashPassword = (p: string) => bcrypt.hash(p, 10);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

export class AuthError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export async function registerUser(input: RegisterInput) {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.phone, input.phone));
  if (existing) throw new AuthError("phone_taken");
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const [u] = await tx
      .insert(users)
      .values({
        phone: input.phone,
        name: input.name,
        passwordHash,
        role: input.role,
        locality: input.locality,
        consentAt: new Date(),
      })
      .returning();
    await tx.insert(userProfiles).values({ userId: u.id });
    await tx.insert(wallets).values({ userId: u.id });
    if (input.role === "BUYER") {
      await tx.insert(buyerProfiles).values({ userId: u.id });
      // Тестовый период 14 дней — без реального списания средств.
      const now = new Date();
      const [sub] = await tx
        .insert(subscriptions)
        .values({
          buyerId: u.id,
          status: "TRIAL",
          isTrial: true,
          startsAt: now,
          endsAt: new Date(now.getTime() + 14 * 86400000),
        })
        .returning();
      await tx.insert(subscriptionEvents).values({ subscriptionId: sub.id, type: "TRIAL_STARTED", isDemo: true });
    }
    await audit(tx, u.id, "user.register", "user", u.id, { role: input.role });
    return u;
  });
}

/** Проверка пароля с блокировкой после MAX_FAILURES неудач. */
export async function authenticate(phone: string, password: string) {
  const [att] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, phone));
  if (att?.lockedUntil && att.lockedUntil > new Date()) throw new AuthError("locked");

  const [u] = await db.select().from(users).where(eq(users.phone, phone));
  // Сравнение выполняется даже для несуществующего пользователя (выравнивание времени ответа).
  const ok = await verifyPassword(
    password,
    u?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi",
  );
  if (!u || !ok) {
    const failures = (att?.failures ?? 0) + 1;
    const lockedUntil = failures >= MAX_FAILURES ? new Date(Date.now() + LOCK_MS) : null;
    await db
      .insert(loginAttempts)
      .values({ key: phone, failures: lockedUntil ? 0 : failures, lockedUntil })
      .onConflictDoUpdate({
        target: loginAttempts.key,
        set: { failures: lockedUntil ? 0 : failures, lockedUntil, updatedAt: new Date() },
      });
    throw new AuthError(lockedUntil ? "locked" : "invalid_credentials");
  }
  if (u.status === "BLOCKED") throw new AuthError("blocked");
  if (att) await db.delete(loginAttempts).where(eq(loginAttempts.key, phone));
  return u;
}

export async function createSessionRecord(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({
    id: sha256(token),
    userId,
    csrfToken: randomBytes(16).toString("hex"),
    expiresAt,
  });
  return { token, expiresAt };
}

export async function resolveSession(token: string | undefined) {
  if (!token) return null;
  const [row] = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())));
  if (!row || row.user.status === "BLOCKED") return null;
  return row.user;
}

export async function destroySession(token: string | undefined) {
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
}

/** Демонстрационное восстановление: код показывается на экране, SMS не отправляется. */
export async function createDemoResetCode(phone: string) {
  const [u] = await db.select().from(users).where(eq(users.phone, phone));
  if (!u) return null;
  const code = String(randomInt(100000, 999999));
  await db.insert(schema.passwordResets).values({
    userId: u.id,
    codeHash: sha256(`${u.id}:${code}`),
    expiresAt: new Date(Date.now() + 10 * 60000),
  });
  return code;
}

export async function resetPasswordWithCode(phone: string, code: string, newPassword: string) {
  const [u] = await db.select().from(users).where(eq(users.phone, phone));
  if (!u) throw new AuthError("invalid_code");
  const [r] = await db
    .select()
    .from(schema.passwordResets)
    .where(
      and(
        eq(schema.passwordResets.userId, u.id),
        eq(schema.passwordResets.codeHash, sha256(`${u.id}:${code}`)),
        gt(schema.passwordResets.expiresAt, new Date()),
      ),
    );
  if (!r || r.usedAt) throw new AuthError("invalid_code");
  await db.transaction(async (tx) => {
    await tx.update(schema.passwordResets).set({ usedAt: new Date() }).where(eq(schema.passwordResets.id, r.id));
    await tx.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, u.id));
    await tx.delete(sessions).where(eq(sessions.userId, u.id));
  });
}
