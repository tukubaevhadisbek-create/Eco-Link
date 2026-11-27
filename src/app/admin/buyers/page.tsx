import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { DataTable, Td } from "@/components/admin/table";
import { VerifyButton } from "@/components/admin/controls";
import { PageTitle } from "@/components/page-title";
import { DemoBadge } from "@/components/status-badge";
import { db, schema } from "@/db";
import { buyerRatings } from "@/server/queries";
import { requirePage } from "@/server/session";

export default async function AdminBuyers() {
  await requirePage("ADMIN");
  const t = await getTranslations();
  const rows = await db
    .select({ u: schema.users, p: schema.buyerProfiles })
    .from(schema.buyerProfiles)
    .innerJoin(schema.users, eq(schema.users.id, schema.buyerProfiles.userId));
  const ratings = await buyerRatings(rows.map((r) => r.u.id));
  return (
    <>
      <PageTitle title={t("admin.buyers_title")} />
      <DataTable head={[t("auth.name"), t("buyer.org"), t("auth.phone"), t("buyer.min_batch"), t("buyer.rating"), ""]}>
        {rows.map(({ u, p }) => {
          const r = ratings.get(u.id);
          return (
            <tr key={u.id}>
              <Td className="font-semibold">{u.name} {u.isDemo && <DemoBadge />}</Td><Td>{p.orgName ?? "—"}</Td><Td>{u.phone}</Td><Td>{Number(p.minBatchKg)}</Td>
              <Td>{r?.average ? `★ ${r.average.toFixed(1)} (${r.count})` : "—"}</Td><Td><VerifyButton id={u.id} verified={p.verified} /></Td>
            </tr>
          );
        })}
      </DataTable>
    </>
  );
}
