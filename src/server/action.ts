import { ZodError } from "zod";
import { AuthError } from "./auth-core";
import { ServiceError } from "./errors";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string; field?: string; attemptsLeft?: number };

/** Единая обёртка server actions: безопасные коды ошибок вместо stack trace. */
export async function run<T extends object = object>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    if (e instanceof ServiceError || e instanceof AuthError) {
      const attemptsLeft = (e as { attemptsLeft?: number }).attemptsLeft;
      return { ok: false, error: e.code, ...(attemptsLeft !== undefined ? { attemptsLeft } : {}) };
    }
    if (e instanceof ZodError) {
      const issue = e.issues[0];
      return { ok: false, error: String(issue?.message ?? "invalid"), field: String(issue?.path?.[0] ?? "") };
    }
    // Next.js redirect/notFound должны пройти дальше.
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    console.error("[action]", e);
    return { ok: false, error: "server_error" };
  }
}
