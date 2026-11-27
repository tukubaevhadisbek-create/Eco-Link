import { desc, eq } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { DataTable, Td } from "@/components/admin/table";
import { PageTitle } from "@/components/page-title";
import { db, schema } from "@/db";
import { catName, fmtDate } from "@/lib/format";
import { requirePage } from "@/server/session";

export default async function AdminPrices() {
  await requirePage("ADMIN");
  const [t, locale] = [await getTranslations(), await getLocale()];
  const rows = await db
    .select({ p: schema.buyerPrices, c: schema.materialCategories, buyer: schema.users.name })
    .from(schema.buyerPrices)
    .innerJoin(schema.materialCategories, eq(schema.materialCategories.id, schema.buyerPrices.categoryId))
    .innerJoin(schema.users, eq(schema.users.id, schema.buyerPrices.buyerId))
    .orderBy(desc(schema.buyerPrices.updatedAt));
  return (
    <>
      <PageTitle title={t("admin.prices_title")} hint={t("buyer.prices_note")} />
      <DataTable head={[t("roles.BUYER"), t("request.category"), t("buyer.price_per_kg"), t("buyer.min_volume"), t("buyer.price_updated")]}>
        {rows.map(({ p, c, buyer }) => (
          <tr key={p.id}><Td className="font-semibold">{buyer}</Td><Td>{catName(c, locale)}</Td><Td>{p.pricePerKg}</Td><Td>{Number(p.minVolumeKg)}</Td><Td>{fmtDate(p.updatedAt, locale)}</Td></tr>
        ))}
      </DataTable>
    </>
  );
}
