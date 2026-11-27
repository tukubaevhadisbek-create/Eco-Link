import { desc, eq } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { DataTable, Td } from "@/components/admin/table";
import { PageTitle } from "@/components/page-title";
import { db, schema } from "@/db";
import { fmtDate } from "@/lib/format";
import { requirePage } from "@/server/session";

export default async function AdminNotifications() {
  await requirePage("ADMIN");
  const [t, locale] = [await getTranslations(), await getLocale()];
  const rows = await db
    .select({ n: schema.notifications, user: schema.users.name })
    .from(schema.notifications)
    .innerJoin(schema.users, eq(schema.users.id, schema.notifications.userId))
    .orderBy(desc(schema.notifications.createdAt)).limit(200);
  return (
    <>
      <PageTitle title={t("admin.notifications_title")} hint={t("admin.notifications_hint")} />
      <DataTable head={[t("common.date"), t("auth.name"), t("common.status"), t("notifications.title")]}>
        {rows.map(({ n, user }) => (
          <tr key={n.id}><Td>{fmtDate(n.createdAt, locale, true)}</Td><Td className="font-semibold">{user}</Td><Td>{n.readAt ? "✓" : "•"}</Td>
            <Td>{t.has(`notifications.${n.type}`) ? t(`notifications.${n.type}`, n.params as Record<string, string | number>) : n.type}</Td></tr>
        ))}
      </DataTable>
    </>
  );
}
