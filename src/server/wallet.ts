import { and, asc, eq, sql } from "drizzle-orm";
import { schema, type Tx } from "@/db";
import { ecoCoins } from "@/lib/money";
import { notify } from "./notify";

const { bonusRules, wallets, walletTransactions } = schema;

/** Идемпотентная запись: уникальный индекс (pickup, user, reason) + onConflictDoNothing. */
export async function creditOnce(
  tx: Tx,
  userId: string,
  pickupId: string,
  reason: "PICKUP" | "COLLECTIVE",
  amount: number,
  note?: string,
): Promise<boolean> {
  if (amount <= 0) return false;
  await tx.insert(wallets).values({ userId }).onConflictDoNothing();
  const inserted = await tx
    .insert(walletTransactions)
    .values({ userId, pickupId, reason, amount, type: "EARN", note })
    .onConflictDoNothing()
    .returning({ id: walletTransactions.id });
  if (inserted.length === 0) return false; // уже начислено
  await tx
    .update(wallets)
    .set({ balance: sql`${wallets.balance} + ${amount}`, updatedAt: new Date() })
    .where(eq(wallets.userId, userId));
  return true;
}

export async function findRule(tx: Tx, categoryId: string) {
  const rules = await tx
    .select()
    .from(bonusRules)
    .where(and(eq(bonusRules.active, true)))
    .orderBy(asc(bonusRules.code));
  return rules.find((r) => r.categoryId === categoryId) ?? rules.find((r) => r.categoryId === null) ?? null;
}

/** Начисление EcoCoins после подтверждённого завершения операции. Повторный вызов безопасен. */
export async function awardForPickup(
  tx: Tx,
  p: { pickupId: string; residentId: string; categoryId: string; weightKg: string; isCollective: boolean },
): Promise<number> {
  const rule = await findRule(tx, p.categoryId);
  if (!rule) return 0;
  const base = ecoCoins(p.weightKg, { ...rule, collectiveBonus: 0 }, false);
  let awarded = 0;
  if (await creditOnce(tx, p.residentId, p.pickupId, "PICKUP", base, "kg+flat")) awarded += base;
  if (p.isCollective && rule.collectiveBonus > 0) {
    if (await creditOnce(tx, p.residentId, p.pickupId, "COLLECTIVE", rule.collectiveBonus, "collective"))
      awarded += rule.collectiveBonus;
  }
  if (awarded > 0) await notify(tx, p.residentId, "coins_awarded", { coins: awarded }, "/resident/wallet");
  return awarded;
}

