"use server";

import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@/i18n/request";
import { loginSchema, phoneSchema, profileSchema, registerSchema } from "@/lib/validation";
import { run } from "@/server/action";
import { audit } from "@/server/audit";
import {
  authenticate, createDemoResetCode, createSessionRecord, destroySession, registerUser, resetPasswordWithCode,
} from "@/server/auth-core";
import { SESSION_COOKIE, clearSessionCookie, homeFor, requireActor, setSessionCookie } from "@/server/session";
import { ServiceError } from "@/server/errors";

async function sameOrigin() {
  // Дополнительная защита от CSRF поверх встроенной проверки Origin в Server Actions.
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("host");
  if (origin && host && new URL(origin).host !== host) throw new ServiceError("forbidden", 403);
}

export async function registerAction(input: unknown) {
  return run(async () => {
    await sameOrigin();
    const data = registerSchema.parse(input);
    const u = await registerUser(data);
    const { token, expiresAt } = await createSessionRecord(u.id);
    await setSessionCookie(token, expiresAt);
    const jar = await cookies();
    if (!jar.get(LOCALE_COOKIE)) jar.set(LOCALE_COOKIE, DEFAULT_LOCALE, { path: "/", maxAge: 31536000 });
    return { redirectTo: homeFor(u.role) };
  });
}

export async function loginAction(input: unknown) {
  return run(async () => {
    await sameOrigin();
    const data = loginSchema.parse(input);
    const u = await authenticate(data.phone, data.password);
    const { token, expiresAt } = await createSessionRecord(u.id);
    await setSessionCookie(token, expiresAt);
    const jar = await cookies();
    if (isLocale(u.language)) jar.set(LOCALE_COOKIE, u.language, { path: "/", maxAge: 31536000 });
    return { redirectTo: homeFor(u.role) };
  });
}

export async function logoutAction() {
  return run(async () => {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    await destroySession(token);
    await clearSessionCookie();
    return {};
  });
}

export async function setLocaleAction(locale: string) {
  return run(async () => {
    if (!isLocale(locale)) throw new ServiceError("invalid");
    (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 31536000, sameSite: "lax" });
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token) {
      const { resolveSession } = await import("@/server/auth-core");
      const u = await resolveSession(token);
      if (u) await db.update(schema.users).set({ language: locale }).where(eq(schema.users.id, u.id));
    }
    return {};
  });
}

export async function updateProfileAction(input: unknown) {
  return run(async () => {
    const u = await requireActor();
    const d = profileSchema.parse(input);
    await db.transaction(async (tx) => {
      await tx
        .update(schema.users)
        .set({ name: d.name, locality: d.locality, language: d.language, updatedAt: new Date() })
        .where(eq(schema.users.id, u.id));
      await tx
        .insert(schema.userProfiles)
        .values({ userId: u.id, address: d.address || null })
        .onConflictDoUpdate({ target: schema.userProfiles.userId, set: { address: d.address || null } });
      await audit(tx, u.id, "user.update_profile", "user", u.id);
    });
    (await cookies()).set(LOCALE_COOKIE, d.language, { path: "/", maxAge: 31536000 });
    return {};
  });
}

/**
 * ДЕМО-восстановление: SMS в MVP не отправляются, поэтому код показывается на экране
 * и только при DEMO_RESET_CODES=1 (по умолчанию включено вне production).
 */
export async function requestResetAction(input: unknown) {
  return run(async () => {
    const phone = phoneSchema.parse(input);
    const demo = process.env.NODE_ENV !== "production" || process.env.DEMO_RESET_CODES === "1";
    const code = await createDemoResetCode(phone);
    return { demoCode: demo && code ? code : null };
  });
}

export async function resetPasswordAction(input: { phone: string; code: string; password: string }) {
  return run(async () => {
    const phone = phoneSchema.parse(input.phone);
    if (input.password.length < 8 || !/\d/.test(input.password) || !/[A-Za-zА-Яа-я]/.test(input.password))
      throw new ServiceError("password_weak");
    await resetPasswordWithCode(phone, input.code.trim(), input.password);
    return {};
  });
}
