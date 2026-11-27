import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getLocale, getTranslations } from "next-intl/server";
import { ReviewModerate } from "@/components/admin/controls";
import { PageTitle } from "@/components/page-title";
import { DemoBadge, StatusBadge } from "@/components/status-badge";
import { Card, EmptyState } from "@/components/ui/primitives";
import { db, schema } from "@/db";
import { fmtDate } from "@/lib/format";
import { requirePage } from "@/server/session";

export default async function AdminReviews() {
  await requirePage("ADMIN");
  const [t, locale] = [await getTranslations(), await getLocale()];
  const buyer = alias(schema.users, "buyer");
  const rows = await db
    .select({ r: schema.reviews, resident: schema.users.name, buyer: buyer.name })
    .from(schema.reviews)
    .innerJoin(schema.users, eq(schema.users.id, schema.reviews.residentId))
    .innerJoin(buyer, eq(buyer.id, schema.reviews.buyerId))
    .orderBy(desc(schema.reviews.createdAt)).limit(200);
  return (
    <>
      <PageTitle title={t("admin.reviews_title")} />
      {rows.length === 0 ? <EmptyState title={t("buyer.reviews_empty")} /> : (
        <ul className="space-y-3">
          {rows.map(({ r, resident, buyer }) => (
            <li key={r.id}><Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-bold text-amber-600">{"★".repeat(r.rating)}<span className="text-line">{"★".repeat(5 - r.rating)}</span></p>
                  <p className="text-sm text-ink-soft">{resident} → {buyer} · {fmtDate(r.createdAt, locale)}</p></div>
                <div className="flex items-center gap-2">{r.isDemo && <DemoBadge />}<StatusBadge status={r.status} /><ReviewModerate id={r.id} hidden={r.status === "HIDDEN"} /></div>
              </div>
              {r.text && <p className="mt-2">{r.text}</p>}
            </Card></li>
          ))}
        </ul>
      )}
    </>
  );
}
