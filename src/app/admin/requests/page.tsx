import { desc, eq } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { CancelRequestAdmin } from "@/components/admin/controls";
import { DataTable, Td } from "@/components/admin/table";
import { PageTitle } from "@/components/page-title";
import { DemoBadge, StatusBadge } from "@/components/status-badge";
import { db, schema } from "@/db";
import { catName, fmtDate, fmtNum } from "@/lib/format";
import { requirePage } from "@/server/session";

export default async function AdminRequests() {
  await requirePage("ADMIN");
  const [t, locale] = [await getTranslations(), await getLocale()];
  const rows = await db
    .select({ r: schema.recyclingRequests, c: schema.materialCategories, resident: schema.users.name })
    .from(schema.recyclingRequests)
    .innerJoin(schema.materialCategories, eq(schema.materialCategories.id, schema.recyclingRequests.categoryId))
    .innerJoin(schema.users, eq(schema.users.id, schema.recyclingRequests.residentId))
    .orderBy(desc(schema.recyclingRequests.createdAt)).limit(300);
  return (
    <>
      <PageTitle title={t("admin.requests_title")} />
      <DataTable head={[t("request.category"), t("request.weight"), t("request.locality"), t("roles.RESIDENT"), t("common.date"), t("common.status"), ""]}>
        {rows.map(({ r, c, resident }) => (
          <tr key={r.id}>
            <Td className="font-semibold">{catName(c, locale)} {r.isDemo && <DemoBadge />}</Td><Td>{fmtNum(r.actualWeightKg ?? r.approxWeightKg, locale)}</Td><Td>{r.locality}</Td>
            <Td>{resident}</Td><Td>{fmtDate(r.createdAt, locale)}</Td><Td><StatusBadge status={r.status} /></Td>
            <Td>{["AVAILABLE", "RESERVED"].includes(r.status) && <CancelRequestAdmin id={r.id} />}</Td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
