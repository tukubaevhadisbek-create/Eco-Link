import { desc, ne } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { DataTable, Td } from "@/components/admin/table";
import { UserStatusButton } from "@/components/admin/controls";
import { PageTitle } from "@/components/page-title";
import { DemoBadge, StatusBadge } from "@/components/status-badge";
import { db, schema } from "@/db";
import { fmtDate } from "@/lib/format";
import { requirePage } from "@/server/session";

export default async function AdminUsers() {
  await requirePage("ADMIN");
  const [t, locale] = [await getTranslations(), await getLocale()];
  const rows = await db.select().from(schema.users).where(ne(schema.users.role, "ADMIN")).orderBy(desc(schema.users.createdAt)).limit(300);
  return (
    <>
      <PageTitle title={t("admin.users_title")} />
      <DataTable head={[t("auth.name"), t("auth.phone"), t("auth.role"), t("auth.locality"), t("common.date"), t("common.status"), ""]}>
        {rows.map((u) => (
          <tr key={u.id}>
            <Td className="font-semibold">{u.name} {u.isDemo && <DemoBadge />}</Td><Td>{u.phone}</Td><Td>{t(`roles.${u.role}`)}</Td><Td>{u.locality}</Td>
            <Td>{fmtDate(u.createdAt, locale)}</Td><Td><StatusBadge status={u.status} /></Td><Td><UserStatusButton id={u.id} blocked={u.status === "BLOCKED"} /></Td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
