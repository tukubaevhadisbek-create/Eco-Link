import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role, User } from "@/db/schema";
import { resolveSession, SESSION_TTL_MS } from "./auth-core";
import { ServiceError } from "./errors";

export const SESSION_COOKIE = "ecolink_session";

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return resolveSession(token);
});

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}
export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export const homeFor = (role: Role) => (role === "ADMIN" ? "/admin" : role === "BUYER" ? "/buyer" : "/resident");

/** Для страниц: серверная проверка роли с редиректом. */
export async function requirePage(...roles: Role[]): Promise<User> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (roles.length && !roles.includes(u.role)) redirect(homeFor(u.role));
  return u;
}

/** Для server actions: бросает ошибку, а не редиректит. Проверка выполняется на каждом вызове. */
export async function requireActor(...roles: Role[]): Promise<User> {
  const u = await getCurrentUser();
  if (!u) throw new ServiceError("unauthorized", 401);
  if (roles.length && !roles.includes(u.role)) throw new ServiceError("forbidden", 403);
  return u;
}
