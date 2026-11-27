import { desc, eq } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { DisputeResolver } from "@/components/admin/controls";
import { PageTitle } from "@/components/page-title";
import { StatusBadge } from "@/components/status-badge";
import { Card, EmptyState } from "@/components/ui/primitives";
import { db, schema } from "@/db";
import { alias } from "drizzle-orm/pg-core";
import { fmtDate, fmtNum } from "@/lib/format";
import { requirePage } from "@/server/session";

export default async function AdminDisputes() {
  await requirePage("ADMIN");
  const [t, locale] = [await getTranslations(), await getLocale()];
  const opener = alias(schema.users, "opener");
  const rows = await db
    .select({ d: schema.disputes, p: schema.pickups, opener: opener.name })
    .from(schema.disputes)
    .innerJoin(schema.pickups, eq(schema.pickups.id, schema.disputes.pickupId))
    .innerJoin(opener, eq(opener.id, schema.disputes.openedById))
    .orderBy(desc(schema.disputes.createdAt)).limit(100);
  return (
    <>
      <PageTitle title={t("admin.disputes_title")} />
      {rows.length === 0 ? <EmptyState title={t("admin.disputes_empty")} /> : (
        <ul className="space-y-4">
          {rows.map(({ d, p, opener }) => (
            <li key={d.id}><Card className="p-5" data-testid="dispute-card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-bold">{opener} · {fmtDate(d.createdAt, locale, true)}</p>
                  <p className="text-sm text-ink-soft">{p.reportedWeightKg ? `${t("buyer.actual_weight")}: ${fmtNum(p.reportedWeightKg, locale)} ${t("units.kg")} · ` : ""}{t("buyer.price_per_kg")}: {p.pricePerKg}</p></div>
                <StatusBadge status={d.status} />
              </div>
              <p className="mt-3 rounded-xl bg-eco-50 p-3">{d.reason}</p>
              {d.status === "OPEN" ? <DisputeResolver id={d.id} /> : <p className="mt-3 text-sm text-ink-soft">{t("admin.resolution")}: {d.resolution}</p>}
            </Card></li>
          ))}
        </ul>
      )}
    </>
  );
}
