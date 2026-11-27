import { db, schema, type Tx } from "@/db";

export async function audit(
  tx: Tx | typeof db,
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  meta: Record<string, unknown> = {},
) {
  await tx.insert(schema.auditLogs).values({ actorId, action, entity, entityId, meta });
}
