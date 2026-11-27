import { db, schema, type Tx } from "@/db";

export type NotificationType =
  | "new_request"
  | "request_accepted"
  | "request_cancelled"
  | "status_changed"
  | "pickup_scheduled"
  | "collection_target_reached"
  | "collection_assigned"
  | "weight_reported"
  | "pickup_completed"
  | "coins_awarded"
  | "subscription_expiring"
  | "dispute_opened"
  | "dispute_resolved";

/** Внутренние уведомления. Это не SMS: внешняя отправка в MVP не выполняется. */
export async function notify(
  tx: Tx | typeof db,
  userId: string,
  type: NotificationType,
  params: Record<string, string | number> = {},
  link?: string,
) {
  await tx.insert(schema.notifications).values({ userId, type, params, link: link ?? null });
}
