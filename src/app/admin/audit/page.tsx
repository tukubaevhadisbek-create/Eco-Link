import { desc, eq } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { DataTable, Td } from "@/components/admin/table";
import { PageTitle } from "@/components/page-title";
import { db, schema } from "@/db";
import { fmtDate } from "@/lib/format";
import { requirePage } from "@/server/session";

export default async function AdminAudit() {
  await requirePage("ADMIN");
  const [t, locale] = [await getTranslations(), await getLocale()];
  const rows = await db
    .select({ a: schema.auditLogs, actor: schema.users.name })
    .from(schema.auditLogs)
    .leftJoin(schema.users, eq(schema.users.id, schema.auditLogs.actorId))
    .orderBy(desc(schema.auditLogs.createdAt)).limit(300);
  return (
    <>
      <PageTitle title={t("admin.audit_title")} />
      <DataTable head={[t("common.date"), t("auth.name"), t("common.actions"), t("admin.audit_entity")]}>
        {rows.map(({ a, actor }) => (
          <tr key={a.id}><Td>{fmtDate(a.createdAt, locale, true)}</Td><Td>{actor ?? "—"}</Td><Td className="font-mono text-xs">{a.action}</Td><Td className="font-mono text-xs">{a.entity}{a.entityId ? `:${a.entityId.slice(0, 8)}` : ""}</Td></tr>
        ))}
      </DataTable>
    </>
  );
}
