import { count, desc, eq } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { DataTable, Td } from "@/components/admin/table";
import { PageTitle } from "@/components/page-title";
import { DemoBadge } from "@/components/status-badge";
import { db, schema } from "@/db";
import { fmtDate } from "@/lib/format";
import { requirePage } from "@/server/session";

export default async function AdminRoutes() {
  await requirePage("ADMIN");
  const [t, locale] = [await getTranslations(), await getLocale()];
  const rows = await db
    .select({ r: schema.routePlans, buyer: schema.users.name, stops: count(schema.routeStops.id) })
    .from(schema.routePlans)
    .innerJoin(schema.users, eq(schema.users.id, schema.routePlans.buyerId))
    .leftJoin(schema.routeStops, eq(schema.routeStops.routeId, schema.routePlans.id))
    .groupBy(schema.routePlans.id, schema.users.name)
    .orderBy(desc(schema.routePlans.plannedDate));
  return (
    <>
      <PageTitle title={t("admin.routes_title")} hint={t("buyer.route_note")} />
      <DataTable head={[t("roles.BUYER"), t("common.date"), "#", t("common.status")]} empty={rows.length ? undefined : t("admin.routes_empty")}>
        {rows.map(({ r, buyer, stops }) => (
          <tr key={r.id}><Td className="font-semibold">{buyer} {r.isDemo && <DemoBadge />}</Td><Td>{fmtDate(r.plannedDate, locale)}</Td><Td>{stops}</Td><Td>{r.status}</Td></tr>
        ))}
      </DataTable>
    </>
  );
}
