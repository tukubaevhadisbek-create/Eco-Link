import { desc, eq } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { SubscriptionControls } from "@/components/admin/controls";
import { DataTable, Td } from "@/components/admin/table";
import { PageTitle } from "@/components/page-title";
import { StatusBadge } from "@/components/status-badge";
import { db, schema } from "@/db";
import { fmtDate } from "@/lib/format";
import { hasActiveSubscription } from "@/server/requests";
import { requirePage } from "@/server/session";

export default async function AdminSubs() {
  await requirePage("ADMIN");
  const [t, locale] = [await getTranslations(), await getLocale()];
  const buyers = await db.select().from(schema.users).where(eq(schema.users.role, "BUYER"));
  const rows = [];
  for (const b of buyers) {
    const [last] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.buyerId, b.id)).orderBy(desc(schema.subscriptions.endsAt)).limit(1);
    rows.push({ b, last, active: await hasActiveSubscription(db, b.id) });
  }
  return (
    <>
      <PageTitle title={t("admin.subs_title")} hint={t("buyer.sub_demo_note")} />
      <DataTable head={[t("roles.BUYER"), t("common.status"), t("buyer.sub_start"), t("buyer.sub_end"), ""]}>
        {rows.map(({ b, last, active }) => (
          <tr key={b.id}>
            <Td className="font-semibold">{b.name}</Td><Td>{last ? <StatusBadge status={active ? last.status : "EXPIRED"} /> : "—"}</Td>
            <Td>{fmtDate(last?.startsAt, locale)}</Td><Td>{fmtDate(last?.endsAt, locale)}</Td><Td><SubscriptionControls buyerId={b.id} /></Td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
